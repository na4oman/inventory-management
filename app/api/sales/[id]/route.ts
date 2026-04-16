import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { SaleWithDetails } from '@/lib/types/database';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/sales/[id]
 * Fetch a single sale with details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: saleId } = await params;

    const { data: sale, error } = await supabase
      .from('sales')
      .select(`
        *,
        client:clients(*),
        items:sale_items(
          *,
          product:products(*)
        )
      `)
      .eq('id', saleId)
      .single();

    if (error || !sale) {
      return NextResponse.json(
        createErrorResponse('Sale not found'),
        { status: 404 }
      );
    }

    const saleWithDetails: SaleWithDetails = {
      ...sale,
      item_count: sale.items?.length || 0,
    };

    return NextResponse.json(createSuccessResponse(saleWithDetails));
  } catch (error) {
    console.error('Error fetching sale:', error);
    return NextResponse.json(
      createErrorResponse('Failed to fetch sale'),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sales/[id]
 * Delete a sale
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: saleId } = await params;

    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', saleId);

    if (error) {
      return NextResponse.json(
        createErrorResponse('Failed to delete sale'),
        { status: 500 }
      );
    }

    return NextResponse.json(createSuccessResponse({ success: true }));
  } catch (error) {
    console.error('Error deleting sale:', error);
    return NextResponse.json(
      createErrorResponse('Failed to delete sale'),
      { status: 500 }
    );
  }
}
