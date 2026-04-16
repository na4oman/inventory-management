-- Migration: Fix products.qty to reflect actual warehouse stock from order_items.wh_qty
-- Also reset corrupted booked_qty values

-- Reset booked_qty to 0 for all products (it was being incorrectly decremented)
UPDATE products SET booked_qty = 0;

-- Sync products.qty with the sum of wh_qty from order_items for each product
UPDATE products p
SET qty = COALESCE((
  SELECT SUM(oi.wh_qty)
  FROM order_items oi
  WHERE oi.product_id = p.id
), p.qty);
-- Note: Products with no order_items keep their existing qty (free stock)
