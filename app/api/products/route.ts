import { auth } from '@clerk/nextjs/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createProductSchema } from '@/lib/validations/product';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from '@/lib/types/api';
import { ProductWithAvailability } from '@/lib/types/database';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/products
 * Retrieve paginated list of products with search, filter, and sort
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.max(1, Math.min(1000, parseInt(searchParams.get('pageSize') || '10')));
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
    const priceMin = searchParams.get('priceMin') ? parseFloat(searchParams.get('priceMin')!) : undefined;
    const priceMax = searchParams.get('priceMax') ? parseFloat(searchParams.get('priceMax')!) : undefined;
    const stockMin = searchParams.get('stockMin') ? parseInt(searchParams.get('stockMin')!) : undefined;
    const stockMax = searchParams.get('stockMax') ? parseInt(searchParams.get('stockMax')!) : undefined;

    // Build query for data - fetch all products without search filter
    let query = supabase
      .from('products')
      .select('*');

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Fetch all products
    const { data: allProducts, error } = await query;

    if (error) {
      return NextResponse.json(
        createErrorResponse(error.message),
        { status: 500 }
      );
    }

    // Add computed available_qty field (direct from product.qty - current warehouse stock)
    let productsWithAvailability: ProductWithAvailability[] = (allProducts || [])
      .map(product => ({
        ...product,
        available_qty: product.qty,
      }));

    // Apply search filter client-side
    if (search) {
      const searchLower = search.toLowerCase();
      productsWithAvailability = productsWithAvailability.filter(product => {
        const searchStr = `${product.part_number} ${product.model} ${product.model_code} ${product.description}`.toLowerCase();
        return searchStr.includes(searchLower);
      });
    }

    // Apply price filters
    if (priceMin !== undefined) {
      productsWithAvailability = productsWithAvailability.filter(p => p.sell_price >= priceMin);
    }
    if (priceMax !== undefined) {
      productsWithAvailability = productsWithAvailability.filter(p => p.sell_price <= priceMax);
    }

    // Apply stock filters
    if (stockMin !== undefined) {
      productsWithAvailability = productsWithAvailability.filter(p => p.available_qty >= stockMin);
    }
    if (stockMax !== undefined) {
      productsWithAvailability = productsWithAvailability.filter(p => p.available_qty <= stockMax);
    }

    // Remove duplicates by ID
    const uniqueProducts = Array.from(
      new Map(productsWithAvailability.map(p => [p.id, p])).values()
    );

    // Calculate total after filtering
    const total = uniqueProducts.length;

    // Apply pagination
    const offset = (page - 1) * pageSize;
    const paginatedData = uniqueProducts.slice(offset, offset + pageSize);

    const response = createPaginatedResponse(
      paginatedData,
      total,
      page,
      pageSize
    );

    return NextResponse.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      createErrorResponse('Failed to fetch products'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/products
 * Create a new product
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = createProductSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        createErrorResponse(firstError?.message || 'Validation failed'),
        { status: 400 }
      );
    }

    const productData = validationResult.data;

    // Insert product with user_id
    const { data, error } = await supabase
      .from('products')
      .insert({
        ...productData,
        booked_qty: 0,
        user_id: 'user_3AkTs21U6NLdEJWSYVJrW05kWIn',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        createErrorResponse(error.message),
        { status: 500 }
      );
    }

    return NextResponse.json(
      createSuccessResponse(data),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      createErrorResponse('Failed to create product'),
      { status: 500 }
    );
  }
}
