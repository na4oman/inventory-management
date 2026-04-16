-- Migration: Create price_check_history table
CREATE TABLE price_check_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  part_number TEXT NOT NULL,
  searched_at TIMESTAMPTZ DEFAULT NOW(),
  results JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_price_check_history_part_number ON price_check_history(part_number);
CREATE INDEX idx_price_check_history_searched_at ON price_check_history(searched_at DESC);
