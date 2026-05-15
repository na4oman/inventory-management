/**
 * Database Schema Map
 *
 * Single source of truth for every table's column names.
 * Use these constants instead of raw strings when building queries,
 * selecting fields, or passing data between tables — so a column rename
 * in a migration is a one-line fix here rather than a grep-and-pray.
 *
 * Tables covered:
 *   products · clients · orders · order_items
 *   sales · sale_items · inventory_lots · lot_allocations
 *   customer_prices · price_check_history · product_price_history
 */

// ─── products ────────────────────────────────────────────────────────────────
export const PRODUCTS = {
  id:          'id',
  part_number: 'part_number',
  model:       'model',
  model_code:  'model_code',
  description: 'description',
  color:       'color',
  /** Total warehouse stock — kept in sync by create_inventory_lot / process_lot_sale RPCs */
  qty:         'qty',
  /** Reserved qty (booked by pending orders) */
  booked_qty:  'booked_qty',
  /** Purchase / cost price */
  cost_price:  'cost_price',
  /** Selling price */
  sell_price:  'sell_price',
  user_id:     'user_id',
  created_at:  'created_at',
  updated_at:  'updated_at',
} as const;

// ─── clients ─────────────────────────────────────────────────────────────────
export const CLIENTS = {
  id:         'id',
  name:       'name',
  email:      'email',
  phone:      'phone',
  address:    'address',
  user_id:    'user_id',
  created_at: 'created_at',
  updated_at: 'updated_at',
} as const;

// ─── orders ──────────────────────────────────────────────────────────────────
export const ORDERS = {
  id:           'id',
  order_number: 'order_number',
  client_id:    'client_id',
  /** 'pending' | 'completed' | 'cancelled' */
  status:       'status',
  total_amount: 'total_amount',
  notes:        'notes',
  user_id:      'user_id',
  created_at:   'created_at',
  updated_at:   'updated_at',
} as const;

// ─── order_items ─────────────────────────────────────────────────────────────
//
// Column history (important — this is where bugs have bitten us):
//
//   ordered_qty   – Total qty requested in the purchase order
//   forwarded_qty – Qty forwarded to the supplier (was misused as received_qty pre-migration 007)
//   received_qty  – Qty physically collected from deliveries
//   wh_qty        – Current warehouse stock for this line (drives inventory_lots creation)
//   sold_qty      – Cumulative qty sold (was misused as shipped_qty pre-migration 007)
//   shipped_qty   – Legacy column kept for backward compat; prefer sold_qty
//   unit_price    – Price per unit charged to the client
//                   ⚠️  There is NO cost_price column on order_items.
//                       Use PRODUCTS.cost_price when you need the purchase cost,
//                       or order_items.unit_price as the cost basis for inventory lots.
//
export const ORDER_ITEMS = {
  id:            'id',
  order_id:      'order_id',
  product_id:    'product_id',
  ordered_qty:   'ordered_qty',
  forwarded_qty: 'forwarded_qty',
  received_qty:  'received_qty',
  wh_qty:        'wh_qty',
  sold_qty:      'sold_qty',
  /** @deprecated use sold_qty */
  shipped_qty:   'shipped_qty',
  /**
   * Price per unit for this line item.
   * ⚠️  This is the only price column on order_items.
   *     When creating an inventory lot from an order item, pass this as p_cost_price.
   *     Do NOT use `cost_price` — that column does not exist on this table.
   */
  unit_price:    'unit_price',
  /** 'pending' | 'received' | 'shipped' */
  status:        'status',
  created_at:    'created_at',
  updated_at:    'updated_at',
} as const;

// ─── sales ───────────────────────────────────────────────────────────────────
export const SALES = {
  id:           'id',
  sale_number:  'sale_number',
  order_id:     'order_id',
  client_id:    'client_id',
  total_amount: 'total_amount',
  total_cost:   'total_cost',
  profit:       'profit',
  notes:        'notes',
  sale_date:    'sale_date',
  user_id:      'user_id',
  created_at:   'created_at',
} as const;

// ─── sale_items ──────────────────────────────────────────────────────────────
export const SALE_ITEMS = {
  id:            'id',
  sale_id:       'sale_id',
  order_item_id: 'order_item_id',
  product_id:    'product_id',
  quantity:      'quantity',
  unit_price:    'unit_price',
  unit_cost:     'unit_cost',
  subtotal:      'subtotal',
  cost_total:    'cost_total',
  profit:        'profit',
  created_at:    'created_at',
} as const;

// ─── inventory_lots ──────────────────────────────────────────────────────────
export const INVENTORY_LOTS = {
  id:            'id',
  product_id:    'product_id',
  lot_number:    'lot_number',
  /** Purchase cost at the time the lot was created — immutable after insert */
  cost_price:    'cost_price',
  remaining_qty: 'remaining_qty',
  original_qty:  'original_qty',
  /** 'active' | 'depleted' */
  status:        'status',
  /** 'order' | 'free_stock' */
  source:        'source',
  order_item_id: 'order_item_id',
  arrival_date:  'arrival_date',
  notes:         'notes',
  created_at:    'created_at',
} as const;

// ─── lot_allocations ─────────────────────────────────────────────────────────
export const LOT_ALLOCATIONS = {
  id:                         'id',
  lot_id:                     'lot_id',
  sale_item_id:               'sale_item_id',
  quantity_allocated:         'quantity_allocated',
  cost_price_at_time_of_sale: 'cost_price_at_time_of_sale',
  created_at:                 'created_at',
} as const;

// ─── customer_prices ─────────────────────────────────────────────────────────
export const CUSTOMER_PRICES = {
  id:         'id',
  client_id:  'client_id',
  product_id: 'product_id',
  price:      'price',
  created_at: 'created_at',
  updated_at: 'updated_at',
} as const;

// ─── price_check_history ─────────────────────────────────────────────────────
export const PRICE_CHECK_HISTORY = {
  id:          'id',
  part_number: 'part_number',
  searched_at: 'searched_at',
  results:     'results',
} as const;

// ─── product_price_history ───────────────────────────────────────────────────
export const PRODUCT_PRICE_HISTORY = {
  id:         'id',
  product_id: 'product_id',
  /** 'cost_price' | 'sell_price' */
  field_name: 'field_name',
  old_value:  'old_value',
  new_value:  'new_value',
  created_at: 'created_at',
} as const;

// ─── Cross-table mapping notes ───────────────────────────────────────────────
//
// When bridging tables, use these mappings to avoid confusion:
//
//  order_items → inventory_lots (creating a lot from a received order line)
//    order_items.product_id  → inventory_lots.product_id
//    order_items.wh_qty      → inventory_lots.original_qty / remaining_qty  (p_quantity)
//    order_items.unit_price  → inventory_lots.cost_price                    (p_cost_price)
//    order_items.id          → inventory_lots.order_item_id                 (p_order_item_id)
//    ⚠️  order_items has NO cost_price column — always use unit_price here.
//
//  products → inventory_lots (qty sync)
//    products.qty is always kept equal to SUM(inventory_lots.remaining_qty)
//    where inventory_lots.product_id = products.id AND status = 'active'
//    This sync is performed inside the create_inventory_lot and process_lot_sale RPCs.
//    Do NOT update products.qty directly.
//
//  sale_items → lot_allocations (recording which lots were consumed)
//    sale_items.id       → lot_allocations.sale_item_id
//    sale_items.quantity → lot_allocations.quantity_allocated (sum across lots)
//
