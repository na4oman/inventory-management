# Visual Guide: Free Stock & Forecast Orders

## System Overview Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     INVENTORY MANAGEMENT SYSTEM                     │
└─────────────────────────────────────────────────────────────────────┘

                            PRODUCTS
                         ┌──────────┐
                         │ Qty: 100 │
                         └──────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
              ┌─────▼─────┐      ┌─────▼─────┐
              │  BOOKED   │      │    FREE   │
              │  Qty: 60  │      │  Qty: 40  │
              └─────┬─────┘      └─────┬─────┘
                    │                   │
         ┌──────────▼──────────┐   ┌────▼──────────┐
         │  CUSTOMER ORDERS    │   │ FORECAST ORDERS
         │  (Linked to Client) │   │ (No Client)
         └──────────┬──────────┘   └────┬──────────┘
                    │                   │
         ┌──────────▼──────────┐   ┌────▼──────────┐
         │  CUSTOMER SALES     │   │ FREE STOCK    │
         │  (From Orders)      │   │ SALES (NEW)   │
         └─────────────────────┘   └───────────────┘
```

## Order Types Comparison

```
┌─────────────────────────────────────────────────────────────┐
│                    ORDER TYPES                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CUSTOMER ORDER              FORECAST ORDER (NEW)          │
│  ═══════════════              ═══════════════════          │
│  ✓ Has client_id             ✗ No client_id              │
│  ✓ Books inventory           ✗ Doesn't book inventory    │
│  ✓ Can be converted to sale  ✓ For planning only         │
│  ✓ Tracks customer demand    ✓ Tracks forecasted demand │
│                                                             │
│  Example:                    Example:                      │
│  Order for ABC Corp          Forecast for Q2 demand       │
│  50 units @ $100             100 units @ $100             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Sales Types Comparison

```
┌─────────────────────────────────────────────────────────────┐
│                    SALES TYPES                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CUSTOMER SALE               FREE STOCK SALE (NEW)         │
│  ══════════════              ═══════════════════           │
│  ✓ Has client_id             ✗ Optional client_id         │
│  ✓ From order_items          ✓ Direct from products      │
│  ✓ Deducts booked inventory  ✓ Deducts free inventory    │
│  ✓ Fulfills customer order   ✓ Direct inventory sale     │
│                                                             │
│  Example:                    Example:                      │
│  Fulfilling ABC Corp order   Walk-in customer purchase    │
│  10 units @ $120             5 units @ $120               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Inventory Flow

```
                        PRODUCT INVENTORY
                              │
                    ┌─────────┴─────────┐
                    │                   │
              ┌─────▼─────┐      ┌─────▼─────┐
              │  BOOKED   │      │    FREE   │
              │  (60 qty) │      │  (40 qty) │
              └─────┬─────┘      └─────┬─────┘
                    │                   │
        ┌───────────▼───────────┐   ┌───▼──────────────┐
        │  CUSTOMER ORDERS      │   │  FORECAST ORDERS │
        │  (Reserves inventory) │   │  (Planning only) │
        └───────────┬───────────┘   └───┬──────────────┘
                    │                   │
        ┌───────────▼───────────┐   ┌───▼──────────────┐
        │  CUSTOMER SALES       │   │  FREE STOCK SALES│
        │  (Fulfills orders)    │   │  (Direct sales)  │
        └───────────┬───────────┘   └───┬──────────────┘
                    │                   │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │  INVENTORY DEDUCTED
                    │  (Qty reduced)
                    └───────────────────┘
```

## User Journey: Create Forecast Order

```
START
  │
  ├─→ Go to Orders
  │
  ├─→ Click "New Order"
  │
  ├─→ Check "Create as Forecast Order"
  │   (Client field becomes optional)
  │
  ├─→ Add Items
  │   ├─ Product: Select product
  │   ├─ Quantity: Enter quantity
  │   └─ Price: Enter unit price
  │
  ├─→ Click "Create Order"
  │
  ├─→ Order Created ✓
  │   ├─ order_type = 'forecast'
  │   ├─ client_id = null
  │   ├─ Inventory NOT booked
  │   └─ Shows in "Forecast Orders" section
  │
  END
