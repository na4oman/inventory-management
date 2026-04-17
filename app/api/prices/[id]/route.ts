import { auth } from '@clerk/nextjs/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { validatePrice } from '@/lib/validations/price';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { NextRequest, NextResponse } from 'next/server';

/**
 * PATCH /api/prices/[id]
 * Updates cost_price and/or sell_price for a product.
 * Calls the update_product_price RPC for each field to ensure atomicity and history tracking.
 *
 * Body: { cost_price?: number, sell_price?: number }
 * Returns 400 on validation failure, 404 if product not found, 500 on RPC failure.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(createErrorResponse('Unauthorized'), { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate that at least one price field is provided
    const hasCostPrice = 'cost_price' in body;
    const hasSellPrice = 'sell_price' in body;

    if (!hasCostPrice && !hasSellPrice) {
      return NextResponse.json(
        createErrorResponse('At least one of cost_price or sell_price is required'),
        { status: 400 }
      );
    }

    // Validate price values
    let costPrice: number | undefined;
    let sellPrice: number | undefined;

    if (hasCostPrice) {
      try {
        costPrice = validatePrice(body.cost_price);
      } catch (err) {
        return NextResponse.json(
          createErrorResponse(err instanceof Error ? err.message : 'Invalid cost_price'),
          { status: 400 }
        );
      }
    }

    if (hasSellPrice) {
      try {
        sellPrice = validatePrice(body.sell_price);
      } catch (err) {
        return NextResponse.json(
          createErrorResponse(err instanceof Error ? err.message : 'Invalid sell_price'),
          { status: 400 }
        );
      }
    }

    // Verify product exists
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !product) {
      return NextResponse.json(createErrorResponse('Product not found'), { status: 404 });
    }

    // Call update_product_price RPC for each changed field
    if (costPrice !== undefined) {
      const { error: rpcError } = await supabase.rpc('update_product_price', {
        p_product_id: id,
        p_field_name: 'cost_price',
        p_new_value: costPrice,
        p_changed_by: userId,
      });

      if (rpcError) {
        console.error('RPC error updating cost_price:', rpcError);
        return NextResponse.json(createErrorResponse('Failed to update price'), { status: 500 });
      }
    }

    if (sellPrice !== undefined) {
      const { error: rpcError } = await supabase.rpc('update_product_price', {
        p_product_id: id,
        p_field_name: 'sell_price',
        p_new_value: sellPrice,
        p_changed_by: userId,
      });

      if (rpcError) {
        console.error('RPC error updating sell_price:', rpcError);
        return NextResponse.json(createErrorResponse('Failed to update price'), { status: 500 });
      }
    }

    // Return updated product price row
    const { data: updated, error: selectError } = await supabase
      .from('products')
      .select('id, part_number, model, cost_price, sell_price')
      .eq('id', id)
      .single();

    if (selectError || !updated) {
      return NextResponse.json(createErrorResponse('Failed to fetch updated product'), { status: 500 });
    }

    return NextResponse.json(createSuccessResponse(updated));
  } catch (error) {
    console.error('Error updating price:', error);
    return NextResponse.json(createErrorResponse('Failed to update price'), { status: 500 });
  }
}
