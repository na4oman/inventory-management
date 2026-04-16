import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/orders/fix-status
 * Fix order statuses for existing orders that have been converted to sales
 * This is a one-time migration to update orders that were already sold but still marked as pending
 */
export async function POST(request: NextRequest) {
  try {
    // Fetch all pending orders that have associated sales
    const { data: pendingOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, status')
      .eq('status', 'pending');

    if (ordersError) {
      return NextResponse.json(
        createErrorResponse('Failed to fetch orders'),
        { status: 500 }
      );
    }

    if (!pendingOrders || pendingOrders.length === 0) {
      return NextResponse.json(
        createSuccessResponse({ updated: 0, message: 'No pending orders found' }),
        { status: 200 }
      );
    }

    let updatedCount = 0;

    // Check each pending order for associated sales
    for (const order of pendingOrders) {
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('id')
        .eq('order_id', order.id)
        .limit(1);

      if (salesError) {
        console.error(`Failed to check sales for order ${order.id}:`, salesError);
        continue;
      }

      // If there are sales for this order, update its status to completed
      if (sales && sales.length > 0) {
        const { error: updateError } = await supabase
          .from('orders')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', order.id);

        if (updateError) {
          console.error(`Failed to update order ${order.id}:`, updateError);
          continue;
        }

        updatedCount++;
        console.log(`Updated order ${order.order_number} to completed`);
      }
    }

    return NextResponse.json(
      createSuccessResponse({
        updated: updatedCount,
        total: pendingOrders.length,
        message: `Updated ${updatedCount} orders to completed status`,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fixing order statuses:', error);
    return NextResponse.json(
      createErrorResponse('Failed to fix order statuses'),
      { status: 500 }
    );
  }
}
