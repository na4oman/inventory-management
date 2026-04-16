-- Enable Row Level Security on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Products policies
CREATE POLICY "Users can view their own products"
  ON products FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own products"
  ON products FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own products"
  ON products FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own products"
  ON products FOR DELETE
  USING (user_id = auth.uid()::text);

-- Clients policies
CREATE POLICY "Users can view their own clients"
  ON clients FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own clients"
  ON clients FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own clients"
  ON clients FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own clients"
  ON clients FOR DELETE
  USING (user_id = auth.uid()::text);

-- Orders policies
CREATE POLICY "Users can view their own orders"
  ON orders FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own orders"
  ON orders FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own orders"
  ON orders FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own orders"
  ON orders FOR DELETE
  USING (user_id = auth.uid()::text);

-- Order items policies - access via order ownership
CREATE POLICY "Users can view order items from their orders"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert order items to their orders"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()::text
    )
  );

-- Sales policies
CREATE POLICY "Users can view their own sales"
  ON sales FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own sales"
  ON sales FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- Sale items policies - access via sale ownership
CREATE POLICY "Users can view sale items from their sales"
  ON sale_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
      AND sales.user_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert sale items to their sales"
  ON sale_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales
      WHERE sales.id = sale_items.sale_id
      AND sales.user_id = auth.uid()::text
    )
  );
