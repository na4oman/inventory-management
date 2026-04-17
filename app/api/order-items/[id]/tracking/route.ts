import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { PostgrestError } from '@supabase/supabase-js';

/**
 * PATCH /api/order-items/[id]/tracking
 * Update forwarded_qty or wh_qty on an order item.
 * When wh_qty changes, creates an inventory lot via create_inventory_lot RPC.
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
      .select('*, product_id, cost_price, quantity')
      .single();

    if (error || !updatedItem) {
      return NextResponse.json(createErrorResponse('Order item not found'), { status: 404 });
    }

    // If wh_qty changed, create an inventory lot via RPC instead of directly updating products.qty
    if (wh_qty !== undefined && updatedItem.product_id) {
      const arrivalDate = new Date().toISOString().split('T')[0];

      const { error: rpcError } = await supabase.rpc('create_inventory_lot', {
        p_product_id: updatedItem.product_id,
        p_quantity: wh_qty,
        p_cost_price: updatedItem.cost_price,
        p_source: 'order',
        p_arrival_date: arrivalDate,
        p_order_item_id: itemId,
      });

      if (rpcError) {
        const pgError = rpcError as PostgrestError;
        return NextResponse.json(
          createErrorResponse(pgError.message || 'Failed to create inventory lot'),
          { status: 400 }
        );
      }
    }

    return NextResponse.json(createSuccessResponse(updatedItem));
  } catch (error) {
    console.error('Error updating order item tracking:', error);
    return NextResponse.json(createErrorResponse('Internal server error'), { status: 500 });
  }
}
