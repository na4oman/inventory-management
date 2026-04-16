import { supabaseServer as supabase } from '@/lib/supabase/server';
import { updateOrderItemSchema } from '@/lib/validations/order';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { NextRequest, NextResponse } from 'next/server';
import { updateOrderStatusIfNeeded } from '@/lib/utils/orderStatusManager';

/**
 * PATCH /api/order-items/[id]
 * Update order item status and received quantity
 * 
 * Allows marking items as received and tracking received quantity
 * Automatically updates order status when all items are received/shipped
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { id: itemId } = await params;

    // Validate request body
    const validationResult = updateOrderItemSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        createErrorResponse(firstError?.message || 'Validation failed'),
        { status: 400 }
      );
    }

    const { received_qty, status } = validationResult.data;

    // Fetch current order item
    const { data: orderItem, error: fetchError } = await supabase
      .from('order_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (fetchError || !orderItem) {
      return NextResponse.json(
        createErrorResponse('Order item not found'),
        { status: 404 }
      );
    }

    // Validate received_qty doesn't exceed ordered_qty
    if (received_qty !== undefined && received_qty > orderItem.ordered_qty) {
      return NextResponse.json(
        createErrorResponse(
          `Received quantity (${received_qty}) cannot exceed ordered quantity (${orderItem.ordered_qty})`
        ),
        { status: 400 }
      );
    }

    // Validate shipped_qty doesn't exceed received_qty
    if (received_qty !== undefined && orderItem.shipped_qty > received_qty) {
      return NextResponse.json(
        createErrorResponse(
          `Cannot reduce received quantity below shipped quantity (${orderItem.shipped_qty})`
        ),
        { status: 400 }
      );
    }

    // Update order item
    const updateData: any = {};
    if (received_qty !== undefined) {
      updateData.received_qty = received_qty;
    }
    if (status) {
      updateData.status = status;
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from('order_items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    if (updateError || !updatedItem) {
      return NextResponse.json(
        createErrorResponse('Failed to update order item'),
        { status: 500 }
      );
    }

    // Fetch all items for this order to check if status should be updated
    const { data: allItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderItem.order_id);

    if (!itemsError && allItems && allItems.length > 0) {
      // Update the current item in the list
      const updatedItems = allItems.map(item => 
        item.id === itemId ? updatedItem : item
      );

      // Check if order status should be updated
      await updateOrderStatusIfNeeded(orderItem.order_id, updatedItems);
    }

    return NextResponse.json(createSuccessResponse(updatedItem));
  } catch (error) {
    console.error('Error updating order item:', error);
    return NextResponse.json(
      createErrorResponse('Failed to update order item'),
      { status: 500 }
    );
  }
}
