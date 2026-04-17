import { auth } from '@clerk/nextjs/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { validatePrice } from '@/lib/validations/price';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { CustomerPriceWithDetails } from '@/lib/types/price';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/customer-prices
 * Returns customer price records joined with client or product details.
 *
 * Query params (at least one required):
 *   product_id - filter by product; joins clients table to include client name
 *   client_id  - filter by client; joins products table to include part_number and model
 *
 * Returns: CustomerPriceWithDetails[]
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(createErrorResponse('Unauthorized'), { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get('product_id');
    const clientId = searchParams.get('client_id');

    if (!productId && !clientId) {
      return NextResponse.json(
        createErrorResponse('At least one of product_id or client_id is required'),
        { status: 400 }
      );
    }

    let query;

    if (productId) {
      // Join with clients to include client name
      query = supabase
        .from('customer_prices')
        .select('id, client_id, product_id, price, created_at, updated_at, client:clients(name)')
        .eq('product_id', productId);
    } else {
      // Join with products to include part_number and model
      query = supabase
        .from('customer_prices')
        .select('id, client_id, product_id, price, created_at, updated_at, product:products(part_number, model)')
        .eq('client_id', clientId!);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(createErrorResponse(error.message), { status: 500 });
    }

    return NextResponse.json(createSuccessResponse(data as CustomerPriceWithDetails[]));
  } catch (error) {
    console.error('Error fetching customer prices:', error);
    return NextResponse.json(createErrorResponse('Failed to fetch customer prices'), { status: 500 });
  }
}

/**
 * POST /api/customer-prices
 * Upserts a customer price record using ON CONFLICT (client_id, product_id) DO UPDATE.
 *
 * Body: { client_id: string, product_id: string, price: number }
 * Returns the upserted record.
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(createErrorResponse('Unauthorized'), { status: 401 });
    }

    const body = await request.json();
    const { client_id, product_id, price: rawPrice } = body;

    if (!client_id || !product_id) {
      return NextResponse.json(
        createErrorResponse('client_id and product_id are required'),
        { status: 400 }
      );
    }

    let price: number;
    try {
      price = validatePrice(rawPrice);
    } catch (err) {
      return NextResponse.json(
        createErrorResponse(err instanceof Error ? err.message : 'Invalid price'),
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('customer_prices')
      .upsert(
        { client_id, product_id, price, updated_at: new Date().toISOString() },
        { onConflict: 'client_id,product_id' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json(createErrorResponse(error.message), { status: 500 });
    }

    return NextResponse.json(createSuccessResponse(data), { status: 201 });
  } catch (error) {
    console.error('Error upserting customer price:', error);
    return NextResponse.json(createErrorResponse('Failed to save customer price'), { status: 500 });
  }
}
