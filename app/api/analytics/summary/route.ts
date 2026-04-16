import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { AnalyticsSummary, TopSellingProduct, SalesByPeriod } from '@/lib/types/viewModels';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/analytics/summary
 * Retrieve sales analytics with aggregated metrics
 * 
 * Requirements:
 * - Accept optional startDate and endDate query params
 * - Fetch all sales in date range
 * - Calculate total_revenue = sum(sale.total_amount)
 * - Calculate total_profit = sum(sale.profit)
 * - Calculate profit_margin = (total_profit / total_revenue) * 100
 * - Aggregate sale_items by product_id for top selling products
 * - Sort by total_quantity_sold descending, limit 10
 * - Group sales by date for sales_by_period
 * - Return AnalyticsSummary
 */
export async function GET(request: NextRequest) {
  try {

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build query for sales
    let salesQuery = supabase
      .from('sales')
      .select(`
        id,
        total_amount,
        total_cost,
        profit,
        sale_date,
        sale_items(
          quantity,
          unit_price,
          cost_total,
          profit,
          product:products(
            id,
            part_number,
            model,
            cost_price
          )
        )
      `);

    // Apply date range filter
    if (startDate) {
      salesQuery = salesQuery.gte('sale_date', startDate);
    }
    if (endDate) {
      salesQuery = salesQuery.lte('sale_date', endDate);
    }

    const { data: sales, error } = await salesQuery;

    if (error) {
      return NextResponse.json(
        createErrorResponse(error.message),
        { status: 500 }
      );
    }

    // Initialize summary
    const summary: AnalyticsSummary = {
      total_revenue: 0,
      total_profit: 0,
      total_sales: 0,
      profit_margin: 0,
      top_selling_products: [],
      sales_by_period: [],
    };

    if (!sales || sales.length === 0) {
      return NextResponse.json(createSuccessResponse(summary));
    }

    // Calculate totals
    summary.total_sales = sales.length;
    summary.total_revenue = sales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    summary.total_profit = sales.reduce((sum, s) => sum + (s.profit || 0), 0);
    const totalCost = sales.reduce((sum, s) => sum + ((s as any).total_cost || 0), 0);

    // Calculate profit margin = profit / total_cost * 100
    if (totalCost > 0) {
      summary.profit_margin = (summary.total_profit / totalCost) * 100;
    }

    // Aggregate top selling products
    const productMap = new Map<string, TopSellingProduct>();

    sales.forEach((sale: any) => {
      if (sale.sale_items && Array.isArray(sale.sale_items)) {
        sale.sale_items.forEach((item: any) => {
          if (item.product) {
            const product = item.product as any;
            const productId = product.id;
            const existing = productMap.get(productId);

            if (existing) {
              existing.total_quantity_sold += item.quantity || 0;
              existing.total_revenue += (item.quantity || 0) * (item.unit_price || 0);
              existing.total_profit += item.profit || 0;
              existing.total_cost += item.cost_total || 0;
            } else {
              productMap.set(productId, {
                product_id: productId,
                part_number: product.part_number,
                model: product.model,
                total_quantity_sold: item.quantity || 0,
                total_revenue: (item.quantity || 0) * (item.unit_price || 0),
                total_profit: item.profit || 0,
                total_cost: item.cost_total || 0,
                avg_margin: 0,
              });
            }
          }
        });
      }
    });

    // Sort by quantity sold descending and limit to top 10
    summary.top_selling_products = Array.from(productMap.values())
      .map(p => ({
        ...p,
        avg_margin: p.total_cost > 0 ? (p.total_profit / p.total_cost) * 100 : 0,
      }))
      .sort((a, b) => b.total_quantity_sold - a.total_quantity_sold)
      .slice(0, 10);

    // Group sales by date for sales_by_period
    const periodMap = new Map<string, SalesByPeriod>();

    sales.forEach(sale => {
      // Extract date in YYYY-MM-DD format
      const saleDate = new Date(sale.sale_date);
      const period = saleDate.toISOString().split('T')[0];

      const existing = periodMap.get(period);

      if (existing) {
        existing.total_sales += 1;
        existing.total_revenue += sale.total_amount || 0;
        existing.total_profit += sale.profit || 0;
      } else {
        periodMap.set(period, {
          period,
          total_sales: 1,
          total_revenue: sale.total_amount || 0,
          total_profit: sale.profit || 0,
        });
      }
    });

    // Convert to array and sort by period ascending
    summary.sales_by_period = Array.from(periodMap.values()).sort((a, b) =>
      a.period.localeCompare(b.period)
    );

    return NextResponse.json(createSuccessResponse(summary));
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    return NextResponse.json(
      createErrorResponse('Failed to fetch analytics summary'),
      { status: 500 }
    );
  }
}
