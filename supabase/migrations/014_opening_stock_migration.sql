  -- Migration: create opening stock lots for all products with qty > 0
  -- This is idempotent: products that already have inventory lots are skipped.

  DO $$
  DECLARE
    v_product RECORD;
  BEGIN
    FOR v_product IN
      SELECT id, qty, cost_price FROM products WHERE qty > 0
    LOOP
      -- Skip products that already have inventory lots (idempotency guard)
      IF EXISTS (SELECT 1 FROM inventory_lots WHERE product_id = v_product.id) THEN
        CONTINUE;
      END IF;

      PERFORM create_inventory_lot(
        p_product_id    => v_product.id,
        p_quantity      => v_product.qty,
        p_cost_price    => v_product.cost_price,
        p_source        => 'free_stock',
        p_arrival_date  => CURRENT_DATE,
        p_notes         => 'Opening stock — migrated from legacy qty field'
      );
    END LOOP;
  END;
  $$;
