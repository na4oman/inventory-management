# System Architecture: Free Stock & Forecast Orders

## Current System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    CURRENT SYSTEM                           │
└─────────────────────────────────────────────────────────────┘

PRODUCTS
├─ qty: 100 (total)
├─ booked_qty: 60 (reserved for orders)
└─ available_qty: 40 (qty - booked_qty)

ORDERS (Customer Only)
├─ Must have client_id
├─ Books inventory when created
└─ order_items track ordered quantities

SALES (From Orders Only)
├─ Must have client_id
├─ Must reference order_items
├─ Can only sell received items
└─ Deducts from inventory

PROBLEM: Can't create orders without customers or sales without orders
```

## New System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    NEW SYSTEM                               │
└─────────────────────────────────────────────────────────────┘

PRODUCTS
├─ qty: 100 (total)
├─ booked_qty: 60 (reserved for customer orders)
└─ free_qty: 40 (qty - booked_qty, available for free stock)

ORDERS (Two Types)
├─ Customer Orders
│  ├─ Has client_id
│  ├─ Books inventory
│  └─ Can be converted to sales
│
└─ Forecast Orders (NEW)
   ├─ No client_id
   ├─ Doesn't book inventory
   └─ For planning/demand forecasting

SALES (Two Types)
├─ Customer Sales (Existing)
│  ├─ Has client_id
│  ├─ From order_items
│  └─ Deducts from booked inventory
│
└─ Free Stock Sales (NEW)
   ├─ Optional client_id
   ├─ Direct from products
   └─ Deducts from free inventory

BENEFIT: Flexible order and sales creation
```

## Inventory Flow Diagram

### Current System
```
Product Inventory
       │
       ├─→ Booked (Customer Orders)
       │   └─→ Sales (from orders)
       │       └─→ Deduct from inventory
       │
       └─→ Free (Unused)
           └─→ Wasted/Dead stock
```

### New System
```
Product Inventory
       │
       ├─→ Booked (Customer Orders)
       │   ├─→ Sales (from orders)
       │   │   └─→ Deduct from inventory
       │   │
       │   └─→ Forecast Orders
       │       └─→ Planning/Demand tracking
       │
       └─→ Free (Unbooked)
           ├─→ Free Stock Sales (NEW)
           │   └─→ Deduct from inventory
           │
           └─→ Available for allocation
```

## Data Model Changes

### Orders Table

**Before:**
```
orders
├─ id (PK)
├─ order_number
├─ client_id (FK, NOT NULL) ← Required
├─ status
├─ total_amount
├─ notes
├─ created_at
└─ updated_at
```

**After:**
```
orders
├─ id (PK)
├─ order_number
├─ client_id (FK, NULL) ← Now optional
├─ order_type ← NEW: 'customer' | 'forecast'
├─ status
├─ total_amount
├─ notes
├─ created_at
└─ updated_at
```

### Sales Table

**Before:**
```
sales
├─ id (PK)
├─ sale_number
├─ client_id (FK, NOT NULL) ← Required
├─ total_amount
├─ total_cost
├─ profit
├─ notes
├─ sale_date
└─ created_at
```

**After:**
```
sales
├─ id (PK)
├─ sale_number
├─ client_id (FK, NULL) ← Now optional
├─ sale_type ← NEW: 'customer' | 'free_stock'
├─ total_amount
├─ total_cost
├─ profit
├─ notes
├─ sale_date
└─ created_at
```

### Sale Items Table

**Before:**
```
sale_items
├─ id (PK)
├─ sale_id (FK)
├─ order_item_id (FK, NOT NULL) ← Required
├─ product_id (FK)
├─ quantity
├─ unit_price
├─ unit_cost
├─ subtotal
├─ cost_total
├─ profit
└─ created_at
```

**After:**
```
sale_items
├─ id (PK)
├─ sale_id (FK)
├─ order_item_id (FK, NULL) ← Now optional
├─ product_id (FK)
├─ quantity
├─ unit_price
├─ unit_cost
├─ subtotal
├─ cost_total
├─ profit
└─ created_at
```

