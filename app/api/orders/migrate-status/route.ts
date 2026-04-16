import { supabaseServer as supabase } from '@/lib/supabase/server';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/orders/migrate-status
 * Migrate order statuses to support the new "received" status
 * This updates the database constraint to allow 'received' status
 */
export async function POST(request: NextRequest) {
  try {
    // This endpoint documents the database changes needed
    // In Supabase, you need to update the constraint on the orders table
    
    // The SQL to run in Supabase SQL Editor:
    // ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
    // ALTER TABLE orders ADD CONSTRAINT orders_status_check 
    //   CHECK (status IN ('pending', 'received', 'completed', 'cancelled'));

    // For now, we'll just return instructions
    const instructions = {
      message: 'To enable the "received" status, run the following SQL in Supabase:',
      sql: `
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN ('pending', 'received', 'completed', 'cancelled'));
      `,
      steps: [
        '1. Go to your Supabase project dashboard',
        '2. Click on "SQL Editor" in the left sidebar',
        '3. Click "New Query"',
        '4. Copy and paste the SQL above',
        '5. Click "Run"',
        '6. The constraint will be updated to allow the "received" status'
      ],
      notes: [
        'This change allows orders to have the status: pending, received, completed, or cancelled',
        'Existing orders will continue to work with their current status',
        'New orders can now use the "received" status when all items are marked as received'
      ]
    };

    return NextResponse.json(createSuccessResponse(instructions));
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      createErrorResponse('Failed to process migration'),
      { status: 500 }
    );
  }
}
