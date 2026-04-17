-- Migration: Create update_product_price RPC function
-- Requirements: 7.1, 7.2, 7.3

CREATE OR REPLACE FUNCTION update_product_price(
  p_product_id  uuid,
  p_field_name  text,
  p_new_value   numeric,
  p_changed_by  text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_value numeric;
BEGIN
  -- Lock the row and read current value
  SELECT CASE WHEN p_field_name = 'cost_price' THEN cost_price ELSE sell_price END
  INTO v_old_value
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  -- No-op if value is unchanged (Req 7.3)
  IF v_old_value = p_new_value THEN
    RETURN;
  END IF;

  -- Update the product price
  IF p_field_name = 'cost_price' THEN
    UPDATE products SET cost_price = p_new_value, updated_at = now() WHERE id = p_product_id;
  ELSE
    UPDATE products SET sell_price = p_new_value, updated_at = now() WHERE id = p_product_id;
  END IF;

  -- Write history entry in same transaction
  INSERT INTO product_price_history (product_id, field_name, old_value, new_value, changed_by)
  VALUES (p_product_id, p_field_name, v_old_value, p_new_value, p_changed_by);
END;
$$;
