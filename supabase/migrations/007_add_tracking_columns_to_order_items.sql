-- Migration: Add tracking columns to order_items table
-- Description: Restructure order_items to properly track different quantities
-- 
-- Current structure (problematic):
-- - ordered_qty: Total ordered from PO
-- - received_qty: Currently used for "forwarded to suppliers"
-- - shipped_qty: Currently used for "sold qty"
--
-- New structure (correct):
-- - ordered_qty: Total ordered from PO (unchanged)
-- - forwarded_qty: Qty forwarded to suppliers (NEW - rename from received_qty usage)
-- - received_qty: Total collected from deliveries (NEW)
-- - wh_qty: Current warehouse stock ready to sell (NEW)
-- - sold_qty: Total sold qty accumulated (NEW - rename from shipped_qty)

-- Add new columns
ALTER TABLE order_items ADD COLUMN forwarded_qty INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN wh_qty INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN sold_qty INTEGER DEFAULT 0;

-- Migrate existing data:
-- Copy received_qty to forwarded_qty (qty forwarded to suppliers)
UPDATE order_items SET forwarded_qty = received_qty;
-- Copy shipped_qty to sold_qty (total sold)
UPDATE order_items SET sold_qty = shipped_qty;
-- Initialize received_qty to 0 (will be updated when items are received)
UPDATE order_items SET received_qty = 0;
-- Initialize wh_qty to 0 (will be calculated or updated)
UPDATE order_items SET wh_qty = 0;

-- Create indexes for better query performance
CREATE INDEX idx_order_items_forwarded_qty ON order_items(forwarded_qty);
CREATE INDEX idx_order_items_received_qty ON order_items(received_qty);
CREATE INDEX idx_order_items_wh_qty ON order_items(wh_qty);
CREATE INDEX idx_order_items_sold_qty ON order_items(sold_qty);

-- Note: Keep shipped_qty for backward compatibility, but use sold_qty going forward
