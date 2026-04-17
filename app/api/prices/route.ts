import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from '@/lib/types/api';
import { ProductPriceRow } from '@/lib/types/price';
import { NextRequest, NextResponse } from 'next/server';

const VALID_SORT_FIELDS = ['part_number', 'cost_price', 'sell_price'] as const;
const VALID_PAGE_SIZES = [25, 50] as const;

type SortField = typeof VALID_SORT_FIELDS[number];

/**
 * GET /api/prices
 * Returns paginated, searchable, sortable product list with cost_price and sell_price.
 *
 * Query params:
 *   page       - page number (default: 1)
 *   pageSize   - 25 | 50 (default: 25)
 *   search     - filter by part_number or model (case-insensitive)
 *   sortBy     - part_number | cost_price | sell_price (default: part_number)
 *   sortOrder  - asc | desc (default: asc)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const rawPageSize = parseInt(searchParams.get('pageSize') || '25');
    const pageSize = VALID_PAGE_SIZES.includes(rawPageSize as typeof VALID_PAGE_SIZES[number])
      ? rawPageSize
      : 25;
    const search = searchParams.get('search') || '';
    const rawSortBy = searchParams.get('sortBy') || 'part_number';
    const sortBy: SortField = VALID_SORT_FIELDS.includes(rawSortBy as SortField)
      ? (rawSortBy as SortField)
      : 'part_number';
    const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';

    let query = supabase
      .from('products')
      .select('id, part_number, model, cost_price, sell_price', { count: 'exact' })
      .order(sortBy, { ascending: sortOrder === 'asc' });

    if (search) {
      query = query.or(
        `part_number.ilike.%${search}%,model.ilike.%${search}%`
      );
    }

    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json(createErrorResponse(error.message), { status: 500 });
    }

    const rows = (data || []) as ProductPriceRow[];
    const total = count ?? 0;

    return NextResponse.json(
      createSuccessResponse(createPaginatedResponse(rows, total, page, pageSize))
    );
  } catch (error) {
    console.error('Error fetching price list:', error);
    return NextResponse.json(createErrorResponse('Failed to fetch price list'), { status: 500 });
  }
}
