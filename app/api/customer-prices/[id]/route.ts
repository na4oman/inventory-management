import { auth } from '@clerk/nextjs/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { NextRequest, NextResponse } from 'next/server';

/**
 * DELETE /api/customer-prices/[id]
 * Deletes a customer price record by its primary key.
 *
 * Returns 404 if the record doesn't exist, 200 on success.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(createErrorResponse('Unauthorized'), { status: 401 });
    }

    const { id } = await params;

    // Verify the record exists before deleting
    const { data: existing, error: fetchError } = await supabase
      .from('customer_prices')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        createErrorResponse('Customer price not found'),
        { status: 404 }
      );
    }

    const { error } = await supabase
      .from('customer_prices')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json(createErrorResponse(error.message), { status: 500 });
    }

    return NextResponse.json(createSuccessResponse({ message: 'Customer price deleted' }));
  } catch (error) {
    console.error('Error deleting customer price:', error);
    return NextResponse.json(createErrorResponse('Failed to delete customer price'), { status: 500 });
  }
}
