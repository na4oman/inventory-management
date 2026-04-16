import { auth } from '@clerk/nextjs/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { updateProductSchema } from '@/lib/validations/product';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/products/[id]
 * Fetch a single product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        createErrorResponse('Unauthorized'),
        { status: 401 }
      );
    }

    const { id } = await params;

    // Fetch product
    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !product) {
      return NextResponse.json(
        createErrorResponse('Product not found'),
        { status: 404 }
      );
    }

    return NextResponse.json(createSuccessResponse(product));
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      createErrorResponse('Failed to fetch product'),
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/products/[id]
 * Update a product
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        createErrorResponse('Unauthorized'),
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Verify product exists
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !product) {
      return NextResponse.json(
        createErrorResponse('Product not found'),
        { status: 404 }
      );
    }

    // Validate partial update data
    const validationResult = updateProductSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        createErrorResponse(firstError?.message || 'Validation failed'),
        { status: 400 }
      );
    }

    // Update product
    const { data, error } = await supabase
      .from('products')
      .update(validationResult.data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        createErrorResponse(error.message),
        { status: 500 }
      );
    }

    return NextResponse.json(createSuccessResponse(data));
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      createErrorResponse('Failed to update product'),
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products/[id]
 * Delete a product
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        createErrorResponse('Unauthorized'),
        { status: 401 }
      );
    }

    const { id } = await params;

    // Fetch product to check if it exists and has pending orders
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('id, booked_qty, part_number')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !product) {
      return NextResponse.json(
        createErrorResponse('Product not found'),
        { status: 404 }
      );
    }

    // Check if product has pending orders (booked_qty > 0)
    if (product.booked_qty > 0) {
      return NextResponse.json(
        createErrorResponse(`Cannot delete product "${product.part_number}" - it has ${product.booked_qty} units in pending orders`),
        { status: 400 }
      );
    }

    // Delete product
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json(
        createErrorResponse(error.message),
        { status: 500 }
      );
    }

    return NextResponse.json(
      createSuccessResponse({ success: true })
    );
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      createErrorResponse('Failed to delete product'),
      { status: 500 }
    );
  }
}
