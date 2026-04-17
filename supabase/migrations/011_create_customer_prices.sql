-- Migration: Create customer_prices table
-- Requirements: 4.1, 4.2

CREATE TABLE customer_prices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  price       numeric(12, 4) NOT NULL CHECK (price >= 0),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_customer_price UNIQUE (client_id, product_id)
);

CREATE INDEX idx_customer_prices_client_id ON customer_prices(client_id);
CREATE INDEX idx_customer_prices_product_id ON customer_prices(product_id);
