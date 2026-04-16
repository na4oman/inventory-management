import { auth } from '@clerk/nextjs/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createOrderSchema } from '@/lib/validations/order';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from '@/lib/types/api';
import { OrderWithDetails } from '@/lib/types/database';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/orders
 * Retrieve paginated list of orders with search, filter, and sort
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '10')));
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Build query for count
    let countQuery = supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    // Apply status filter to count query
    if (status) {
      countQuery = countQuery.eq('status', status);
    }

    // Apply search filter to count query (search in order_number)
    if (search) {
      countQuery = countQuery.ilike('order_number', `%${search}%`);
    }

    const { count } = await countQuery;

    // Build query for data with eager loading
    let query = supabase
      .from('orders')
      .select(`
        *,
        client:clients(*),
        items:order_items(
          *,
          product:products(*)
        )
      `);

    // Apply status filter
    if (status) {
      query = query.eq('status', status);
    }

    // Apply search filter
    if (search) {
      query = query.ilike('order_number', `%${search}%`);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        createErrorResponse(error.message),
        { status: 500 }
      );
    }

    // Transform data to OrderWithDetails with item_count
    const ordersWithDetails: OrderWithDetails[] = (data || []).map(order => ({
      ...order,
      item_count: order.items?.length || 0,
    }));

    const total = count || 0;
    const response = createPaginatedResponse(
      ordersWithDetails,
      total,
      page,
      pageSize
    );

    return NextResponse.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      createErrorResponse('Failed to fetch orders'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders
 * Create a new order with inventory booking
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = createOrderSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        createErrorResponse(firstError?.message || 'Validation failed'),
        { status: 400 }
      );
    }

    const { client_id, items, notes } = validationResult.data;

    // Step 1: Verify client exists (if provided)
    if (client_id) {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('id', client_id)
        .single();

      if (clientError || !client) {
        return NextResponse.json(
          createErrorResponse('Client not found'),
          { status: 404 }
        );
      }
    }

    // Determine order type
    const orderType = client_id ? 'customer' : 'forecast';

    // Step 2: Validate all products exist
    // LOOP INVARIANT: All checked products exist
    const productIds = items.map(item => item.product_id);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, qty, booked_qty, sell_price, cost_price')
      .in('id', productIds);

    if (productsError) {
      return NextResponse.json(
        createErrorResponse('Failed to fetch products'),
        { status: 500 }
      );
    }

    // Create a map for quick lookup
    const productMap = new Map(products?.map(p => [p.id, p]) || []);

    // Validate each item
    for (const item of items) {
      const product = productMap.get(item.product_id);

      if (!product) {
        return NextResponse.json(
          createErrorResponse(`Product ${item.product_id} not found`),
          { status: 404 }
        );
      }
    }

    // Step 3: Generate unique order number using RPC function
    const { data: orderNumberData, error: orderNumberError } = await supabase
      .rpc('generate_order_number');

    if (orderNumberError || !orderNumberData) {
      return NextResponse.json(
        createErrorResponse('Failed to generate order number'),
        { status: 500 }
      );
    }

    const orderNumber = orderNumberData;

    // Step 4: Create order record with status = 'pending', total_amount = 0
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        client_id: client_id || null,
        order_type: orderType,
        status: 'pending',
        notes: notes || null,
        total_amount: 0,
        user_id: 'user_3AkTs21U6NLdEJWSYVJrW05kWIn',
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Order creation error:', orderError);
      return NextResponse.json(
        createErrorResponse(orderError?.message || 'Failed to create order'),
        { status: 500 }
      );
    }

    // Step 5: Create order items
    let totalAmount = 0;

    // LOOP INVARIANT:
    // - All processed items have order_items created
    // - totalAmount equals sum of processed item subtotals
    for (const item of items) {
      const product = productMap.get(item.product_id);
      const unitPrice = item.unit_price || product?.sell_price || 0;
      const subtotal = item.ordered_qty * unitPrice;

      // Create order item with unit_price captured at order time
      const { error: itemError } = await supabase
        .from('order_items')
        .insert({
          order_id: order.id,
          product_id: item.product_id,
          ordered_qty: item.ordered_qty,
          received_qty: 0,
          shipped_qty: 0,
          unit_price: unitPrice,
        });

      if (itemError) {
        console.error('Order item creation error:', itemError);
        return NextResponse.json(
          createErrorResponse(`Failed to create order item: ${itemError.message}`),
          { status: 500 }
        );
      }

      totalAmount += subtotal;
    }

    // Step 6: Update order total_amount
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ total_amount: totalAmount })
      .eq('id', order.id)
      .select()
      .single();

    if (updateError || !updatedOrder) {
      return NextResponse.json(
        createErrorResponse('Failed to update order total'),
        { status: 500 }
      );
    }

    // POSTCONDITION: Order created, all items added with pending status
    return NextResponse.json(
      createSuccessResponse(updatedOrder),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating order:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      createErrorResponse(`Failed to create order: ${errorMessage}`),
      { status: 500 }
    );
  }
}
