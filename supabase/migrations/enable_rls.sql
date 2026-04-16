-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies first (safe to run multiple times)
DROP POLICY IF EXISTS "block_anon_products" ON products;
DROP POLICY IF EXISTS "block_anon_clients" ON clients;
DROP POLICY IF EXISTS "block_anon_orders" ON orders;
DROP POLICY IF EXISTS "block_anon_order_items" ON order_items;
DROP POLICY IF EXISTS "block_anon_sales" ON sales;
DROP POLICY IF EXISTS "block_anon_sale_items" ON sale_items;

-- No policies = no access for anon/authenticated roles
-- The service_role key bypasses RLS entirely, so your API routes still work.
-- This effectively makes all tables private to direct client access.

-- Optional: if you ever need Supabase Auth users to access their own rows,
-- you can add policies like:
--
-- CREATE POLICY "users_own_products" ON products
--   FOR ALL USING (auth.uid()::text = user_id);
