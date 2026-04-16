import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { OrderWithDetails } from '@/lib/types/database';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/orders/[id]
 * Fetch a single order with details (client, items, products)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    // Fetch order with eager loading
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        client:clients(*),
        items:order_items(
          *,
          product:products(*)
        )
      `)
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return NextResponse.json(
        createErrorResponse('Order not found'),
        { status: 404 }
      );
    }

    // Transform to OrderWithDetails
    const orderWithDetails: OrderWithDetails = {
      ...order,
      item_count: order.items?.length || 0,
    };

    return NextResponse.json(createSuccessResponse(orderWithDetails));
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      createErrorResponse('Failed to fetch order'),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/orders/[id]
 * Update order (notes, status)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await request.json();

    // Update order
    const { data: updatedOrder, error } = await supabase
      .from('orders')
      .update(body)
      .eq('id', orderId)
      .select()
      .single();

    if (error || !updatedOrder) {
      return NextResponse.json(
        createErrorResponse('Failed to update order'),
        { status: 500 }
      );
    }

    return NextResponse.json(createSuccessResponse(updatedOrder));
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      createErrorResponse('Failed to update order'),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/orders/[id]
 * Delete an order and its associated order items
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    // Delete order items first
    const { error: itemsError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', orderId);

    if (itemsError) {
      console.error('Error deleting order items:', itemsError);
      return NextResponse.json(
        createErrorResponse('Failed to delete order items'),
        { status: 500 }
      );
    }

    // Delete order
    const { error: orderError } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (orderError) {
      console.error('Error deleting order:', orderError);
      return NextResponse.json(
        createErrorResponse('Failed to delete order'),
        { status: 500 }
      );
    }

    return NextResponse.json(createSuccessResponse({ success: true }));
  } catch (error) {
    console.error('Error deleting order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      createErrorResponse(`Failed to delete order: ${errorMessage}`),
      { status: 500 }
    );
  }
}