## API Endpoint Architecture

### Current Endpoints
```
POST /api/orders
├─ Requires: client_id, items
└─ Creates: Customer order with inventory booking

POST /api/sales
├─ Requires: client_id, order_items
└─ Creates: Customer sale from order items

GET /api/products
├─ Returns: Products with available_qty
└─ available_qty = qty - booked_qty
```

### New Endpoints
```
POST /api/orders (Updated)
├─ Requires: items
├─ Optional: client_id
├─ Auto-detects: order_type
└─ Behavior:
    ├─ If client_id: type='customer', books inventory
    └─ If no client_id: type='forecast', no booking

POST /api/sales (Updated)
├─ Requires: items
├─ Optional: client_id
├─ Behavior: Same as before (backward compatible)

POST /api/sales/from-free-stock (NEW)
├─ Requires: items (product_id, quantity, unit_price)
├─ Optional: client_id
├─ Creates: Free stock sale
└─ Deducts: From free inventory

GET /api/free-stock (NEW)
├─ Returns: Products with free_qty > 0
├─ free_qty = qty - booked_qty
└─ Useful for: Sales creation, inventory planning
```

## Request/Response Examples

### Create Forecast Order
```
POST /api/orders
{
  "items": [
    {
      "product_id": "prod-123",
      "ordered_qty": 50,
      "unit_price": 100
    }
  ],
  "notes": "Forecast for Q2 demand"
}

Response:
{
  "id": "order-456",
  "order_number": "ORD-2024-001",
  "client_id": null,
  "order_type": "forecast",
  "status": "pending",
  "total_amount": 5000,
  "items": [...],
  "created_at": "2024-01-15T10:00:00Z"
}
```

### Create Free Stock Sale
```
POST /api/sales/from-free-stock
{
  "client_id": "client-789",
  "items": [
    {
      "product_id": "prod-123",
      "quantity": 10,
      "unit_price": 120
    }
  ],
  "notes": "Direct sale from inventory"
}

Response:
{
  "id": "sale-999",
  "sale_number": "SAL-2024-001",
  "client_id": "client-789",
  "sale_type": "free_stock",
  "total_amount": 1200,
  "total_cost": 800,
  "profit": 400,
  "items": [...],
  "created_at": "2024-01-15T10:05:00Z"
}
```

### Get Free Stock
```
GET /api/free-stock?search=&page=1&pageSize=10

Response:
{
  "data": [
    {
      "id": "prod-123",
      "part_number": "PN-001",
      "model": "Model X",
      "qty": 100,
      "booked_qty": 60,
      "free_qty": 40,
      "sell_price": 120,
      "cost_price": 80
    },
    ...
  ],
  "total": 25,
  "page": 1,
  "pageSize": 10
}
```

## UI Component Architecture

### Order Creation Flow
```
OrderForm
├─ Checkbox: "Create as Forecast Order"
├─ If checked:
│  ├─ Hide client selection
│  └─ Show forecast warning
├─ If unchecked:
│  ├─ Show client selection (required)
│  └─ Normal order flow
└─ Submit → POST /api/orders
```

### Sales Creation Flow
```
CreateSaleForm
├─ Tabs: "From Customer Order" | "From Free Stock"
│
├─ Tab 1: From Customer Order (Existing)
│  ├─ Select customer
│  ├─ Show customer's received orders
│  ├─ Select items from orders
│  └─ Submit → POST /api/sales
│
└─ Tab 2: From Free Stock (NEW)
   ├─ Optional: Select customer
   ├─ Search free stock products
   ├─ Select products and quantities
   ├─ Enter unit prices
   └─ Submit → POST /api/sales/from-free-stock
```

### Product Display
```
ProductCard
├─ Part Number
├─ Model
├─ Total Qty: 100
├─ Booked Qty: 60
├─ Free Qty: 40 ← NEW
├─ Sell Price
└─ Cost Price
```

