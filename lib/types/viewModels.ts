/**
 * View Model Types
 * Extended types used in API responses and UI components
 */

import type {
  Product,
  Client,
  Order,
  OrderItem,
  Sale,
  SaleItem,
} from './database';

/**
 * Product with computed available quantity
 */
export interface ProductWithAvailability extends Product {
  available_qty: number; // Computed: qty - booked_qty
}

/**
 * Order item with associated product details
 */
export interface OrderItemWithProduct extends OrderItem {
  product: Product;
}

/**
 * Order with related client and items
 */
export interface OrderWithDetails extends Order {
  client: Client;
  items: OrderItemWithProduct[];
  item_count: number;
}

/**
 * Sale item with associated product details
 */
export interface SaleItemWithProduct extends SaleItem {
  product: Product;
}

/**
 * Sale with related client and items
 */
export interface SaleWithDetails extends Sale {
  client: Client;
  items: SaleItemWithProduct[];
  item_count: number;
}

/**
 * Inventory overview aggregated data
 */
export interface InventoryOverview {
  total_qty: number; // Sum of all product quantities
  booked_qty: number; // Sum of all booked quantities
  available_qty: number; // total_qty - booked_qty
  total_value: number; // Sum of (qty * cost_price)
  total_products: number; // Count of products
}

/**
 * Top selling product information
 */
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

/**
 * Sales aggregated by period
 */
export interface SalesByPeriod {
  period: string; // Date string (YYYY-MM-DD or YYYY-MM)
  total_sales: number; // Count of sales in period
  total_revenue: number; // Sum of sale amounts
  total_profit: number; // Sum of profits
}

/**
 * Analytics summary with aggregated metrics
 */
export interface AnalyticsSummary {
  total_revenue: number;
  total_profit: number;
  total_sales: number;
  profit_margin: number; // (total_profit / total_revenue) * 100
  top_selling_products: TopSellingProduct[];
  sales_by_period: SalesByPeriod[];
}
