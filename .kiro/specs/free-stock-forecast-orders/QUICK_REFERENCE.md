# Quick Reference Guide

## What's Changing?

### Before
- ❌ Orders MUST have a customer
- ❌ Sales MUST come from customer orders
- ❌ Can't distinguish free vs. booked stock

### After
- ✅ Orders can be created without a customer (Forecast Orders)
- ✅ Sales can come directly from free stock (Free Stock Sales)
- ✅ Clear visibility of free vs. booked inventory

---

## Key Terms

| Term | Definition | Example |
|------|-----------|---------|
| **Customer Order** | Order linked to a specific customer | Order for ABC Corp |
| **Forecast Order** | Order for planning, no customer | Demand forecast for Q2 |
| **Free Stock** | Inventory not booked to any customer | 40 units available |
| **Booked Stock** | Inventory reserved for customer orders | 60 units reserved |
| **Customer Sale** | Sale from a customer order | Fulfilling ABC Corp order |
| **Free Stock Sale** | Sale directly from inventory | Walk-in customer purchase |

---

## Database Changes at a Glance

### orders table
```
BEFORE: client_id (required)
AFTER:  client_id (optional) + order_type field

order_type values:
- 'customer' = linked to client
- 'forecast' = no client, for planning
```

### sales table
```
BEFORE: client_id (required), order_item_id (required)
AFTER:  client_id (optional), order_item_id (optional), sale_type field

sale_type values:
- 'customer' = from order_items
- 'free_stock' = direct from products
```

---

## API Quick Reference

### Create Forecast Order
```bash
POST /api/orders
{
  "items": [{"product_id": "...", "ordered_qty": 50}],
  "notes": "Q2 forecast"
}
# No client_id needed!
```

### Create Free Stock Sale
```bash
POST /api/sales/from-free-stock
{
  "items": [{"product_id": "...", "quantity": 10, "unit_price": 120}],
  "client_id": "optional"
}
```

### Get Free Stock Products
```bash
GET /api/free-stock?search=&page=1&pageSize=10
# Returns products with free_qty > 0
```

---

## Inventory Calculation

```
Total Quantity (qty)
    ↓
    ├─→ Booked (booked_qty)
    │   └─→ Reserved for customer orders
    │
    └─→ Free (free_qty)
        └─→ free_qty = qty - booked_qty
        └─→ Available for free stock sales
```

---

## User Workflows

### Workflow 1: Create Forecast Order
```
1. Orders → New Order
2. ☑ "Create as Forecast Order"
3. Add items
4. Save
→ Order created, inventory NOT booked
```

### Workflow 2: Create Free Stock Sale
```
1. Sales → New Sale
2. Select "From Free Stock" tab
3. Search products
4. Enter quantity (limited to free_qty)
5. Enter price
6. Optional: Select customer
7. Save
→ Sale created, inventory deducted
```

### Workflow 3: Check Free Stock
```
1. Products page
2. View "Free Stock" column
3. Or: Free Stock dashboard
→ See all available inventory
```

---

## Validation Rules

### Creating Orders
```
✓ If client_id provided:
  - order_type = 'customer'
  - Inventory booked
  
✓ If NO client_id:
  - order_type = 'forecast'
  - Inventory NOT booked
  
✗ If neither:
  - Error: "Either client_id or order_type='forecast' required"
```

### Creating Sales
```
Customer Sale:
✓ client_id required
✓ From order_items
✓ received_qty >= quantity

Free Stock Sale:
✓ client_id optional
✓ From products
✓ free_qty >= quantity
```

---

## Common Questions

### Q: What's the difference between Forecast Order and Free Stock Sale?

**Forecast Order:**
- For planning/demand forecasting
- Doesn't book inventory
- Tracks expected demand
- Can be converted to sales later

**Free Stock Sale:**
- For actual sales
- Deducts inventory immediately
- Can have optional customer
- Generates revenue

