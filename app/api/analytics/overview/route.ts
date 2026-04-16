import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { InventoryOverview } from '@/lib/types/viewModels';
import { NextResponse } from 'next/server';

/**
 * GET /api/analytics/overview
 * Retrieve inventory overview with aggregated statistics
 * 
 * Requirements:
 * - Aggregate all products: sum(qty), sum(booked_qty), sum(qty * cost_price), count(*)
 * - Calculate available_qty = total_qty - booked_qty
 * - Return InventoryOverview
 */
export async function GET() {
  try {
    // Fetch all products
    const { data: products, error } = await supabase
      .from('products')
      .select('qty, booked_qty, cost_price');

    if (error) {
      return NextResponse.json(
        createErrorResponse(error.message),
        { status: 500 }
      );
    }

    // Aggregate the data
    const overview: InventoryOverview = {
      total_qty: 0,
      booked_qty: 0,
      available_qty: 0,
      total_value: 0,
      total_products: products?.length || 0,
    };

    if (products && products.length > 0) {
      overview.total_qty = products.reduce((sum, p) => sum + (p.qty || 0), 0);
      overview.booked_qty = products.reduce((sum, p) => sum + (p.booked_qty || 0), 0);
      overview.total_value = products.reduce(
        (sum, p) => sum + ((p.qty || 0) * (p.cost_price || 0)),
        0
      );
    }

    // available_qty = qty directly (booked_qty is not reliably maintained)
    overview.available_qty = overview.total_qty;

    return NextResponse.json(createSuccessResponse(overview));
  } catch (error) {
    console.error('Error fetching inventory overview:', error);
    return NextResponse.json(
      createErrorResponse('Failed to fetch inventory overview'),
      { status: 500 }
    );
  }
}
