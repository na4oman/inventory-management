import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { InventoryLot } from '@/lib/types/database';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/inventory-lots?product_id={id}&status=active
 * Returns lots for a product, ordered by arrival_date ASC.
 * status: 'active' | 'depleted' | 'all' (default: 'active')
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const product_id = searchParams.get('product_id');
    const status = searchParams.get('status') || 'active';

    if (!product_id) {
      return NextResponse.json(
        createErrorResponse('product_id is required'),
        { status: 400 }
      );
    }

    let query = supabase
      .from('inventory_lots')
      .select('*')
      .eq('product_id', product_id)
      .order('arrival_date', { ascending: true });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        createErrorResponse(error.message),
        { status: 500 }
      );
    }

    const lots: InventoryLot[] = data || [];

    return NextResponse.json(
      createSuccessResponse({ data: lots, total: lots.length })
    );
  } catch (error) {
    console.error('Error fetching inventory lots:', error);
    return NextResponse.json(
      createErrorResponse('Failed to fetch inventory lots'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory-lots
 * Creates a free-stock lot by calling the create_inventory_lot RPC.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product_id, quantity, cost_price, arrival_date, notes } = body;

    // Basic presence validation
    if (!product_id || quantity === undefined || cost_price === undefined || !arrival_date) {
      return NextResponse.json(
        createErrorResponse('product_id, quantity, cost_price, and arrival_date are required'),
        { status: 400 }
      );
    }

    // Verify product exists
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        createErrorResponse('Product not found'),
        { status: 404 }
      );
    }

    // Call the create_inventory_lot RPC (source is always 'free_stock' for this route)
    const { data, error } = await supabase.rpc('create_inventory_lot', {
      p_product_id: product_id,
      p_quantity: quantity,
      p_cost_price: cost_price,
      p_source: 'free_stock',
      p_arrival_date: arrival_date,
      p_order_item_id: null,
      p_notes: notes ?? null,
    });

    if (error) {
      // RPC raises exceptions for validation failures (qty <= 0, cost_price < 0)
      return NextResponse.json(
        createErrorResponse(error.message),
        { status: 400 }
      );
    }

    return NextResponse.json(
      createSuccessResponse(data),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating inventory lot:', error);
    return NextResponse.json(
      createErrorResponse('Failed to create inventory lot'),
      { status: 500 }
    );
  }
}
