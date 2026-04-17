import { auth } from '@clerk/nextjs/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { SuggestedPrice } from '@/lib/types/price';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/prices/suggest
 * Returns the suggested unit price for a client–product combination.
 *
 * Query params (both required):
 *   client_id  - the client UUID
 *   product_id - the product UUID
 *
 * Logic: check customer_prices first; fall back to products.sell_price.
 * Returns: SuggestedPrice { price: number, source: 'customer_price' | 'sell_price' }
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(createErrorResponse('Unauthorized'), { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('client_id');
    const productId = searchParams.get('product_id');

    if (!clientId || !productId) {
      return NextResponse.json(
        createErrorResponse('client_id and product_id are required'),
        { status: 400 }
      );
    }

    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(createErrorResponse('Client not found'), { status: 404 });
    }

    // Verify product exists and get sell_price
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, sell_price')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return NextResponse.json(createErrorResponse('Product not found'), { status: 404 });
    }

    // Check for a customer-specific price
    const { data: customerPrice } = await supabase
      .from('customer_prices')
      .select('price')
      .eq('client_id', clientId)
      .eq('product_id', productId)
      .single();

    const result: SuggestedPrice = customerPrice
      ? { price: customerPrice.price, source: 'customer_price' }
      : { price: product.sell_price, source: 'sell_price' };

    return NextResponse.json(createSuccessResponse(result));
  } catch (error) {
    console.error('Error fetching suggested price:', error);
    return NextResponse.json(createErrorResponse('Failed to fetch suggested price'), { status: 500 });
  }
}
