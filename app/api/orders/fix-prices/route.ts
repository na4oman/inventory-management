import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/orders/fix-prices
 * Fix order item prices for existing orders
 * Calculates unit_price from order total_amount and item quantities
 */
export async function POST(request: NextRequest) {
  try {
    // Fetch all orders with their items
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        total_amount,
        items:order_items(
          id,
          ordered_qty,
          unit_price
        )
      `);

    if (ordersError) {
      return NextResponse.json(
        createErrorResponse('Failed to fetch orders'),
        { status: 500 }
      );
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        createSuccessResponse({ updated: 0, message: 'No orders found' }),
        { status: 200 }
      );
    }

    let updatedCount = 0;
    let itemsUpdated = 0;

    // Process each order
    for (const order of orders) {
      if (!order.items || order.items.length === 0) continue;

      // Check if items have zero prices
      const itemsNeedingUpdate = order.items.filter((item: any) => !item.unit_price || item.unit_price === 0);
      
      if (itemsNeedingUpdate.length === 0) continue;

      // Calculate unit price for each item
      // If all items have same unit price, divide total by quantity
      // Otherwise, we need to fetch from products
      const totalQuantity = order.items.reduce((sum: number, item: any) => sum + item.ordered_qty, 0);
      
      if (totalQuantity > 0 && order.total_amount > 0) {
        // Simple case: if only one item, unit_price = total_amount / quantity
        if (order.items.length === 1) {
          const item = order.items[0];
          const calculatedPrice = order.total_amount / item.ordered_qty;
          
          const { error: updateError } = await supabase
            .from('order_items')
            .update({ unit_price: calculatedPrice })
            .eq('id', item.id);

          if (!updateError) {
            itemsUpdated++;
          }
        } else {
          // Multiple items: fetch product prices
          const productIds = order.items.map((item: any) => item.product_id);
          const { data: products } = await supabase
            .from('products')
            .select('id, sell_price')
            .in('id', productIds);

          const productMap = new Map(products?.map((p: any) => [p.id, p.sell_price]) || []);

          for (const item of order.items) {
            const productPrice = productMap.get(item.product_id);
            if (productPrice && productPrice > 0) {
              const { error: updateError } = await supabase
                .from('order_items')
                .update({ unit_price: productPrice })
                .eq('id', item.id);

              if (!updateError) {
                itemsUpdated++;
              }
            }
          }
        }
      }

      updatedCount++;
    }

    return NextResponse.json(
      createSuccessResponse({
        ordersProcessed: updatedCount,
        itemsUpdated: itemsUpdated,
        message: `Updated ${itemsUpdated} order items with prices`,
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fixing order prices:', error);
    return NextResponse.json(
      createErrorResponse('Failed to fix order prices'),
      { status: 500 }
    );
  }
}