```

## User Journey: Create Free Stock Sale

```
START
  │
  ├─→ Go to Sales
  │
  ├─→ Click "New Sale"
  │
  ├─→ Select "From Free Stock" Tab
  │   (Different from "From Customer Order")
  │
  ├─→ Optional: Select Customer
  │   (Can leave empty for walk-in sales)
  │
  ├─→ Search & Select Products
  │   ├─ Search for product
  │   ├─ View available free_qty
  │   └─ Select product
  │
  ├─→ Enter Sale Details
  │   ├─ Quantity (limited to free_qty)
  │   ├─ Unit Price
  │   └─ Notes (optional)
  │
  ├─→ Click "Create Sale"
  │
  ├─→ Sale Created ✓
  │   ├─ sale_type = 'free_stock'
  │   ├─ Inventory deducted
  │   └─ Shows in "Free Stock Sales" section
  │
  END
```

## Inventory Calculation Flowchart

```
                    PRODUCT RECORD
                         │
                    ┌────┴────┐
                    │          │
              ┌─────▼──┐  ┌────▼─────┐
              │   qty  │  │booked_qty │
              │  (100) │  │   (60)    │
              └────────┘  └───────────┘
                    │          │
                    └────┬─────┘
                         │
                    ┌────▼──────────┐
                    │  CALCULATION  │
                    │ free_qty =    │
                    │ qty - booked  │
                    │ 100 - 60 = 40 │
                    └────┬──────────┘
                         │
                    ┌────▼──────────┐
                    │  RESULT       │
                    │ free_qty = 40 │
                    │ (Available)   │
                    └───────────────┘
```

## Database Schema Changes

```
BEFORE                          AFTER
──────                          ─────

orders                          orders
├─ id                           ├─ id
├─ order_number                 ├─ order_number
├─ client_id (NOT NULL) ──────→ ├─ client_id (NULL) ✓
├─ status                       ├─ order_type (NEW) ✓
├─ total_amount                 ├─ status
├─ notes                        ├─ total_amount
├─ created_at                   ├─ notes
└─ updated_at                   ├─ created_at
                                └─ updated_at

sales                           sales
├─ id                           ├─ id
├─ sale_number                  ├─ sale_number
├─ client_id (NOT NULL) ──────→ ├─ client_id (NULL) ✓
├─ total_amount                 ├─ sale_type (NEW) ✓
├─ total_cost                   ├─ total_amount
├─ profit                       ├─ total_cost
├─ notes                        ├─ profit
├─ sale_date                    ├─ notes
└─ created_at                   ├─ sale_date
                                └─ created_at

sale_items                      sale_items
├─ id                           ├─ id
├─ sale_id                      ├─ sale_id
├─ order_item_id (NOT NULL) ──→ ├─ order_item_id (NULL) ✓
├─ product_id                   ├─ product_id
├─ quantity                     ├─ quantity
├─ unit_price                   ├─ unit_price
├─ unit_cost                    ├─ unit_cost
├─ subtotal                     ├─ subtotal
├─ cost_total                   ├─ cost_total
├─ profit                       ├─ profit
└─ created_at                   └─ created_at
```

## API Endpoints Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    API ENDPOINTS                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  EXISTING (Updated)                                        │
│  ═══════════════════                                       │
│  POST /api/orders                                          │
│    └─ Now: client_id optional, auto-detects order_type   │
│                                                             │
│  POST /api/sales                                           │
│    └─ Now: Backward compatible, unchanged behavior        │
│                                                             │
│  NEW                                                       │
│  ═══                                                       │
│  POST /api/sales/from-free-stock                          │
│    └─ Create sale from free stock inventory              │
│                                                             │
│  GET /api/free-stock                                       │
│    └─ Get products with available free stock             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Feature Rollout Timeline

```
PHASE 1: FORECAST ORDERS
├─ Duration: 2-3 days
├─ Changes:
│  ├─ Make orders.client_id nullable
│  ├─ Add orders.order_type field
│  ├─ Update order creation API
│  └─ Update UI
└─ Result: Can create orders without customers ✓

