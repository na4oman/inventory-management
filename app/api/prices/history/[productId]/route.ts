import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { PriceHistoryEntry } from '@/lib/types/price';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/prices/history/[productId]
 * Returns all price history entries for a product, ordered by changed_at descending.
 *
 * Returns 404 if the product does not exist.
 * Returns an empty array if the product exists but has no history entries.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;

    // Verify product exists
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return NextResponse.json(createErrorResponse('Product not found'), { status: 404 });
    }

    // Query price history ordered by changed_at descending
    const { data, error } = await supabase
      .from('product_price_history')
      .select('id, product_id, field_name, old_value, new_value, changed_by, changed_at')
      .eq('product_id', productId)
      .order('changed_at', { ascending: false });

    if (error) {
      return NextResponse.json(createErrorResponse(error.message), { status: 500 });
    }

    const entries = (data || []) as PriceHistoryEntry[];

    return NextResponse.json(createSuccessResponse(entries));
  } catch (error) {
    console.error('Error fetching price history:', error);
    return NextResponse.json(createErrorResponse('Failed to fetch price history'), { status: 500 });
  }
}
