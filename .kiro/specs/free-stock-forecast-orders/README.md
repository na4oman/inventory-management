# Free Stock & Forecast Orders Feature

## Problem Statement

Currently, your system requires:
1. **All orders must have a customer** - Can't create planning/forecast orders
2. **All sales must come from customer orders** - Can't sell from free/unbooked inventory
3. **No distinction between booked and free stock** - Hard to manage inventory planning

This limits your ability to:
- Plan inventory purchases without customer commitment
- Sell products that aren't tied to specific customer orders
- Manage free stock separately from customer orders

## Solution Overview

We're implementing a system that allows:

### 1. Forecast Orders
- Create orders **without a customer** for planning purposes
- These orders don't book inventory
- Useful for: demand forecasting, inventory planning, stock reservations

### 2. Free Stock Management
- Track inventory that's **not booked to any customer**
- Formula: `free_stock = total_qty - booked_qty`
- Visible in product details and new "Free Stock" dashboard

### 3. Free Stock Sales
- Create sales **directly from free stock** without a customer order
- No need to create a customer order first
- Useful for: walk-in sales, direct inventory sales, B2B direct sales

## Key Concepts

### Order Types
```
Customer Order (existing)
├─ Has client_id
├─ Books inventory
└─ Can be converted to sales

Forecast Order (new)
├─ No client_id
├─ Doesn't book inventory
└─ Tracks planning/demand
```

### Sale Types
```
Customer Sale (existing)
├─ Has client_id
├─ Linked to order_items
└─ Deducts from booked inventory

Free Stock Sale (new)
├─ Optional client_id
├─ Not linked to orders
└─ Deducts from free inventory
```

### Inventory Calculation
```
Total Quantity = qty (in database)
Booked Quantity = booked_qty (reserved for customer orders)
Free Quantity = qty - booked_qty (available for free stock sales)
```

## User Workflows

### Workflow 1: Create a Forecast Order
```
1. Go to Orders → New Order
2. Check "Create as Forecast Order"
3. Add items (products and quantities)
4. Save
→ Order created without customer
→ Inventory NOT booked
→ Shows as "Forecast Order" in list
```

### Workflow 2: Create a Free Stock Sale
```
1. Go to Sales → New Sale
2. Select "From Free Stock" tab
3. Search and select products
4. Enter quantities (limited to free stock)
5. Enter unit prices
6. Optional: Select customer
7. Save
→ Sale created from free inventory
→ Inventory deducted
→ Shows as "Free Stock Sale" in list
```

### Workflow 3: Check Free Stock
```
1. Go to Products
2. View "Free Stock" column
3. Or go to Free Stock dashboard
→ See all products with available free stock
→ Use for planning and sales
```

## Database Changes

### New/Modified Fields

**orders table**
- `client_id`: Now nullable (was required)
- `order_type`: New field ('customer' or 'forecast')

**sales table**
- `client_id`: Now nullable (was required)
- `sale_type`: New field ('customer' or 'free_stock')

**sale_items table**
- `order_item_id`: Now nullable (was required)

### Migration
```sql
-- Make client_id nullable
ALTER TABLE orders ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE sales ALTER COLUMN client_id DROP NOT NULL;

-- Add new fields
ALTER TABLE orders ADD COLUMN order_type VARCHAR(20) DEFAULT 'customer';
ALTER TABLE sales ADD COLUMN sale_type VARCHAR(20) DEFAULT 'customer';

-- Make order_item_id nullable
ALTER TABLE sale_items ALTER COLUMN order_item_id DROP NOT NULL;
```

## API Changes

### New Endpoints

**POST /api/sales/from-free-stock**
- Create a sale from free stock
- Request: `{ client_id?, items: [{product_id, quantity, unit_price}], notes? }`
- Response: Sale object with `sale_type: 'free_stock'`

**GET /api/free-stock**
- Get products with free stock
- Query: `?search=&page=1&pageSize=10`
- Response: Products with `free_qty` calculated

### Updated Endpoints

**POST /api/orders**
- `client_id` now optional
- Auto-detects `order_type` from client_id presence
- Forecast orders don't book inventory

**POST /api/sales** (existing)
- Still works for customer order sales
- `client_id` now optional (for future flexibility)

## UI Changes

### Order Creation
- Add checkbox: "Create as Forecast Order"
- Make client selection optional
- Show warning for forecast orders

### Sales Creation
- Add tabs: "From Customer Order" | "From Free Stock"
- Free Stock tab shows available products
- Can optionally select customer

### Product Display
- Show free_qty in product list
- Show breakdown: total_qty, booked_qty, free_qty
- Add "Free Stock" badge

### Dashboards
- Add "Forecast Orders" section
- Add "Free Stock Sales" section
- Add "Free Stock" widget showing available inventory

## Implementation Phases

### Phase 1: Forecast Orders (2-3 days)
- Make orders.client_id nullable
- Add orders.order_type field
- Update order creation API
- Update UI to support forecast orders
- **Result**: Can create orders without customers

### Phase 2: Free Stock Sales (3-4 days)
- Make sales.client_id nullable
- Add sales.sale_type field
- Create /api/sales/from-free-stock endpoint
- Create /api/free-stock endpoint
- Update sales creation UI
- **Result**: Can create sales from free stock

### Phase 3: Advanced Features (Optional, 4-5 days)
- Free stock allocation tracking
- Forecast analytics
- Inventory planning dashboard
- Stock movement reports

## Benefits

| Benefit | Impact |
|---------|--------|
| Forecast Orders | Better inventory planning without customer commitment |
| Free Stock Visibility | Know exactly what inventory is available |
| Direct Sales | Sell products without creating customer orders first |
| Better Analytics | Distinguish between customer and forecast orders |
| Inventory Optimization | Reduce dead stock, improve turnover |

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Null client_id breaks logic | Add null checks, comprehensive testing |
| Inventory deduction errors | Test all scenarios, gradual rollout |
| User confusion | Clear UI labels, documentation, training |
| Data migration issues | Backup before migration, test on staging |

## Timeline

- **Phase 1**: 2-3 days
- **Phase 2**: 3-4 days
- **Phase 3**: 4-5 days (optional)
- **Total**: 1-2 weeks for full implementation

## Next Steps

1. Review this design with your team
2. Approve database schema changes
3. Start Phase 1 implementation
4. Test thoroughly before Phase 2
5. Gather user feedback and iterate

## Questions?

Refer to:
- `DESIGN.md` - Detailed technical design
- `IMPLEMENTATION.md` - Step-by-step implementation guide
- Database schema changes in migration files
