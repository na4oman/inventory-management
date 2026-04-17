-- Fix: replace create_inventory_lot RPC to remove invalid FOR UPDATE on aggregate query.
-- The product row is locked instead, which achieves the same race-prevention goal.

CREATE OR REPLACE FUNCTION create_inventory_lot(
  p_product_id    UUID,
  p_quantity      INTEGER,
  p_cost_price    NUMERIC,
  p_source        TEXT,
  p_arrival_date  DATE,
  p_order_item_id UUID DEFAULT NULL,
  p_notes         TEXT DEFAULT NULL
)
RETURNS inventory_lots
LANGUAGE plpgsql
AS $$
DECLARE
  v_lot_number  INTEGER;
  v_lot         inventory_lots;
BEGIN
  -- Validate inputs
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be greater than zero';
  END IF;
  IF p_cost_price < 0 THEN
    RAISE EXCEPTION 'cost_price must be non-negative';
  END IF;
  IF p_source = 'order' AND p_cost_price = 0 THEN
    RAISE EXCEPTION 'cost_price must be greater than zero for order lots';
  END IF;

  -- Lock the product row to prevent concurrent lot number races
  -- (FOR UPDATE on a concrete row is valid; FOR UPDATE on an aggregate is not)
  PERFORM id FROM products WHERE id = p_product_id FOR UPDATE;

  -- Assign next lot number
  SELECT COALESCE(MAX(lot_number), 0) + 1
    INTO v_lot_number
    FROM inventory_lots
   WHERE product_id = p_product_id;

  -- Insert lot
  INSERT INTO inventory_lots (
    product_id, lot_number, cost_price, remaining_qty, original_qty,
    status, source, order_item_id, arrival_date, notes
  ) VALUES (
    p_product_id, v_lot_number, p_cost_price, p_quantity, p_quantity,
    'active', p_source, p_order_item_id, p_arrival_date, p_notes
  )
  RETURNING * INTO v_lot;

  -- Sync products.qty = sum of active lot remaining_qty
  UPDATE products
     SET qty = (
       SELECT COALESCE(SUM(remaining_qty), 0)
         FROM inventory_lots
        WHERE product_id = p_product_id
          AND status = 'active'
     )
   WHERE id = p_product_id;

  RETURN v_lot;
END;
$$;
