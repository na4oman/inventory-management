/**
 * Price List Management Types
 */

export interface ProductPriceRow {
  id: string;
  part_number: string;
  model: string;
  cost_price: number;
  sell_price: number;
}

export interface PriceHistoryEntry {
  id: string;
  product_id: string;
  field_name: 'cost_price' | 'sell_price';
  old_value: number;
  new_value: number;
  changed_by: string;
  changed_at: string;
}

export interface CustomerPrice {
  id: string;
  client_id: string;
  product_id: string;
  price: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerPriceWithDetails extends CustomerPrice {
  client?: { name: string };
  product?: { part_number: string; model: string };
}

export interface SuggestedPrice {
  price: number;
  source: 'customer_price' | 'sell_price';
}

export interface PriceImportRow {
  part_number: string;
  new_price: number;
  description?: string;
}

export interface ImportResult {
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];   // per-row error messages including Excel row number
}
