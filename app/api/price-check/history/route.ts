import { NextRequest, NextResponse } from 'next/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { supabaseServer as supabase } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const partNumber = request.nextUrl.searchParams.get('partNumber');

  let query = supabase
    .from('price_check_history')
    .select('*')
    .order('searched_at', { ascending: false })
    .limit(50);

  if (partNumber) {
    query = query.eq('part_number', partNumber);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(createErrorResponse(error.message), { status: 500 });
  }

  return NextResponse.json(createSuccessResponse(data || []));
}
