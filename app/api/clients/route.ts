import { auth } from '@clerk/nextjs/server';
import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createClientSchema } from '@/lib/validations/client';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from '@/lib/types/api';
import { Client } from '@/lib/types/database';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/clients
 * Retrieve paginated list of clients with search, filter, and sort
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '10')));
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Build query for count
    let countQuery = supabase
      .from('clients')
      .select('*', { count: 'exact', head: true });

    // Apply search filter to count query
    if (search) {
      countQuery = countQuery.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    const { count } = await countQuery;

    // Build query for data
    let query = supabase
      .from('clients')
      .select('*');

    // Apply search filter
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
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

    const total = count || 0;
    const response = createPaginatedResponse(
      data || [],
      total,
      page,
      pageSize
    );

    return NextResponse.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json(
      createErrorResponse('Failed to fetch clients'),
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients
 * Create a new client
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = createClientSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        createErrorResponse(firstError?.message || 'Validation failed'),
        { status: 400 }
      );
    }

    const clientData = validationResult.data;

    // Insert client with user_id
    const { data, error } = await supabase
      .from('clients')
      .insert({
        ...clientData,
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
    console.error('Error creating client:', error);
    return NextResponse.json(
      createErrorResponse('Failed to create client'),
      { status: 500 }
    );
  }
}
