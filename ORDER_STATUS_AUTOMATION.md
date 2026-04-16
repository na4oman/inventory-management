# Order Status Automation

## Overview

The inventory management system now includes automatic order status updates based on item fulfillment. This ensures that order statuses are always accurate and reflect the current state of fulfillment.

## Status Transitions

### Order Status Values
- **pending**: Initial status when order is created
- **received**: All items have been received (received_qty >= ordered_qty for all items)
- **completed**: All items have been shipped (shipped_qty >= ordered_qty for all items)
- **cancelled**: Order has been cancelled (manual action)

### Automatic Status Update Rules

The system automatically updates order status based on the following rules:

1. **All Items Received** → Status becomes `received`
   - Triggered when: `received_qty >= ordered_qty` for ALL items
   - Example: Order with 3 items, all marked as received

2. **All Items Shipped** → Status becomes `completed`
   - Triggered when: `shipped_qty >= ordered_qty` for ALL items
   - Example: Order with 3 items, all marked as shipped

3. **Any Item Pending** → Status remains `pending`
   - Triggered when: Any item has status = 'pending'
   - Example: Order with 3 items, 2 received, 1 still pending

4. **Mixed Fulfillment** → Status based on highest fulfillment level
   - If some items received but not all → `pending`
   - If all received but not all shipped → `received`
   - If all shipped → `completed`

## Implementation Details

### Key Components

#### 1. Order Status Manager (`lib/utils/orderStatusManager.ts`)

Provides utility functions for managing order status:

```typescript
// Determine order status based on items
determineOrderStatus(items: OrderItem[]): 'pending' | 'received' | 'completed'

// Update order status if needed
updateOrderStatusIfNeeded(orderId: string, items: OrderItem[]): Promise<string | null>

// Calculate fulfillment percentage
calculateFulfillmentPercentage(items: OrderItem[]): number

// Calculate shipping percentage
calculateShippingPercentage(items: OrderItem[]): number

// Get fulfillment summary
getOrderFulfillmentSummary(items: OrderItem[]): FulfillmentSummary
```

#### 2. Order Details Page (`app/dashboard/orders/[id]/page.tsx`)

Enhanced with:
- Real-time fulfillment progress bars
- Automatic status updates when items are marked as received
- Visual indicators for fully received/shipped orders
- Toast notifications when status changes

#### 3. Convert Order Dialog (`components/orders/ConvertOrderDialog.tsx`)

Updated to:
- Automatically update order status after conversion
- Notify user of status changes
- Maintain data consistency

## User Experience

### When Updating Order Items

1. User marks items as received in the Order Details page
2. System updates the item's `received_qty` and `status`
3. System automatically checks if all items are now fulfilled
4. If fulfillment is complete, order status automatically changes to `received`
5. User sees a toast notification: "Order Status Updated: received"

### Fulfillment Progress Display

The Order Details page shows:
- **Received Progress Bar**: Visual representation of received items (blue)
- **Shipped Progress Bar**: Visual representation of shipped items (green)
- **Percentage Indicators**: Shows exact fulfillment percentage
- **Item Counts**: Shows "X / Y items" for clarity
- **Status Badges**: Green checkmarks when all items are received/shipped

### Example Scenarios

#### Scenario 1: Partial Fulfillment
- Order created with 3 items
- User marks 2 items as received
- Order status remains `pending`
- Progress bar shows 66% received

#### Scenario 2: Complete Fulfillment
- Order created with 3 items
- User marks all 3 items as received
- Order status automatically changes to `received`
- Toast notification: "Order Status Updated: received"
- Green checkmark appears: "All items received"

#### Scenario 3: Order Conversion
- Order with all items received (status = `received`)
- User converts order to sale
- System marks items as shipped
- Order status automatically changes to `completed`
- Toast notification: "Order Converted & Status Updated: completed"

## Database Schema

### Order Table
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  order_number VARCHAR UNIQUE NOT NULL,
  client_id UUID NOT NULL,
  status VARCHAR DEFAULT 'pending', -- pending, received, completed, cancelled
  total_amount DECIMAL NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Order Items Table
```sql
CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  product_id UUID NOT NULL,
  ordered_qty INTEGER NOT NULL,
  received_qty INTEGER DEFAULT 0,
  shipped_qty INTEGER DEFAULT 0,
  unit_price DECIMAL NOT NULL,
  status VARCHAR DEFAULT 'pending', -- pending, received, shipped
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## API Integration

### Updating Order Items

When updating an order item via the API:

```typescript
// Update item
await supabase
  .from('order_items')
  .update({ 
    received_qty: 5, 
    status: 'received',
    updated_at: new Date().toISOString()
  })
  .eq('id', itemId);

// Automatically check and update order status
const newStatus = await updateOrderStatusIfNeeded(orderId, updatedItems);
```

### Fetching Order with Fulfillment Summary

```typescript
const { data: order } = await supabase
  .from('orders')
  .select(`
    *,
    client:clients(*),
    items:order_items(*, product:products(*))
  `)
  .eq('id', orderId)
  .single();

const summary = getOrderFulfillmentSummary(order.items);
// Returns: {
//   totalOrdered: 10,
//   totalReceived: 7,
//   totalShipped: 3,
//   totalPending: 3,
//   fulfillmentPercentage: 70,
//   shippingPercentage: 30,
//   isFullyReceived: false,
//   isFullyShipped: false
// }
```

## Benefits

1. **Data Consistency**: Order status always reflects actual fulfillment state
2. **Reduced Manual Work**: No need to manually update order status
3. **Better Visibility**: Progress bars show fulfillment at a glance
4. **Accurate Reporting**: Analytics based on correct status values
5. **User Notifications**: Toast alerts keep users informed of status changes
6. **Audit Trail**: `updated_at` timestamps track when status changed

## Future Enhancements

Potential improvements for future versions:

1. **Webhook Notifications**: Send notifications when order status changes
2. **Email Alerts**: Notify clients when order status changes
3. **Bulk Status Updates**: Update multiple orders at once
4. **Status History**: Track all status changes with timestamps
5. **Custom Status Rules**: Allow users to define custom status transition rules
6. **Partial Fulfillment Handling**: Support for partial shipments
7. **Backorder Management**: Handle items that can't be fulfilled immediately

## Troubleshooting

### Order Status Not Updating

1. Check that `updated_at` timestamp is being set on items
2. Verify that `received_qty` is being updated correctly
3. Ensure order items are being fetched with the order
4. Check browser console for error messages

### Incorrect Fulfillment Percentage

1. Verify `ordered_qty` values are correct
2. Check that `received_qty` doesn't exceed `ordered_qty`
3. Ensure all items are included in the calculation
4. Clear browser cache and refresh

### Status Stuck on Pending

1. Check if any items still have `status = 'pending'`
2. Verify all items have `received_qty >= ordered_qty`
3. Check database directly for data consistency
4. Try manually updating an item to trigger status check
