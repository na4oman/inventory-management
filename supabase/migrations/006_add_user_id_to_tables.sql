-- Migration: Add user_id column to tables for RLS
-- Description: Adds user_id column to products, clients, orders, and sales tables
-- This is required for the existing RLS policies to work correctly

-- Add user_id to products table
ALTER TABLE products ADD COLUMN user_id TEXT;

-- Add user_id to clients table
ALTER TABLE clients ADD COLUMN user_id TEXT;

-- Add user_id to orders table
ALTER TABLE orders ADD COLUMN user_id TEXT;

-- Add user_id to sales table
ALTER TABLE sales ADD COLUMN user_id TEXT;

-- Create indexes for better query performance
CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_sales_user_id ON sales(user_id);

-- Disable RLS temporarily to allow updates
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
