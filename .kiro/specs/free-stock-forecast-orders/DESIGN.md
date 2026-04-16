# Free Stock & Forecast Orders System Design

## Overview
This design introduces a system to manage inventory that is not tied to customer orders (free stock) and allows creating forecast orders for planning purposes. This enables:
- Creating orders without a specific customer (forecast/planning orders)
- Tracking free stock separately from booked stock
- Creating sales from free stock inventory
- Better inventory management and forecasting

## Current System Analysis

### Existing Inventory Model
```
Product.qty = Total quantity in stock
Product.booked_qty = Quantity reserved for customer orders
Available qty = qty - booked_qty
```

### Current Order Model
- Orders MUST have a `client_id` (foreign key constraint)
- Orders book inventory when created
- Sales can only be created from received order items

### Current Sales Model
- Sales require a `client_id`
- Sales items must reference an `order_item_id`
- Sales deduct from product inventory

## Proposed Changes

### 1. Database Schema Changes

#### A. Modify Orders Table
```sql
ALTER TABLE orders ADD COLUMN client_id UUID NULL;
-- Make client_id nullable to allow forecast orders
-- Add constraint: client_id is required OR order_type = 'forecast'

ALTER TABLE orders ADD COLUMN order_type VARCHAR(20) DEFAULT 'customer';
-- Values: 'customer' (linked to client), 'forecast' (planning/free stock)

ALTER TABLE orders ADD COLUMN is_forecast BOOLEAN DEFAULT FALSE;
-- Deprecated: use order_type instead, kept for backward compatibility
```

#### B. Modify Sales Table
```sql
ALTER TABLE sales ADD COLUMN client_id UUID NULL;
-- Make client_id nullable to allow sales from free stock

ALTER TABLE sales ADD COLUMN sale_type VARCHAR(20) DEFAULT 'customer';
-- Values: 'customer' (linked to client), 'free_stock' (from unbooked inventory)
```

#### C. Add Free Stock Tracking (Optional but Recommended)
```sql
-- Create a free_stock_orders table to track free stock allocations
CREATE TABLE free_stock_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  allocated_qty INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 2. Inventory Calculation Changes

#### Current Formula
```
available_qty = qty - booked_qty
```

#### New Formula (Option A: Simple)
```
available_qty = qty - booked_qty
free_stock = available_qty (same as before)
```

#### New Formula (Option B: Explicit Tracking)
```
available_qty = qty - booked_qty - free_stock_allocated
free_stock = qty - booked_qty - free_stock_allocated
```

**Recommendation**: Use Option A initially (simpler), migrate to Option B if needed.

### 3. Order Creation Changes

#### Current Flow
```
POST /api/orders
- Requires: client_id, items
- Creates: Order with client_id
- Books: inventory (booked_qty += ordered_qty)
```

#### New Flow
```
POST /api/orders
- Requires: items
- Optional: client_id (if provided, type='customer'; if null, type='forecast')
- Creates: Order with order_type
- Books: inventory only if type='customer'
- If type='forecast': tracks as free stock allocation
```

### 4. Sales Creation Changes

#### Current Flow
```
POST /api/sales
- Requires: client_id, items (from order_items)
- Creates: Sale with client_id
- Deducts: inventory
- Links: to order_items
```

#### New Flow
```
POST /api/sales
- Requires: items (can be from order_items OR free stock)
- Optional: client_id
- Creates: Sale with sale_type
- Deducts: inventory
- Links: to order_items if available, or free_stock_orders

New item format:
{
  source: 'order_item' | 'free_stock',
  order_item_id?: string,  // if source='order_item'
  product_id: string,      // required
  quantity: number,
  unit_price: number
}
```

## Implementation Phases

### Phase 1: Enable Forecast Orders (Minimal Changes)
1. Make `orders.client_id` nullable
2. Add `orders.order_type` field
3. Update order creation API to accept null client_id
4. Update order display to show "Forecast Order" when client_id is null
5. Update inventory booking logic to skip booking for forecast orders

**Impact**: Low, backward compatible

### Phase 2: Enable Free Stock Sales (Medium Changes)
1. Make `sales.client_id` nullable
2. Add `sales.sale_type` field
3. Update sales creation API to accept free stock items
4. Create new endpoint: `POST /api/sales/from-free-stock`
5. Update sales display to show sale type

**Impact**: Medium, requires UI changes

### Phase 3: Advanced Free Stock Tracking (Optional)
1. Create `free_stock_orders` table
2. Add free stock allocation tracking
3. Create dashboard for free stock management
4. Add forecasting analytics

**Impact**: High, optional enhancement

## API Changes

### 1. Create Order (Updated)
```typescript
POST /api/orders
{
  client_id?: string,  // Optional now
  items: Array<{
    product_id: string,
    ordered_qty: number,
    unit_price?: number
  }>,
  notes?: string,
  order_type?: 'customer' | 'forecast'  // Auto-detected from client_id
}

