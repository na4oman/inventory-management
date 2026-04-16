-- Migration: Fix RPC Function Syntax
-- Description: Fixes SQL syntax errors in RPC functions ($ -> $$)
-- This ensures inventory deduction works correctly when sales are created

-- Drop existing functions to recreate them with correct syntax
DROP FUNCTION IF EXISTS increment_booked_qty(UUID, INTEGER);
DROP FUNCTION IF EXISTS deduct_inventory(UUID, INTEGER);
DROP FUNCTION IF EXISTS deduct_free_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS generate_order_number();
DROP FUNCTION IF EXISTS generate_sale_number();

-- Function to increment booked quantity
CREATE OR REPLACE FUNCTION increment_booked_qty(
  product_id UUID,
  amount INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products
  SET booked_qty = booked_qty + amount
  WHERE id = product_id;
END;
$$;

-- Function to deduct inventory (both qty and booked_qty)
-- Used when sales are created from order items
CREATE OR REPLACE FUNCTION deduct_inventory(
  product_id UUID,
  quantity INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products
  SET 
    qty = qty - quantity,
    booked_qty = booked_qty - quantity
  WHERE id = product_id;
  
  -- Ensure qty doesn't go negative
  IF (SELECT qty FROM products WHERE id = product_id) < 0 THEN
    RAISE EXCEPTION 'Insufficient inventory for product %', product_id;
  END IF;
END;
$$;

-- Function to deduct free stock (only qty, not booked_qty)
-- Used when sales are created from free stock
CREATE OR REPLACE FUNCTION deduct_free_stock(
  product_id UUID,
  quantity INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products
  SET qty = qty - quantity
  WHERE id = product_id;
  
  -- Ensure qty doesn't go negative
  IF (SELECT qty FROM products WHERE id = product_id) < 0 THEN
    RAISE EXCEPTION 'Insufficient free stock for product %', product_id;
  END IF;
END;
$$;

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_num INTEGER;
  order_num TEXT;
BEGIN
  -- Get the next sequence number
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM orders
  WHERE order_number LIKE 'ORD%';
  
  -- Format as ORD00001, ORD00002, etc.
  order_num := 'ORD' || LPAD(next_num::TEXT, 5, '0');
  
  RETURN order_num;
END;
$$;

-- Function to generate sale number
CREATE OR REPLACE FUNCTION generate_sale_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_num INTEGER;
  sale_num TEXT;
BEGIN
  -- Get the next sequence number
  SELECT COALESCE(MAX(CAST(SUBSTRING(sale_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_num
  FROM sales
  WHERE sale_number LIKE 'SAL%';
  
  -- Format as SAL00001, SAL00002, etc.
  sale_num := 'SAL' || LPAD(next_num::TEXT, 5, '0');
  
  RETURN sale_num;
END;
$$;
