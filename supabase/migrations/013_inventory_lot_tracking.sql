-- Migration: Inventory Lot Tracking
-- Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 5.1, 5.2, 5.4, 6.1, 7.1, 9.1, 9.3

-- ============================================================
-- 1. inventory_lots table
-- ============================================================

CREATE TABLE inventory_lots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  lot_number      INTEGER NOT NULL,
  cost_price      NUMERIC(10, 2) NOT NULL CHECK (cost_price >= 0),
  remaining_qty   INTEGER NOT NULL CHECK (remaining_qty >= 0),
  original_qty    INTEGER NOT NULL CHECK (original_qty > 0),
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'depleted')),
  source          TEXT NOT NULL CHECK (source IN ('order', 'free_stock')),
  order_item_id   UUID REFERENCES order_items(id) ON DELETE SET NULL,
  arrival_date    DATE NOT NULL,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, lot_number)
);

-- ============================================================
-- 2. Indexes on inventory_lots
-- ============================================================

CREATE INDEX idx_inventory_lots_product_id       ON inventory_lots (product_id);
CREATE INDEX idx_inventory_lots_status            ON inventory_lots (status);
CREATE INDEX idx_inventory_lots_product_status    ON inventory_lots (product_id, status);
CREATE INDEX idx_inventory_lots_order_item_id     ON inventory_lots (order_item_id);

-- ============================================================
-- 3. lot_allocations table
-- ============================================================

CREATE TABLE lot_allocations (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id                     UUID NOT NULL REFERENCES inventory_lots(id) ON DELETE RESTRICT,
  sale_item_id               UUID NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  quantity_allocated         INTEGER NOT NULL CHECK (quantity_allocated > 0),
  cost_price_at_time_of_sale NUMERIC(10, 2) NOT NULL,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. Indexes on lot_allocations
-- ============================================================

CREATE INDEX idx_lot_allocations_lot_id       ON lot_allocations (lot_id);
CREATE INDEX idx_lot_allocations_sale_item_id ON lot_allocations (sale_item_id);

-- ============================================================
-- 5. prevent_cost_price_update trigger (Requirement 7.1)
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_cost_price_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cost_price <> OLD.cost_price THEN
    RAISE EXCEPTION 'cost_price is immutable after lot creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_lot_cost_price_immutable
  BEFORE UPDATE ON inventory_lots
  FOR EACH ROW EXECUTE FUNCTION prevent_cost_price_update();

-- ============================================================
-- 6. create_inventory_lot RPC
--    Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5,
--                  6.1, 9.1, 9.3
-- ============================================================

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

-- ============================================================
-- 7. process_lot_sale RPC
--    Requirements: 5.1, 5.2, 5.4, 5.6, 6.1
-- ============================================================

CREATE OR REPLACE FUNCTION process_lot_sale(
  p_sale_item_id  UUID,
  p_allocations   JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_alloc       JSONB;
  v_lot         inventory_lots;
  v_product_id  UUID;
BEGIN
  -- Process each allocation
  FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
  LOOP
    -- Lock and fetch lot
    SELECT * INTO v_lot
      FROM inventory_lots
     WHERE id = (v_alloc->>'lot_id')::UUID
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'lot % not found', v_alloc->>'lot_id';
    END IF;

    IF v_lot.status = 'depleted' THEN
      RAISE EXCEPTION 'lot % is already depleted', v_lot.id;
    END IF;

    IF v_lot.remaining_qty < (v_alloc->>'quantity')::INTEGER THEN
      RAISE EXCEPTION 'insufficient quantity in lot %. Available: %, Requested: %',
        v_lot.id, v_lot.remaining_qty, (v_alloc->>'quantity')::INTEGER;
    END IF;

    v_product_id := v_lot.product_id;

    -- Decrement lot
    UPDATE inventory_lots
       SET remaining_qty = remaining_qty - (v_alloc->>'quantity')::INTEGER,
           status = CASE
             WHEN remaining_qty - (v_alloc->>'quantity')::INTEGER = 0 THEN 'depleted'
             ELSE 'active'
           END
     WHERE id = v_lot.id;

    -- Record allocation
    INSERT INTO lot_allocations (lot_id, sale_item_id, quantity_allocated, cost_price_at_time_of_sale)
    VALUES (
      v_lot.id,
      p_sale_item_id,
      (v_alloc->>'quantity')::INTEGER,
      v_lot.cost_price
    );
  END LOOP;

  -- Sync products.qty for the product (all allocations are for the same product)
  IF v_product_id IS NOT NULL THEN
    UPDATE products
       SET qty = (
         SELECT COALESCE(SUM(remaining_qty), 0)
           FROM inventory_lots
          WHERE product_id = v_product_id
            AND status = 'active'
       )
     WHERE id = v_product_id;
  END IF;
END;
$$;
