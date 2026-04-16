/**
 * Order Status Manager
 * Handles automatic order status updates based on item fulfillment
 */

import { OrderItem } from '@/lib/types/database';
import { supabase } from '@/lib/supabase/client';

/**
 * Determines the order status based on item fulfillment
 * 
 * Rules:
 * - If all items are fully shipped (shipped_qty >= ordered_qty) -> order status = 'completed'
 * - If all items are fully received (received_qty >= ordered_qty) -> order status = 'received'
 * - Otherwise -> order status = 'pending'
 */
export function determineOrderStatus(items: OrderItem[]): 'pending' | 'received' | 'completed' | 'cancelled' {
  if (!items || items.length === 0) {
    return 'pending';
  }

  // Check if all items are fully shipped
  const allShipped = items.every((item) => item.shipped_qty >= item.ordered_qty);
  if (allShipped) {
    console.log('All items shipped - status: completed');
    return 'completed';
  }

  // Check if all items are fully received
  const allReceived = items.every((item) => item.received_qty >= item.ordered_qty);
  if (allReceived) {
    console.log('All items received - status: received');
    return 'received';
  }

  // Default to pending
  console.log('Some items pending - status: pending');
  return 'pending';
}

/**
 * Updates order status based on current item fulfillment
 * Called after updating order items or converting to sale
 */
export async function updateOrderStatusIfNeeded(
  orderId: string,
  items: OrderItem[]
): Promise<'pending' | 'received' | 'completed' | 'cancelled' | null> {
  try {
    const newStatus = determineOrderStatus(items);
    console.log('Determined new status:', newStatus);

    // Fetch current order status
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      console.error('Failed to fetch order:', fetchError);
      return null;
    }

    console.log('Current order status:', order.status, 'New status:', newStatus);

    // Only update if status has changed
    if (order.status !== newStatus) {
      console.log('Status changed, updating order...');
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (updateError) {
        console.error('Failed to update order status:', updateError);
        return null;
      }

      console.log('Order status updated successfully to:', newStatus);
      return newStatus;
    }

    console.log('Status unchanged, no update needed');
    return null;
  } catch (error) {
    console.error('Error updating order status:', error);
    return null;
  }
}

/**
 * Calculates fulfillment percentage for an order
 */
export function calculateFulfillmentPercentage(items: OrderItem[]): number {
  if (!items || items.length === 0) return 0;

  const totalOrdered = items.reduce((sum, item) => sum + item.ordered_qty, 0);
  const totalReceived = items.reduce((sum, item) => sum + item.received_qty, 0);

  if (totalOrdered === 0) return 0;
  return Math.round((totalReceived / totalOrdered) * 100);
}

/**
 * Calculates shipping percentage for an order
 */
export function calculateShippingPercentage(items: OrderItem[]): number {
  if (!items || items.length === 0) return 0;

  const totalOrdered = items.reduce((sum, item) => sum + item.ordered_qty, 0);
  const totalShipped = items.reduce((sum, item) => sum + item.shipped_qty, 0);

  if (totalOrdered === 0) return 0;
  return Math.round((totalShipped / totalOrdered) * 100);
}

/**
 * Gets a summary of order fulfillment status
 */
export function getOrderFulfillmentSummary(items: OrderItem[]) {
  const totalOrdered = items.reduce((sum, item) => sum + item.ordered_qty, 0);
  const totalReceived = items.reduce((sum, item) => sum + item.received_qty, 0);
  const totalShipped = items.reduce((sum, item) => sum + item.shipped_qty, 0);
  const totalPending = totalOrdered - totalReceived;

  const fulfillmentPercentage = calculateFulfillmentPercentage(items);
  const shippingPercentage = calculateShippingPercentage(items);

  return {
    totalOrdered,
    totalReceived,
    totalShipped,
    totalPending,
    fulfillmentPercentage,
    shippingPercentage,
    isFullyReceived: totalReceived >= totalOrdered,
    isFullyShipped: totalShipped >= totalOrdered,
  };
}
