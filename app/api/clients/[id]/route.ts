import { supabaseServer as supabase } from '@/lib/supabase/server';
import { updateClientSchema } from '@/lib/validations/client';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/clients/[id]
 * Fetch a single client
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch client
    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !client) {
      return NextResponse.json(
        createErrorResponse('Client not found'),
        { status: 404 }
      );
    }

    return NextResponse.json(createSuccessResponse(client));
  } catch (error) {
    console.error('Error fetching client:', error);
    return NextResponse.json(
      createErrorResponse('Failed to fetch client'),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clients/[id]
 * Update a client
 * 
 * Requirements:
 * - Verify authentication and ownership
 * - Update client fields
 * - Return updated client
 * - Requirements: Client editing
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate partial update data
    const validationResult = updateClientSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        createErrorResponse(firstError?.message || 'Validation failed'),
        { status: 400 }
      );
    }

    // Update client
    const { data: updatedClient, error: updateError } = await supabase
      .from('clients')
      .update(validationResult.data)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        createErrorResponse(updateError.message),
        { status: 500 }
      );
    }

    return NextResponse.json(createSuccessResponse(updatedClient));
  } catch (error) {
    console.error('Error updating client:', error);
    return NextResponse.json(
      createErrorResponse('Failed to update client'),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[id]
 * Delete a client
 * 
 * Requirements:
 * - Verify authentication and ownership
 * - Check if client has orders or sales
 * - Delete if no dependencies or return error
 * - Requirements: Client deletion, dependency checking
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if client has any orders
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', id);

    if (ordersError) {
      return NextResponse.json(
        createErrorResponse('Failed to check orders'),
        { status: 500 }
      );
    }

    if (orders && orders.length > 0) {
      return NextResponse.json(
        createErrorResponse('Cannot delete client with existing orders'),
        { status: 400 }
      );
    }

    // Check if client has any sales
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', id);

    if (salesError) {
      return NextResponse.json(
        createErrorResponse('Failed to check sales'),
        { status: 500 }
      );
    }

    if (sales && sales.length > 0) {
      return NextResponse.json(
        createErrorResponse('Cannot delete client with existing sales'),
        { status: 400 }
      );
    }

    // Delete client
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json(
        createErrorResponse(deleteError.message),
        { status: 500 }
      );
    }

    return NextResponse.json(
      createSuccessResponse({ success: true })
    );
  } catch (error) {
    console.error('Error deleting client:', error);
    return NextResponse.json(
      createErrorResponse('Failed to delete client'),
      { status: 500 }
    );
  }
}
