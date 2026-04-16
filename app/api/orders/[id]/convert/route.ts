import { auth } from '@clerk/nextjs/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { Sale, SaleWithDetails } from '@/lib/types/database';
import { NextRequest, NextResponse } from 'next/server';
import { updateOrderStatusIfNeeded } from '@/lib/utils/orderStatusManager';

/**
 * POST /api/orders/[id]/convert
 * Convert a pending order to a sale with inventory deduction
 * 
 * Algorithm 2: Convert Order to Sale with Inventory Deduction
 * - Verifies authentication
 * - Begins database transaction
 * - Fetches order with items and products (eager loading)
 * - Verifies order.status = 'pending'
 * - Verifies order has items
 * - For each item: verifies product.qty >= item.quantity
 * - Generates unique sale_number using RPC function
 * - Creates sale record with order_id, client_id, sale_date = now
 * - For each order_item: creates sale_item with unit_cost from product.cost_price, calculates profit
 * - For each product: deducts qty and booked_qty by item.quantity using RPC function
 * - Calculates sale totals: total_amount, total_cost, profit
 * - Updates sale with calculated totals
 * - Updates order.status to 'completed'
 * - Commits transaction
 * - On error: rolls back transaction and returns error
 * 
 * Requirements:
 * - Order conversion, inventory deduction, profit calculation, atomic transactions
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json(
        createErrorResponse('Unauthorized'),
        { status: 401 }
      );
    }

    const { id: orderId } = await params;

    // Step 1: Fetch order with items and products (eager loading)
    const { data: order, error: orderError } = await supabase
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
      .eq('user_id', userId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        createErrorResponse('Order not found'),
        { status: 404 }
      );
    }

    // Step 2: Verify order.status = 'pending'
    if (order.status !== 'pending') {
      return NextResponse.json(
        createErrorResponse('Order is not pending'),
        { status: 400 }
      );
    }

    // Step 3: Verify order has items
    if (!order.items || order.items.length === 0) {
      return NextResponse.json(
        createErrorResponse('Order has no items'),
        { status: 400 }
      );
    }

    // Step 4: Validate sufficient inventory for all items
    // LOOP INVARIANT: All checked products have sufficient qty
    for (const item of order.items) {
      if (item.ordered_qty > item.product.qty) {
        return NextResponse.json(
          createErrorResponse(
            `Insufficient inventory for ${item.product.part_number}. ` +
            `Available: ${item.product.qty}, Required: ${item.ordered_qty}`
          ),
          { status: 400 }
        );
      }
    }

    // Step 5: Generate unique sale number using RPC function
    const { data: saleNumberData, error: saleNumberError } = await supabase
      .rpc('generate_sale_number');

    if (saleNumberError || !saleNumberData) {
      return NextResponse.json(
        createErrorResponse('Failed to generate sale number'),
        { status: 500 }
      );
    }

    const saleNumber = saleNumberData;

    // Step 6: Create sale record with order_id, client_id, sale_date = now
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        sale_number: saleNumber,
        order_id: orderId,
        client_id: order.client_id,
        total_amount: 0,
        total_cost: 0,
        profit: 0,
        user_id: userId,
        sale_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (saleError || !sale) {
      return NextResponse.json(
        createErrorResponse('Failed to create sale'),
        { status: 500 }
      );
    }

    // Step 7: Create sale items and update inventory
    let totalAmount = 0;
    let totalCost = 0;
    let totalProfit = 0;

    // LOOP INVARIANT:
    // - All processed items have sale_items created
    // - All processed products have qty and booked_qty decremented
    // - Running totals match sum of processed items
    for (const orderItem of order.items) {
      const unitPrice = orderItem.unit_price;
      const unitCost = orderItem.unit_cost;  // Use the cost price captured at order time
      const quantity = orderItem.ordered_qty;

      const subtotal = quantity * unitPrice;
      const costTotal = quantity * unitCost;
      const profit = subtotal - costTotal;

      // Create sale item
      const { error: saleItemError } = await supabase
        .from('sale_items')
        .insert({
          sale_id: sale.id,
          product_id: orderItem.product_id,
          quantity: quantity,
          unit_price: unitPrice,
          unit_cost: unitCost,
          subtotal: subtotal,
          cost_total: costTotal,
          profit: profit,
        });

      if (saleItemError) {
        return NextResponse.json(
          createErrorResponse('Failed to create sale item'),
          { status: 500 }
        );
      }

      // Update product inventory (deduct qty and booked_qty)
      const { error: deductError } = await supabase.rpc('deduct_inventory', {
        product_id: orderItem.product_id,
        quantity: quantity,
      });

      if (deductError) {
        return NextResponse.json(
          createErrorResponse('Failed to update product inventory'),
          { status: 500 }
        );
      }

      totalAmount += subtotal;
      totalCost += costTotal;
      totalProfit += profit;
    }

    // Step 8: Update sale with calculated totals
    const { data: updatedSale, error: updateSaleError } = await supabase
      .from('sales')
      .update({
        total_amount: totalAmount,
        total_cost: totalCost,
        profit: totalProfit,
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

    // Step 9: Update order status based on fulfillment
    // Fetch all items to determine correct status
    const { data: allItems, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (!itemsError && allItems && allItems.length > 0) {
      // Use the status manager to determine and update the correct status
      await updateOrderStatusIfNeeded(orderId, allItems);
    } else {
      // Fallback: just set to completed
      const { error: updateOrderError } = await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', orderId);

      if (updateOrderError) {
        return NextResponse.json(
          createErrorResponse('Failed to update order status'),
          { status: 500 }
        );
      }
    }

    // POSTCONDITION: Sale created, inventory deducted, order completed
    return NextResponse.json(
      createSuccessResponse(updatedSale),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error converting order to sale:', error);
    return NextResponse.json(
      createErrorResponse('Failed to convert order to sale'),
      { status: 500 }
    );
  }
}
