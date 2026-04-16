import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * PATCH /api/order-items/[id]/tracking
 * Update forwarded_qty or wh_qty on an order item.
 * When wh_qty changes, also syncs the product's qty field.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(createErrorResponse('Unauthorized'), { status: 401 });
  }

  try {
    const { id: itemId } = await params;
    const body = await request.json();
    const { forwarded_qty, wh_qty } = body;

    if (forwarded_qty === undefined && wh_qty === undefined) {
      return NextResponse.json(
        createErrorResponse('forwarded_qty or wh_qty is required'),
        { status: 400 }
      );
    }

    const updateData: Record<string, number> = {};
    if (forwarded_qty !== undefined) updateData.forwarded_qty = forwarded_qty;
    if (wh_qty !== undefined) updateData.wh_qty = wh_qty;

    const { data: updatedItem, error } = await supabase
      .from('order_items')
      .update(updateData)
      .eq('id', itemId)
      .select('*, product_id')
      .single();

    if (error || !updatedItem) {
      return NextResponse.json(createErrorResponse('Order item not found'), { status: 404 });
    }

    // If wh_qty changed, sync product qty from all order items
    if (wh_qty !== undefined && updatedItem.product_id) {
      const { data: allOrderItems } = await supabase
        .from('order_items')
        .select('id, wh_qty')
        .eq('product_id', updatedItem.product_id);

      const totalWhQty = (allOrderItems || []).reduce(
        (sum, oi) => sum + (oi.id === itemId ? wh_qty : (oi.wh_qty || 0)),
        0
      );

      await supabase
        .from('products')
        .update({ qty: totalWhQty, booked_qty: 0 })
        .eq('id', updatedItem.product_id);
    }

    return NextResponse.json(createSuccessResponse(updatedItem));
  } catch (error) {
    console.error('Error updating order item tracking:', error);
    return NextResponse.json(createErrorResponse('Internal server error'), { status: 500 });
  }
}
