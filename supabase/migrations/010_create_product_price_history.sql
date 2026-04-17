-- Migration: Create product_price_history table
-- Requirements: 2.2, 3.1, 3.3, 7.1

CREATE TABLE product_price_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  field_name  text NOT NULL CHECK (field_name IN ('cost_price', 'sell_price')),
  old_value   numeric(12, 4) NOT NULL,
  new_value   numeric(12, 4) NOT NULL,
  changed_by  text NOT NULL,          -- Clerk userId
  changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_product_id ON product_price_history(product_id);
CREATE INDEX idx_price_history_changed_at ON product_price_history(changed_at DESC);