### Q: Can I convert a Forecast Order to a Sale?

Not directly in Phase 1. You would:
1. Create a Forecast Order (planning)
2. Later, create a Free Stock Sale (actual sale)
3. They're separate transactions

Future enhancement: Direct conversion option.

### Q: What happens to existing orders and sales?

**Backward Compatible:**
- All existing orders: order_type = 'customer' (default)
- All existing sales: sale_type = 'customer' (default)
- Behavior unchanged
- No migration needed

### Q: Can I create a sale without a customer?

**Yes!** With Free Stock Sales:
- client_id is optional
- Useful for: walk-in sales, direct inventory sales
- Still tracks revenue and profit

### Q: How do I know how much free stock I have?

**Three ways:**
1. Product page: View "Free Stock" column
2. Free Stock dashboard: See all available inventory
3. API: GET /api/free-stock

Formula: `free_qty = total_qty - booked_qty`

### Q: What if I sell more than available free stock?

**Validation prevents it:**
- System checks: `free_qty >= requested_quantity`
- Error message shows available quantity
- Sale is rejected

### Q: Can I book inventory for Forecast Orders?

**No.** Forecast Orders don't book inventory by design:
- They're for planning only
- Inventory stays available
- When you actually sell, use Free Stock Sale

---

## Implementation Timeline

| Phase | Duration | What's New |
|-------|----------|-----------|
| Phase 1 | 2-3 days | Forecast Orders |
| Phase 2 | 3-4 days | Free Stock Sales |
| Phase 3 | 4-5 days | Advanced features (optional) |

---

## Rollout Checklist

### Before Deployment
- [ ] Database migration tested
- [ ] API endpoints tested
- [ ] UI components tested
- [ ] Backward compatibility verified
- [ ] Backup created

### After Deployment
- [ ] Monitor error logs
- [ ] Gather user feedback
- [ ] Fix any issues
- [ ] Document for users

---

## Troubleshooting

### Issue: "Insufficient free stock"
**Solution:** Check available free_qty
```
free_qty = total_qty - booked_qty
```

### Issue: Forecast order booked inventory
**Solution:** Verify order_type = 'forecast'
```
If order_type = 'customer': inventory is booked
If order_type = 'forecast': inventory is NOT booked
```

### Issue: Can't create sale without customer
**Solution:** Use Free Stock Sale endpoint
```
POST /api/sales/from-free-stock (client_id optional)
```

### Issue: Old data showing wrong values
**Solution:** Verify migration completed
```
Check: orders.order_type and sales.sale_type populated
```

---

## Performance Tips

### For Free Stock Sales
- Use GET /api/free-stock to show available products
- Filter by free_qty > 0
- Cache results for 5-10 minutes

### For Forecast Orders
- Use GET /api/orders?order_type=forecast
- Filter by date range for analytics
- Archive old forecast orders

### For Inventory Queries
- Use indexes on: order_type, sale_type, booked_qty
- Calculate free_qty on-the-fly (qty - booked_qty)
- Cache product availability

---

## Documentation Links

- **Full Design**: See `DESIGN.md`
- **Implementation Steps**: See `IMPLEMENTATION.md`
- **Architecture Details**: See `ARCHITECTURE.md`
- **System Overview**: See `README.md`

---

## Support

For questions or issues:
1. Check this Quick Reference
2. Review relevant documentation
3. Check error logs
4. Contact development team

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-01-15 | Initial design |
| 1.1 | 2024-01-16 | Added quick reference |

---

## Key Takeaways

✅ **Forecast Orders** = Planning without customers
✅ **Free Stock** = Inventory not booked to customers
✅ **Free Stock Sales** = Direct sales from available inventory
✅ **Backward Compatible** = Existing orders/sales unchanged
✅ **Better Inventory Management** = Clear visibility of available stock

**Result**: More flexible order and sales management with better inventory visibility!
