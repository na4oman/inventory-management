# Automatic Order Status Update - Quick Reference

## What Changed

The order status now **automatically updates** based on item fulfillment without requiring manual intervention.

## How It Works

### Status Update Triggers

1. **On Page Load**: When you open an order details page, the system checks if all items are fulfilled and updates the status automatically
2. **When Updating Items**: When you mark items as received/shipped, the status updates immediately
3. **On Order Conversion**: When converting an order to a sale, the status updates based on fulfillment

### Status Rules

| Condition | Order Status |
|-----------|--------------|
| All items received (received_qty ≥ ordered_qty) | `received` |
| All items shipped (shipped_qty ≥ ordered_qty) | `completed` |
| Any item still pending | `pending` |
| Mixed fulfillment | Based on highest level |

## Visual Indicators

The Order Details page now shows:

- **Received Progress Bar** (Blue): Shows % of items received
- **Shipped Progress Bar** (Green): Shows % of items shipped
- **Status Badge**: Yellow (pending), Blue (received), Green (completed)
- **Checkmarks**: Green ✓ when all items received/shipped

## Example: Order ORD00002

**Initial State:**
- Status: `pending`
- Items: 200 ordered, 0 received, 0 shipped

**After Marking All Items Received:**
- Status: **Automatically changes to `received`** ✅
- Progress: 100% received, 0% shipped
- Checkmark: "All items received" ✓

**After Marking All Items Shipped:**
- Status: **Automatically changes to `completed`** ✅
- Progress: 100% received, 100% shipped
- Checkmark: "All items shipped" ✓

## Key Features

✅ **Automatic**: No manual status updates needed  
✅ **Real-time**: Updates immediately when items change  
✅ **Accurate**: Always reflects true fulfillment state  
✅ **Visual**: Progress bars show fulfillment at a glance  
✅ **Notifications**: Toast alerts when status changes  
✅ **Persistent**: Changes saved to database with timestamps  

## For Developers

### Check Order Status on Load

```typescript
// Automatically called when order details page loads
useEffect(() => {
  if (order?.status === 'pending' && order?.items) {
    updateOrderStatusIfNeeded(orderId, order.items);
  }
}, [orderId]);
```

### Update Status After Item Change

```typescript
// Called when user updates an item
const newStatus = await updateOrderStatusIfNeeded(orderId, updatedItems);
if (newStatus) {
  toast.showSuccess('Order Status Updated', `Status changed to ${newStatus}`);
}
```

### Get Fulfillment Summary

```typescript
const summary = getOrderFulfillmentSummary(order.items);
// Returns:
// {
//   totalOrdered: 200,
//   totalReceived: 200,
//   totalShipped: 200,
//   fulfillmentPercentage: 100,
//   shippingPercentage: 100,
//   isFullyReceived: true,
//   isFullyShipped: true
// }
```

## Troubleshooting

### Status Not Updating?

1. **Refresh the page** - Status updates on page load
2. **Check item quantities** - Ensure received_qty ≥ ordered_qty
3. **Verify database** - Check order_items table directly
4. **Check browser console** - Look for error messages

### Status Shows Wrong Value?

1. **Clear browser cache** - Old data might be cached
2. **Refetch order** - Click refresh or navigate away and back
3. **Check timestamps** - Verify updated_at is recent

## Database Updates

When status changes, the following are updated:

```sql
UPDATE orders 
SET status = 'received', 
    updated_at = NOW() 
WHERE id = 'order-id';
```

The `updated_at` timestamp tracks when the status last changed.

## Next Steps

- Open an order with all items fulfilled
- The status should automatically update to `received` or `completed`
- You'll see a toast notification confirming the change
- The progress bars will show 100% fulfillment
