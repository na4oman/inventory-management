import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { NextRequest, NextResponse } from 'next/server';

/**
 * PATCH /api/order-items/[id]/update
 * Update order item quantity and unit price
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { id: itemId } = await params;
    const { ordered_qty, unit_price } = body;

    if (!ordered_qty || !unit_price) {
      return NextResponse.json(
        createErrorResponse('Quantity and unit price are required'),
        { status: 400 }
      );
    }

    if (ordered_qty <= 0 || unit_price < 0) {
      return NextResponse.json(
        createErrorResponse('Quantity must be positive and price must be non-negative'),
        { status: 400 }
      );
    }

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

    // Update order item
    const { data: updatedItem, error: updateError } = await supabase
      .from('order_items')
      .update({
        ordered_qty,
        unit_price,
      })
      .eq('id', itemId)
      .select()
      .single();

    if (updateError || !updatedItem) {
      return NextResponse.json(
        createErrorResponse('Failed to update order item'),
        { status: 500 }
      );
    }

    // Fetch the order to recalculate total_amount
    const { data: orderItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderItem.order_id);

    if (!itemsError && orderItems) {
      const totalAmount = orderItems.reduce((sum, item) => {
        const qty = item.id === itemId ? ordered_qty : item.ordered_qty;
        const price = item.id === itemId ? unit_price : item.unit_price;
        return sum + (qty * price);
      }, 0);

      // Update order total_amount
      await supabase
        .from('orders')
        .update({ total_amount: totalAmount })
        .eq('id', orderItem.order_id);
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