Response:
{
  id: string,
  order_number: string,
  client_id: string | null,
  order_type: 'customer' | 'forecast',
  status: 'pending',
  items: OrderItem[],
  total_amount: number,
  created_at: string
}
```

### 2. Create Sale (Updated)
```typescript
POST /api/sales
{
  client_id?: string,  // Optional now
  items: Array<{
    source: 'order_item' | 'free_stock',
    order_item_id?: string,
    product_id: string,
    quantity: number,
    unit_price: number
  }>,
  notes?: string,
  sale_type?: 'customer' | 'free_stock'  // Auto-detected
}

Response:
{
  id: string,
  sale_number: string,
  client_id: string | null,
  sale_type: 'customer' | 'free_stock',
  items: SaleItem[],
  total_amount: number,
  created_at: string
}
```

### 3. New Endpoint: Get Free Stock
```typescript
GET /api/free-stock
Query params:
  - search?: string (product search)
  - page?: number
  - pageSize?: number

Response:
{
  data: Array<{
    product_id: string,
    part_number: string,
    model: string,
    total_qty: number,
    booked_qty: number,
    free_qty: number,
    sell_price: number,
    cost_price: number
  }>,
  total: number,
  page: number,
  pageSize: number
}
```

## UI Changes

### 1. Order Creation Form
- Add toggle: "Create as Forecast Order" (when client_id is empty)
- Make client selection optional
- Show warning when creating forecast order

### 2. Sales Creation Form
- Add tab/toggle: "From Customer Order" vs "From Free Stock"
- When "From Free Stock":
  - Show available free stock products
  - Allow selecting products and quantities
  - Calculate prices from product sell_price

### 3. Dashboard Updates
- Show free stock quantity separately
- Add "Forecast Orders" section
- Add "Free Stock Sales" section

### 4. Product Page
- Show: total_qty, booked_qty, free_qty
- Add "Free Stock" indicator

## Data Migration

### Step 1: Add New Columns
```sql
ALTER TABLE orders ADD COLUMN order_type VARCHAR(20) DEFAULT 'customer';
ALTER TABLE sales ADD COLUMN client_id UUID NULL;
ALTER TABLE sales ADD COLUMN sale_type VARCHAR(20) DEFAULT 'customer';
```

### Step 2: Backfill Data
```sql
-- All existing orders are customer orders
UPDATE orders SET order_type = 'customer' WHERE order_type IS NULL;

-- All existing sales are customer sales
UPDATE sales SET sale_type = 'customer' WHERE sale_type IS NULL;
```

### Step 3: Add Constraints (Optional)
```sql
ALTER TABLE orders ADD CONSTRAINT check_order_type_client
  CHECK (
    (order_type = 'customer' AND client_id IS NOT NULL) OR
    (order_type = 'forecast' AND client_id IS NULL)
  );
```

## Benefits

1. **Forecast Planning**: Create orders for inventory planning without customer commitment
2. **Free Stock Management**: Track and manage unbooked inventory separately
3. **Flexible Sales**: Create sales from any available inventory, not just customer orders
4. **Better Analytics**: Distinguish between customer orders and forecast orders
5. **Inventory Optimization**: Better visibility into free vs. booked stock

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Null client_id breaks existing logic | Add null checks, use optional chaining |
| Inventory deduction logic changes | Comprehensive testing, gradual rollout |
| Sales without orders confuses users | Clear UI labeling, documentation |
| Data migration issues | Backup before migration, test on staging |

## Timeline

- **Phase 1**: 2-3 days (forecast orders)
- **Phase 2**: 3-4 days (free stock sales)
- **Phase 3**: 4-5 days (advanced tracking, optional)

**Total**: 1-2 weeks for full implementation