PHASE 2: FREE STOCK SALES
├─ Duration: 3-4 days
├─ Changes:
│  ├─ Make sales.client_id nullable
│  ├─ Add sales.sale_type field
│  ├─ Create /api/sales/from-free-stock endpoint
│  ├─ Create /api/free-stock endpoint
│  └─ Update sales UI
└─ Result: Can create sales from free stock ✓

PHASE 3: ADVANCED FEATURES (Optional)
├─ Duration: 4-5 days
├─ Changes:
│  ├─ Free stock allocation tracking
│  ├─ Forecasting analytics
│  └─ Inventory planning dashboard
└─ Result: Advanced inventory management ✓

TOTAL: 1-2 weeks for full implementation
```

## Backward Compatibility

```
EXISTING DATA                   AFTER MIGRATION
──────────────                  ────────────────

All existing orders:            All existing orders:
├─ Have client_id              ├─ Have client_id
├─ Will get order_type         ├─ order_type = 'customer'
└─ Behavior unchanged          └─ Behavior unchanged ✓

All existing sales:             All existing sales:
├─ Have client_id              ├─ Have client_id
├─ Have order_item_id          ├─ Have order_item_id
├─ Will get sale_type          ├─ sale_type = 'customer'
└─ Behavior unchanged          └─ Behavior unchanged ✓

RESULT: 100% Backward Compatible ✓
```

## Risk vs. Benefit Matrix

```
                    LOW RISK          HIGH RISK
                    ────────          ────────

HIGH BENEFIT        ✓ THIS FEATURE    ✗ Avoid
                    ✓ Forecast Orders
                    ✓ Free Stock Sales

LOW BENEFIT         ✓ Consider        ✗ Avoid
                    ✓ Nice to have
```

## Success Criteria

```
BEFORE IMPLEMENTATION
├─ ✗ Can't create orders without customers
├─ ✗ Can't sell from free stock
├─ ✗ No visibility of free vs. booked stock
└─ ✗ Limited sales channels

AFTER IMPLEMENTATION
├─ ✓ Can create forecast orders
├─ ✓ Can create free stock sales
├─ ✓ Clear visibility of free stock
├─ ✓ Support multiple sales channels
├─ ✓ Better inventory management
└─ ✓ Improved business flexibility
```

## Key Metrics to Track

```
FORECAST ORDERS
├─ Count by period
├─ Average items per order
├─ Conversion to actual sales
└─ Forecast accuracy

FREE STOCK SALES
├─ Count by period
├─ Revenue from free stock
├─ Profit margin
└─ % of total sales

INVENTORY HEALTH
├─ Free stock percentage
├─ Booked stock percentage
├─ Dead stock (old forecasts)
└─ Inventory turnover
```

## Implementation Checklist

```
PHASE 1: FORECAST ORDERS
├─ [ ] Database migration
├─ [ ] API updates
├─ [ ] UI updates
├─ [ ] Testing
└─ [ ] Deployment

PHASE 2: FREE STOCK SALES
├─ [ ] Database migration
├─ [ ] API endpoints
├─ [ ] UI components
├─ [ ] Testing
└─ [ ] Deployment

PHASE 3: ADVANCED (Optional)
├─ [ ] Analytics
├─ [ ] Dashboard
├─ [ ] Reporting
└─ [ ] Documentation
```

---

**Visual Guide Complete!**

For detailed information, see:
- README.md - Feature overview
- DESIGN.md - Technical design
- IMPLEMENTATION.md - Step-by-step guide
- QUICK_REFERENCE.md - Quick lookup
