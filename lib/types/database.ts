// Product table
export interface Product {
  id: string;
  part_number: string;
  model: string;
  model_code: string;
  description: string;
  color: string | null;
  qty: number;
  booked_qty: number;
  cost_price: number;
  sell_price: number;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

// Client table
export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

// Order table
export interface Order {
  id: string;
  order_number: string;
  client_id: string | null;
  order_type: 'customer' | 'forecast';
  status: 'pending' | 'received' | 'completed' | 'cancelled';
  total_amount: number;
  notes: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

// Order item table
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  ordered_qty: number;
  forwarded_qty: number;
  received_qty: number;
  wh_qty: number;
  sold_qty: number;
  unit_price: number;
  unit_cost: number;
  created_at: string;
  // Legacy columns (kept for backward compatibility)
  shipped_qty?: number;
}

// Sale table
export interface Sale {
  id: string;
  sale_number: string;
  client_id: string;
  total_amount: number;
  total_cost: number;
  profit: number;
  notes: string | null;
  sale_date: string;
  user_id: string | null;
  created_at: string;
}

// Sale item table
export interface SaleItem {
  id: string;
  sale_id: string;
  order_item_id: string | null;
  product_id: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  subtotal: number;
  cost_total: number;
  profit: number;
  created_at: string;
}

// View models with relationships
export interface ProductWithAvailability extends Product {
  available_qty: number;
}

export interface OrderItemWithProduct extends OrderItem {
  product: Product;
}

export interface OrderWithDetails extends Order {
  client: Client | null;
  items: OrderItemWithProduct[];
  item_count: number;
}

export interface SaleItemWithProduct extends SaleItem {
  product: Product;
}

export interface SaleWithDetails extends Sale {
  client: Client;
  items: SaleItemWithProduct[];
  item_count: number;
}

export interface InventoryOverview {
  total_qty: number;
  booked_qty: number;
  available_qty: number;
  total_value: number;
  total_products: number;
}

export interface TopSellingProduct {
  product_id: string;
  part_number: string;
  model: string;
  total_quantity_sold: number;
  total_revenue: number;
  total_profit: number;
  total_cost: number;
  avg_margin: number; // (total_profit / total_cost) * 100
}

export interface SalesByPeriod {
  period: string;
  total_sales: number;
  total_revenue: number;
  total_profit: number;
}

export interface AnalyticsSummary {
  total_revenue: number;
  total_profit: number;
  total_sales: number;
  profit_margin: number;
  top_selling_products: TopSellingProduct[];
  sales_by_period: SalesByPeriod[];
}