## State Management

### Product State
```
Product {
  id: string
  qty: number (total)
  booked_qty: number (from customer orders)
  
  // Computed
  free_qty = qty - booked_qty
  available_qty = qty - booked_qty (same as free_qty)
}
```

### Order State
```
Order {
  id: string
  client_id: string | null
  order_type: 'customer' | 'forecast'
  
  // Behavior
  if order_type === 'customer':
    - Books inventory
    - Can be converted to sales
  else if order_type === 'forecast':
    - Doesn't book inventory
    - For planning only
}
```

### Sale State
```
Sale {
  id: string
  client_id: string | null
  sale_type: 'customer' | 'free_stock'
  
  // Behavior
  if sale_type === 'customer':
    - From order_items
    - Deducts from booked inventory
  else if sale_type === 'free_stock':
    - Direct from products
    - Deducts from free inventory
}
```

## Validation Rules

### Order Creation
```
if client_id provided:
  ✓ order_type = 'customer'
  ✓ client must exist
  ✓ inventory will be booked
else if client_id not provided:
  ✓ order_type = 'forecast'
  ✓ no client validation needed
  ✓ inventory NOT booked
else:
  ✗ Error: Either client_id or order_type='forecast' required
```

### Sale Creation (Customer)
```
✓ client_id required
✓ order_items must exist
✓ received_qty >= sale quantity
✓ product qty >= sale quantity
✓ sale_type = 'customer'
```

### Sale Creation (Free Stock)
```
✓ client_id optional
✓ products must exist
✓ free_qty >= sale quantity (qty - booked_qty)
✓ sale_type = 'free_stock'
```

## Backward Compatibility

### Existing Orders
```
All existing orders:
├─ Have client_id (not null)
├─ Will have order_type = 'customer' (default)
└─ Behavior unchanged
```

### Existing Sales
```
All existing sales:
├─ Have client_id (not null)
├─ Will have sale_type = 'customer' (default)
├─ Have order_item_id (not null)
└─ Behavior unchanged
```

### Migration Strategy
```
1. Add new columns with defaults
2. Backfill existing data with defaults
3. Update code to handle new types
4. Gradually enable new features
5. No breaking changes
```

## Performance Considerations

### Indexes to Add
```sql
CREATE INDEX idx_orders_order_type ON orders(order_type);
CREATE INDEX idx_orders_client_id ON orders(client_id);
CREATE INDEX idx_sales_sale_type ON sales(sale_type);
CREATE INDEX idx_sales_client_id ON sales(client_id);
CREATE INDEX idx_products_booked_qty ON products(booked_qty);
```

### Query Optimization
```
Free Stock Query:
SELECT * FROM products
WHERE (qty - booked_qty) > 0
ORDER BY (qty - booked_qty) DESC

Forecast Orders Query:
SELECT * FROM orders
WHERE order_type = 'forecast'
ORDER BY created_at DESC

Free Stock Sales Query:
SELECT * FROM sales
WHERE sale_type = 'free_stock'
ORDER BY created_at DESC
```

## Error Handling

### Common Errors
```
1. Insufficient Free Stock
   - Message: "Insufficient free stock for product X"
   - Solution: Show available free_qty

2. Product Not Found
   - Message: "Product not found"
   - Solution: Validate product_id before submission

3. Invalid Order Type
   - Message: "Either client_id or order_type='forecast' required"
   - Solution: Provide client_id or set order_type

4. Inventory Deduction Failed
   - Message: "Failed to deduct inventory"
   - Solution: Retry or contact support
```

## Monitoring & Analytics

### Metrics to Track
```
1. Forecast Orders
   - Count by period
   - Average items per order
   - Conversion to sales

2. Free Stock Sales
   - Count by period
   - Revenue from free stock
   - Profit margin

3. Inventory Health
   - Free stock percentage
   - Booked stock percentage
   - Dead stock (old forecast orders)

4. Sales Mix
   - % from customer orders
   - % from free stock
   - Trend over time
```
