import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { NextRequest, NextResponse } from 'next/server';

/**
 * DELETE /api/order-items/[id]/delete
 * Delete an order item and update order total
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: itemId } = await params;

    // Fetch the order item
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

    const orderId = orderItem.order_id;

    // Delete the order item
    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('id', itemId);

    if (deleteError) {
      return NextResponse.json(
        createErrorResponse('Failed to delete order item'),
        { status: 500 }
      );
    }

    // Recalculate order total_amount
    const { data: remainingItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (!itemsError) {
      const totalAmount = remainingItems?.reduce((sum, item) => sum + (item.ordered_qty * item.unit_price), 0) || 0;

      // Update order total_amount
      await supabase
        .from('orders')
        .update({ total_amount: totalAmount })
        .eq('id', orderId);
    }

    return NextResponse.json(createSuccessResponse({ success: true }));
  } catch (error) {
    console.error('Error deleting order item:', error);
    return NextResponse.json(
      createErrorResponse('Failed to delete order item'),
      { status: 500 }
    );
  }
}
