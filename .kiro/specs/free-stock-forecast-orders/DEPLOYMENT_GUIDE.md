# Deployment Guide: Phase 1 - Forecast Orders

## Overview

Phase 1 implementation is complete. This guide walks you through deploying the forecast orders feature to production.

## Pre-Deployment Checklist

- [ ] All code changes reviewed
- [ ] No TypeScript errors (verified)
- [ ] Database backup created
- [ ] Migration tested on staging
- [ ] Manual testing completed
- [ ] Team notified

## Deployment Steps

### Step 1: Database Migration (5 minutes)

Execute this SQL on your Supabase database:

```sql
-- Step 1: Make client_id nullable
ALTER TABLE orders ALTER COLUMN client_id DROP NOT NULL;

-- Step 2: Add order_type column
ALTER TABLE orders ADD COLUMN order_type VARCHAR(20) DEFAULT 'customer';

-- Step 3: Create index for performance
CREATE INDEX idx_orders_order_type ON orders(order_type);

-- Step 4: Backfill existing data
UPDATE orders SET order_type = 'customer' WHERE order_type IS NULL;

-- Step 5: Verify migration
SELECT COUNT(*) as total, 
       COUNT(CASE WHEN order_type IS NULL THEN 1 END) as null_count
FROM orders;
-- Expected: total = X, null_count = 0
```

**Verification**: The SELECT should show `null_count = 0`, meaning all orders have order_type set.

### Step 2: Deploy Code (5 minutes)

```bash
# 1. Commit all changes
git add .
git commit -m "feat: implement forecast orders (Phase 1)"

# 2. Push to main branch
git push origin main

# 3. Deploy to production
# (Use your deployment process - Vercel, GitHub Actions, etc.)
```

### Step 3: Verify Deployment (10 minutes)

1. **Check Application**
   - Navigate to `/dashboard/orders`
   - Click "New Order"
   - Verify "Create as Forecast Order" checkbox appears
   - Verify client field is optional

2. **Test Forecast Order Creation**
   - Check "Create as Forecast Order"
   - Add items
   - Click "Create Order"
   - Verify order created successfully

3. **Test Customer Order Creation**
   - Uncheck "Create as Forecast Order"
   - Select a client
   - Add items
   - Click "Create Order"
   - Verify order created successfully

4. **Check Error Logs**
   - Monitor error logs for any issues
   - Check browser console for errors
   - Check server logs

### Step 4: Post-Deployment Verification (10 minutes)

```sql
-- Verify database state
SELECT 
  COUNT(*) as total_orders,
  COUNT(CASE WHEN order_type = 'customer' THEN 1 END) as customer_orders,
  COUNT(CASE WHEN order_type = 'forecast' THEN 1 END) as forecast_orders,
  COUNT(CASE WHEN client_id IS NULL THEN 1 END) as null_clients
FROM orders;

-- Expected: 
-- total_orders = X
-- customer_orders = X (all existing orders)
-- forecast_orders = 0 (or number of new forecast orders created)
-- null_clients = 0 (or number of forecast orders)
```

## Rollback Plan

If critical issues occur:

### Option 1: Quick Rollback (Code Only)

```bash
# Revert code changes
git revert <commit-hash>
git push origin main

# Redeploy previous version
# (Use your deployment process)
```

**Note**: Database changes remain. This is safe because:
- New columns have defaults
- Existing orders still work
- No data loss

### Option 2: Full Rollback (Code + Database)

```sql
-- Remove new columns
ALTER TABLE orders DROP COLUMN order_type;
DROP INDEX idx_orders_order_type;

-- Make client_id NOT NULL again
ALTER TABLE orders ALTER COLUMN client_id SET NOT NULL;
```

Then revert code as above.

## Monitoring

### What to Monitor

1. **Error Logs**
   - Check for "Failed to create order" errors
   - Check for validation errors
   - Check for database errors

2. **User Feedback**
   - Ask team if forecast orders work
   - Ask if any issues encountered
   - Gather suggestions

3. **Performance**
   - Monitor database query performance
   - Check API response times
   - Monitor server resources

### Key Metrics

- Orders created per day
- Forecast orders created per day
- Error rate
- API response time

## User Communication

### Announcement

```
📢 New Feature: Forecast Orders

We've added support for forecast orders! You can now create orders without assigning them to a specific customer. This is useful for:

✓ Demand forecasting
✓ Inventory planning
✓ Stock reservations

How to use:
1. Go to Orders → New Order
2. Check "Create as Forecast Order"
3. Add items
4. Click "Create Order"

Forecast orders don't book inventory and are for planning purposes only.

Questions? Contact the development team.
```

### Training

1. **Quick Demo** (5 minutes)
   - Show how to create forecast order
   - Show how it appears in list
   - Explain use cases

2. **Documentation**
   - Share QUICK_REFERENCE.md
   - Share README.md
   - Answer questions

## Success Criteria

✅ Deployment is successful when:

1. **Functionality**
   - Forecast orders can be created
   - Forecast orders appear in list with badge
   - Customer orders still work
   - No errors in logs

2. **Data Integrity**
   - All orders have order_type set
   - Existing orders unchanged
   - No data loss

3. **User Experience**
   - Users understand how to create forecast orders
   - UI is intuitive
   - No confusion with existing features

4. **Performance**
   - No performance degradation
   - API response times normal
   - Database queries fast

## Timeline

| Step | Duration | Status |
|------|----------|--------|
| Database Migration | 5 min | ⏳ Pending |
| Code Deployment | 5 min | ⏳ Pending |
| Verification | 10 min | ⏳ Pending |
| Post-Deployment Check | 10 min | ⏳ Pending |
| **Total** | **30 min** | ⏳ Pending |

## Troubleshooting

### Issue: "Either client_id or order_type='forecast' is required"

**Cause**: Validation error - neither client_id nor order_type provided

**Solution**: 
- Either select a client OR check "Create as Forecast Order"
- Don't leave both empty

### Issue: Forecast order doesn't appear in list

**Cause**: Page not refreshed or order not created

**Solution**:
- Refresh the page
- Check browser console for errors
- Check server logs

### Issue: Client field still shows when forecast checked

**Cause**: UI state not updated

**Solution**:
- Refresh the page
- Clear browser cache
- Check browser console for errors

### Issue: Database migration fails

**Cause**: Various possible causes

**Solution**:
- Check Supabase logs
- Verify SQL syntax
- Try migration on staging first
- Contact Supabase support if needed

## Support

For deployment issues:
1. Check this guide
2. Check error logs
3. Review IMPLEMENTATION_STATUS.md
4. Contact development team

## Next Steps

After successful deployment:

1. **Gather Feedback** (1-2 days)
   - Ask users about experience
   - Collect suggestions
   - Note any issues

2. **Monitor** (1 week)
   - Watch error logs
   - Track usage
   - Monitor performance

3. **Plan Phase 2** (1 week)
   - Review Phase 2 requirements
   - Plan implementation
   - Schedule development

## Rollout Timeline

- **Day 1**: Deploy to production
- **Day 2-3**: Monitor and gather feedback
- **Day 4-7**: Fix any issues, plan Phase 2
- **Week 2**: Start Phase 2 implementation

---

**Ready for Deployment**: ✅ Yes
**Estimated Duration**: 30 minutes
**Risk Level**: Low (backward compatible)
**Rollback Difficulty**: Easy
