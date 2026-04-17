import { auth } from '@clerk/nextjs/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from '@/lib/types/api';
import { SaleWithDetails } from '@/lib/types/database';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/sales
 * Retrieve paginated list of sales
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '10')));
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Build count query
    let countQuery = supabase
      .from('sales')
      .select('*', { count: 'exact', head: true });

    if (search) {
      countQuery = countQuery.ilike('sale_number', `%${search}%`);
    }

    const { count } = await countQuery;

    // Build data query with eager loading
    let query = supabase
      .from('sales')
      .select(`
        *,
        client:clients(*),
        items:sale_items(
          *,
          product:products(*)
        )
      `);

    if (search) {
      query = query.ilike('sale_number', `%${search}%`);
    }

    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        createErrorResponse(error.message),
        { status: 500 }
      );
    }

    const salesWithDetails: SaleWithDetails[] = (data || []).map(sale => ({
      ...sale,
      item_count: sale.items?.length || 0,
    }));

    const total = count || 0;
    const response = createPaginatedResponse(
      salesWithDetails,
      total,
      page,
      pageSize
    );

    return NextResponse.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Error fetching sales:', error);
    return NextResponse.json(
      createErrorResponse('Failed to fetch sales'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/sales
 * Create a new sale from received order items or free stock
 * 
 * Request body:
 * {
 *   client_id: string (UUID)
 *   items: Array<{
 *     source: 'order_item' | 'free_stock'
 *     order_item_id?: string (UUID, required if source='order_item')
 *     product_id: string (UUID)
 *     quantity: number
 *     unit_price: number
 *   }>
 *   notes?: string
 *   sale_date?: string (ISO datetime, defaults to now)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { client_id, items, notes, sale_date } = body;

    if (!client_id || !items || items.length === 0) {
      return NextResponse.json(
        createErrorResponse('Client ID and items are required'),
        { status: 400 }
      );
    }

    // Verify client exists
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

    // Fetch all products for validation
    const productIds = items.map((item: any) => item.product_id);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    if (productsError) {
      return NextResponse.json(
        createErrorResponse('Failed to fetch products'),
        { status: 500 }
      );
    }

    const productMap = new Map(products?.map((p: any) => [p.id, p]) || []);

    // Fetch order items for validation (only for order_item source)
    const orderItemIds = items
      .filter((item: any) => item.source === 'order_item')
      .map((item: any) => item.order_item_id);

    let orderItemMap = new Map();
    if (orderItemIds.length > 0) {
      const { data: orderItems, error: orderItemsError } = await supabase
        .from('order_items')
        .select('*')
        .in('id', orderItemIds);

      if (orderItemsError) {
        return NextResponse.json(
          createErrorResponse('Failed to fetch order items'),
          { status: 500 }
        );
      }

      orderItemMap = new Map(orderItems?.map((oi: any) => [oi.id, oi]) || []);
    }

    // Validate all items
    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return NextResponse.json(
          createErrorResponse(`Product ${item.product_id} not found`),
          { status: 404 }
        );
      }

      if (item.source === 'order_item') {
        const orderItem = orderItemMap.get(item.order_item_id);
        if (!orderItem) {
          return NextResponse.json(
            createErrorResponse(`Order item ${item.order_item_id} not found`),
            { status: 404 }
          );
        }

        const availableQty = orderItem.wh_qty || 0; // warehouse stock is what's available to sell
        if (item.quantity > availableQty) {
          return NextResponse.json(
            createErrorResponse(
              `Insufficient available quantity for item. WH Stock: ${availableQty}, Requested: ${item.quantity}`
            ),
            { status: 400 }
          );
        }
      } else if (item.source === 'free_stock') {
        const freeQty = product.qty; // product.qty is the warehouse stock
        if (item.quantity > freeQty) {
          return NextResponse.json(
            createErrorResponse(
              `Insufficient free stock for product ${product.part_number}. Available: ${freeQty}, Requested: ${item.quantity}`
            ),
            { status: 400 }
          );
        }
      }

      // Check product has sufficient inventory
      if (item.quantity > product.qty) {
        return NextResponse.json(
          createErrorResponse(
            `Insufficient inventory for product ${product.part_number}. Available: ${product.qty}, Requested: ${item.quantity}`
          ),
          { status: 400 }
        );
      }
    }

    // Generate sale number
    const { data: saleNumberData, error: saleNumberError } = await supabase
      .rpc('generate_sale_number');

    if (saleNumberError || !saleNumberData) {
      return NextResponse.json(
        createErrorResponse('Failed to generate sale number'),
        { status: 500 }
      );
    }

    const saleNumber = saleNumberData;

    // Create sale record
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        sale_number: saleNumber,
        client_id: client_id,
        total_amount: 0,
        total_cost: 0,
        profit: 0,
        notes: notes || null,
        sale_date: sale_date || new Date().toISOString(),
        user_id: 'user_3AkTs21U6NLdEJWSYVJrW05kWIn',
      })
      .select()
      .single();

    if (saleError || !sale) {
      return NextResponse.json(
        createErrorResponse('Failed to create sale'),
        { status: 500 }
      );
    }

    // Create sale items and deduct inventory
    let totalAmount = 0;
    let totalCost = 0;

    for (const item of items) {
      console.log(`\n>>> Processing item: source=${item.source}, product=${item.product_id}, qty=${item.quantity}`);
      
      const product = productMap.get(item.product_id);
      const quantity = item.quantity;
      const unitPrice = item.unit_price;
      const subtotal = quantity * unitPrice;

      // For free-stock items, compute cost from lot allocations; otherwise use product cost_price
      let costTotal: number;
      let unitCost: number;
      if (item.source === 'free_stock') {
        costTotal = (item.lot_allocations as any[]).reduce(
          (sum: number, alloc: any) => sum + alloc.quantity * alloc.cost_price, 0
        );
        unitCost = quantity > 0 ? costTotal / quantity : 0;
      } else {
        unitCost = product.cost_price;
        costTotal = quantity * unitCost;
      }

      const profit = subtotal - costTotal;

      // For free stock items, check for pending orders to fulfill first
      if (item.source === 'free_stock') {
        console.log(`>>> FREE STOCK ITEM - Starting fulfillment`);
        try {
          console.log(`\n=== Fulfilling product ${item.product_id}, qty ${quantity}, client ${client_id} ===`);
          
          // Step 1: Get all order items for this product
          const { data: allOrderItems, error: err1 } = await supabase
            .from('order_items')
            .select('id, order_id, product_id, ordered_qty, received_qty, status')
            .eq('product_id', item.product_id);

          console.log(`Step 1: Found ${allOrderItems?.length || 0} order items for product`);
          if (err1) console.error('Step 1 error:', err1);

          if (!allOrderItems || allOrderItems.length === 0) {
            console.log('No order items found, skipping fulfillment');
          } else {
            // Step 2: Get orders for these items
            const orderIds = allOrderItems.map((oi: any) => oi.order_id);
            const { data: orders, error: err2 } = await supabase
              .from('orders')
              .select('id, client_id')
              .in('id', orderIds);

            console.log(`Step 2: Found ${orders?.length || 0} orders`);
            if (err2) console.error('Step 2 error:', err2);

            // Step 3: Filter for this client
            const clientOrderIds = orders
              ?.filter((o: any) => o.client_id === client_id)
              .map((o: any) => o.id) || [];

            console.log(`Step 3: Found ${clientOrderIds.length} orders for client ${client_id}`);

            // Step 4: Get order items for this client
            const itemsToFulfill = allOrderItems.filter((oi: any) =>
              clientOrderIds.includes(oi.order_id)
            );

            console.log(`Step 4: Found ${itemsToFulfill.length} order items to fulfill`);

            // Step 5: Fulfill the first item
            if (itemsToFulfill.length > 0) {
              const orderItem = itemsToFulfill[0];
              const pendingQty = orderItem.ordered_qty - orderItem.received_qty;

              console.log(`Step 5: Processing item ${orderItem.id}`);
              console.log(`  Current: ordered=${orderItem.ordered_qty}, received=${orderItem.received_qty}, pending=${pendingQty}`);

              if (pendingQty > 0) {
                const qtyToFulfill = Math.min(quantity, pendingQty);
                const newReceivedQty = orderItem.received_qty + qtyToFulfill;
                // Status stays 'pending' until full ordered_qty is received
                const newStatus = 'pending';

                console.log(`  Fulfilling: ${qtyToFulfill} units`);
                console.log(`  New: received=${newReceivedQty}, status=${newStatus}`);

                const { error: updateError } = await supabase
                  .from('order_items')
                  .update({
                    received_qty: newReceivedQty,
                    status: newStatus,
                  })
                  .eq('id', orderItem.id);

                if (updateError) {
                  console.error(`Step 5 error:`, updateError);
                } else {
                  console.log(`✓ Successfully updated item ${orderItem.id}`);
                }
              }
            }
          }
        } catch (err) {
          console.error('Exception in fulfillment:', err);
        }
      }

      // Create sale item
      const saleItemData: any = {
        sale_id: sale.id,
        product_id: product.id,
        quantity: quantity,
        unit_price: unitPrice,
        unit_cost: unitCost,
        subtotal: subtotal,
        cost_total: costTotal,
        profit: profit,
      };

      if (item.source === 'order_item') {
        saleItemData.order_item_id = item.order_item_id;
      }

      const { data: saleItem, error: saleItemError } = await supabase
        .from('sale_items')
        .insert(saleItemData)
        .select()
        .single();

      if (saleItemError || !saleItem) {
        return NextResponse.json(
          createErrorResponse('Failed to create sale item'),
          { status: 500 }
        );
      }

      // For free-stock items, call process_lot_sale RPC to handle lot deduction and qty sync
      if (item.source === 'free_stock') {
        const { error: rpcError } = await supabase.rpc('process_lot_sale', {
          p_sale_item_id: saleItem.id,
          p_allocations: (item.lot_allocations as any[]).map((a: any) => ({
            lot_id: a.lot_id,
            quantity: a.quantity,
          })),
        });
        if (rpcError) {
          return NextResponse.json(
            createErrorResponse(rpcError.message),
            { status: 400 }
          );
        }
      }
      // For order items, don't deduct from products table - only update order_items below

      // Update order item sold quantity and warehouse stock (only for order items)
      if (item.source === 'order_item') {
        const orderItem = orderItemMap.get(item.order_item_id);
        const newSoldQty = (orderItem.sold_qty || 0) + quantity;
        const newWhQty = Math.max(0, (orderItem.wh_qty || 0) - quantity); // deduct from warehouse stock
        // Status stays 'pending' until full ordered_qty is sold
        const newStatus = newSoldQty === orderItem.ordered_qty ? 'shipped' : 'pending';

        const { error: updateError } = await supabase
          .from('order_items')
          .update({
            sold_qty: newSoldQty,
            wh_qty: newWhQty,
            status: newStatus,
          })
          .eq('id', item.order_item_id);

        if (updateError) {
          return NextResponse.json(
            createErrorResponse('Failed to update order item'),
            { status: 500 }
          );
        }

        // Sync products.qty = sum of all wh_qty for this product across all order items
        const { data: allOrderItems } = await supabase
          .from('order_items')
          .select('id, wh_qty')
          .eq('product_id', item.product_id);

        const totalWhQty = (allOrderItems || []).reduce((sum, oi) => {
          // Use the new wh_qty for the current item, existing for others
          const qty = oi.id === item.order_item_id ? newWhQty : (oi.wh_qty || 0);
          return sum + qty;
        }, 0);

        await supabase
          .from('products')
          .update({ qty: totalWhQty, booked_qty: 0 })
          .eq('id', item.product_id);
      }

      totalAmount += subtotal;
      totalCost += costTotal;
    }

    // Check if any orders are now fully fulfilled and update their status
    const processedOrderIds = [...new Set(
      items
        .filter((item: any) => item.source === 'order_item')
        .map((item: any) => orderItemMap.get(item.order_item_id)?.order_id)
        .filter(Boolean)
    )];

    for (const orderId of processedOrderIds) {
      const { data: orderItems } = await supabase
        .from('order_items')
        .select('ordered_qty, sold_qty')
        .eq('order_id', orderId);

      if (orderItems && orderItems.length > 0) {
        const allFulfilled = orderItems.every(
          (oi: any) => (oi.sold_qty || 0) >= oi.ordered_qty
        );
        if (allFulfilled) {
          await supabase
            .from('orders')
            .update({ status: 'completed' })
            .eq('id', orderId);
        }
      }
    }

    const saleProfit = totalAmount - totalCost;

    // Update sale with totals
    const { data: updatedSale, error: updateSaleError } = await supabase
      .from('sales')
      .update({
        total_amount: totalAmount,
        total_cost: totalCost,
        profit: saleProfit,
      })
      .eq('id', sale.id)
      .select()
      .single();

    if (updateSaleError || !updatedSale) {
      return NextResponse.json(
        createErrorResponse('Failed to update sale totals'),
        { status: 500 }
      );
    }

    return NextResponse.json(
      createSuccessResponse(updatedSale),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating sale:', error);
    return NextResponse.json(
      createErrorResponse('Failed to create sale'),
      { status: 500 }
    );
  }
}
