# Supabase Setup Guide

This guide explains how to set up the Supabase database for the Inventory Management App.

## Prerequisites

1. Create a Supabase project at https://supabase.com
2. Get your project URL and anon key from the Supabase dashboard
3. Add these to your `.env.local` file:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

## Applying Migrations

### Option 1: Using Supabase Dashboard (Recommended for Development)

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Create a new query and copy the contents of each migration file in order:
   - `supabase/migrations/001_create_tables.sql`
   - `supabase/migrations/002_enable_rls_and_policies.sql`
   - `supabase/migrations/003_create_rpc_functions.sql`
4. Execute each query

### Option 2: Using Supabase CLI

1. Install Supabase CLI: `npm install -g supabase`
2. Link your project: `supabase link --project-ref your_project_ref`
3. Push migrations: `supabase db push`

## Database Schema Overview

### Tables Created

1. **products** - Mobile parts inventory
   - Tracks qty (total) and booked_qty (reserved in orders)
   - Indexed for fast search and filtering

2. **clients** - Customer information
   - Associated with orders and sales

3. **orders** - Client purchase orders
   - Status: pending, completed, or cancelled
   - Reserves inventory via booked_qty

4. **order_items** - Line items in orders
   - Links products to orders with quantity and pricing

5. **sales** - Completed transactions
   - Deducts inventory and records profit
   - Can be linked to orders or created directly

6. **sale_items** - Line items in sales
   - Tracks unit cost for profit calculation

### Row-Level Security (RLS)

All tables have RLS enabled with policies that ensure:
- Users can only see their own data (filtered by user_id)
- Order items are accessible via order ownership
- Sale items are accessible via sale ownership

### RPC Functions

1. **increment_booked_qty(product_id, amount)** - Increments booked quantity
2. **deduct_inventory(product_id, quantity)** - Deducts both qty and booked_qty
3. **generate_order_number()** - Generates unique order numbers (ORD00001 format)
4. **generate_sale_number()** - Generates unique sale numbers (SAL00001 format)

### Indexes

Composite and single-column indexes are created for optimal query performance:
- Products: user_id, part_number, model_code, created_at, and composite (user_id, part_number, model)
- Orders: user_id, client_id, status, created_at, and composite (user_id, status, created_at)
- Sales: user_id, client_id, sale_date, order_id
- Order/Sale items: order_id, product_id, sale_id

## Testing the Setup

After applying migrations, test the setup:

```typescript
import { supabase } from '@/lib/supabase/client';

// Test connection
const { data, error } = await supabase
  .from('products')
  .select('count')
  .single();

if (error) {
  console.error('Connection failed:', error);
} else {
  console.log('Connection successful!');
}
```

## Troubleshooting

### RLS Policy Errors

If you get "new row violates row-level security policy" errors:
- Ensure your Clerk user ID is being passed as `user_id` in the database
- Check that the RLS policies are correctly comparing `user_id` with `auth.uid()::text`

### Function Not Found Errors

If RPC functions aren't found:
- Verify all three migration files have been executed
- Check the Supabase SQL Editor for any errors during execution

### Connection Issues

If the app can't connect to Supabase:
- Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly
- Check that your Supabase project is active and not paused
- Ensure the anon key has appropriate permissions

## Next Steps

1. Implement API routes in `app/api/`
2. Create React Query hooks in `lib/hooks/`
3. Build UI components for products, orders, sales, and analytics
4. Test the complete workflow end-to-end
