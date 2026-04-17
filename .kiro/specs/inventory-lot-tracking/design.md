# Design Document: Inventory Lot Tracking

## Overview

This feature replaces the current single `qty` field per product with a full lot/batch tracking system. Every stock arrival — whether from a supplier delivery linked to a pending order or a manual free-stock entry — is recorded as a distinct **inventory lot** with its own cost price, quantity, and arrival date. When selling from free stock, the user manually selects which lot(s) to draw from, enabling accurate per-lot cost tracking and profit calculation.

The key architectural constraint is that `products.qty` must remain the single source of truth for available stock in the UI, but its value must always be derived from (and kept in sync with) the sum of active lot `remaining_qty` values. This sync is enforced atomically inside Supabase RPCs.

### Existing flows being upgraded

| Flow | Current behaviour | New behaviour |
|---|---|---|
| Stock receipt from pending order | Increments `products.qty` directly | Calls `create_inventory_lot` RPC |
| Manual qty adjustment (ProductForm) | Updates `products.qty` directly | Creates a free-stock lot via `create_inventory_lot` RPC |
| Free-stock sale (CreateSaleForm) | Deducts `products.qty` directly | Shows `LotSelector`, passes lot allocations, calls `process_lot_sale` RPC |
| Product qty display | Reads `products.qty` | Reads `products.qty` (kept in sync by RPCs — no UI change needed) |

---

## Architecture

The system is layered as follows:

```
┌─────────────────────────────────────────────────────────┐
│  Next.js App Router (UI + API Routes)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │ LotSelector  │  │ ProductLots  │  │ CreateSaleForm│ │
│  │ (component)  │  │ Table (UI)   │  │ (upgraded)    │ │
│  └──────┬───────┘  └──────┬───────┘  └───────┬───────┘ │
│         │                 │                   │         │
│  ┌──────▼─────────────────▼───────────────────▼───────┐ │
│  │  API Routes: /api/inventory-lots, /api/sales       │ │
│  │  React Query hooks: useInventoryLots, useLots      │ │
│  └──────────────────────────┬──────────────────────────┘ │
└─────────────────────────────┼───────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────┐
│  Supabase (PostgreSQL)                                  │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │ inventory_lots  │  │ lot_allocations              │  │
│  │ table           │  │ table                        │  │
│  └────────┬────────┘  └──────────────────────────────┘  │
│           │                                              │
│  ┌────────▼──────────────────────────────────────────┐  │
│  │  RPCs (atomic, run inside transactions)           │  │
│  │  • create_inventory_lot(...)                      │  │
│  │  • process_lot_sale(allocations: [{lot_id, qty}]) │  │
│  │  Both RPCs sync products.qty after mutation       │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Design decisions

- **Sync via RPCs, not triggers**: `products.qty` is kept in sync inside the two RPCs rather than via a database trigger. This makes the sync logic explicit, testable, and avoids hidden trigger side-effects.
- **`products.qty` retained**: The field is kept as a denormalised cache of the lot sum. This avoids rewriting every query that reads product quantity across the app.
- **Cost price immutability enforced at DB level**: A `BEFORE UPDATE` trigger on `inventory_lots` raises an exception if `cost_price` is changed after creation.
- **Sequential lot numbers via DB sequence per product**: Implemented with a `SERIAL`-like counter using `MAX(lot_number) + 1` inside the `create_inventory_lot` RPC, wrapped in a row-level lock to prevent races.

---

## Components and Interfaces

### New API Routes

#### `GET /api/inventory-lots?product_id={id}&status=active`
Returns active lots for a product, ordered by `arrival_date ASC`.

Response:
```ts
{
  data: InventoryLot[]
  total: number
}
```

#### `POST /api/inventory-lots`
Creates a free-stock lot by calling the `create_inventory_lot` RPC.

Request body:
```ts
{
  product_id: string        // UUID
  quantity: number          // > 0
  cost_price: number        // >= 0
  arrival_date: string      // ISO date
  notes?: string
}
```

### New React Query Hooks

#### `useInventoryLots(productId: string, status?: 'active' | 'depleted' | 'all')`
Fetches lots for a product. Invalidated whenever a lot is created or a sale is confirmed.

#### `useLotSelector(productId: string)`
Thin wrapper over `useInventoryLots` that also manages local allocation state (selected lots + quantities). Returns:
```ts
{
  lots: InventoryLot[]
  allocations: LotAllocation[]
  setAllocation: (lotId: string, qty: number) => void
  totalAllocated: number
  isValid: boolean          // totalAllocated <= product.qty
  validationError: string | null
}
```

### New UI Components

#### `LotSelector`
Shown in `CreateSaleForm` for free-stock items. Replaces the simple qty input.

Props:
```ts
interface LotSelectorProps {
  productId: string
  maxQty: number            // product.qty — upper bound for total allocation
  onChange: (allocations: { lot_id: string; quantity: number }[]) => void
  disabled?: boolean
}
```

Renders a table of active lots with an inline quantity input per lot. Shows a running total and a validation error if total > maxQty.

#### `ProductLotsTable`
Shown on the product detail/edit page. Displays all active lots for the product.

Props:
```ts
interface ProductLotsTableProps {
  productId: string
  showDepleted?: boolean    // default false
}
```

Columns: Lot #, Arrival Date, Remaining Qty, Cost Price/unit, Status.

### Upgraded Components

#### `CreateSaleForm` (upgraded)
- Free-stock tab: replaces the single qty input with `<LotSelector>` per product.
- Passes `lot_allocations: { lot_id, quantity }[]` per free-stock item to the sale API.
- Cost calculation in the totals summary uses `cost_price_at_time_of_sale` from the selected lots.

#### `ProductForm` (upgraded)
- The `qty` field becomes read-only (displayed but not editable directly).
- A new "Add Free Stock" button opens a modal to create a free-stock lot, which updates `products.qty` via the RPC.

---

## Data Models

### `inventory_lots` table

```sql
CREATE TABLE inventory_lots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  lot_number      INTEGER NOT NULL,                    -- sequential per product
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

-- Prevent cost_price updates after creation
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
```

### `lot_allocations` table

```sql
CREATE TABLE lot_allocations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id                    UUID NOT NULL REFERENCES inventory_lots(id) ON DELETE RESTRICT,
  sale_item_id              UUID NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  quantity_allocated        INTEGER NOT NULL CHECK (quantity_allocated > 0),
  cost_price_at_time_of_sale NUMERIC(10, 2) NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### TypeScript types (additions to `lib/types/database.ts`)

```ts
export interface InventoryLot {
  id: string
  product_id: string
  lot_number: number
  cost_price: number
  remaining_qty: number
  original_qty: number
  status: 'active' | 'depleted'
  source: 'order' | 'free_stock'
  order_item_id: string | null
  arrival_date: string          // ISO date string
  notes: string | null
  created_at: string
}

export interface LotAllocation {
  id: string
  lot_id: string
  sale_item_id: string
  quantity_allocated: number
  cost_price_at_time_of_sale: number
  created_at: string
}

// Extended sale item to carry lot allocations
export interface SaleItemWithAllocations extends SaleItem {
  lot_allocations: LotAllocation[]
}
```

### Supabase RPC: `create_inventory_lot`

```sql
CREATE OR REPLACE FUNCTION create_inventory_lot(
  p_product_id    UUID,
  p_quantity      INTEGER,
  p_cost_price    NUMERIC,
  p_source        TEXT,           -- 'order' | 'free_stock'
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

  -- Assign next lot number (row-level lock prevents races)
  SELECT COALESCE(MAX(lot_number), 0) + 1
    INTO v_lot_number
    FROM inventory_lots
   WHERE product_id = p_product_id
     FOR UPDATE;

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
```

### Supabase RPC: `process_lot_sale`

```sql
CREATE OR REPLACE FUNCTION process_lot_sale(
  p_sale_item_id  UUID,
  p_allocations   JSONB   -- [{lot_id: UUID, quantity: integer}]
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
```

### Migration script

A one-time migration script creates Opening_Stock_Lots for all products with `qty > 0`:

```sql
-- Migration: create opening stock lots
DO $$
DECLARE
  v_product RECORD;
BEGIN
  FOR v_product IN
    SELECT id, qty, cost_price FROM products WHERE qty > 0
  LOOP
    PERFORM create_inventory_lot(
      p_product_id    => v_product.id,
      p_quantity      => v_product.qty,
      p_cost_price    => v_product.cost_price,
      p_source        => 'free_stock',
      p_arrival_date  => CURRENT_DATE,
      p_notes         => 'Opening stock — migrated from legacy qty field'
    );
  END LOOP;
END;
$$;
```

The RPC itself syncs `products.qty` after each lot creation, so no separate qty update is needed. The migration is idempotent if run on a fresh database (no existing lots).

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Lot creation stores all fields correctly

*For any* valid lot creation input (product_id, quantity, cost_price, source, arrival_date), the created lot SHALL have `remaining_qty` equal to the input quantity, `original_qty` equal to the input quantity, `cost_price` equal to the input cost_price, `status = 'active'`, and `arrival_date` equal to the input arrival_date.

**Validates: Requirements 1.1, 1.2, 2.1, 2.2**

### Property 2: Product qty sync invariant

*For any* product, after any lot mutation (create or sale), `products.qty` SHALL equal the sum of `remaining_qty` of all lots with `status = 'active'` for that product.

**Validates: Requirements 1.3, 3.3, 6.1, 6.2, 6.3, 6.4**

### Property 3: Invalid lot inputs are rejected

*For any* lot creation attempt where `quantity <= 0`, `cost_price < 0`, or (source = 'order' AND cost_price = 0), the `create_inventory_lot` RPC SHALL raise an exception and no lot SHALL be created.

**Validates: Requirements 1.4, 2.4, 2.5**

### Property 4: Sequential lot numbering per product

*For any* sequence of N lot creations for a single product, the assigned `lot_number` values SHALL be the integers 1 through N in creation order, with no gaps and no duplicates.

**Validates: Requirements 2.3, 9.1, 9.3, 9.4**

### Property 5: Active lot query excludes depleted lots

*For any* product, a query for active lots SHALL return only lots where `status = 'active'` and `remaining_qty > 0`; depleted lots SHALL never appear in the result.

**Validates: Requirements 3.5, 5.3**

### Property 6: Lot depletion on full sale

*For any* lot with `remaining_qty = R`, when a sale allocates exactly `R` units from that lot, the lot's `status` SHALL become `'depleted'` and `remaining_qty` SHALL be `0`.

**Validates: Requirements 5.1, 5.2**

### Property 7: Over-allocation is rejected

*For any* lot with `remaining_qty = R`, attempting to allocate `Q > R` units via `process_lot_sale` SHALL raise an exception and leave the lot unchanged.

**Validates: Requirements 4.2, 4.5, 5.6**

### Property 8: Lot allocation records are complete

*For any* confirmed free-stock sale with N lot allocations, exactly N `lot_allocations` records SHALL be created, each containing the correct `lot_id`, `sale_item_id`, `quantity_allocated`, and `cost_price_at_time_of_sale` (equal to the lot's `cost_price` at the time of sale).

**Validates: Requirements 4.3, 5.4**

### Property 9: Sale cost uses lot cost prices

*For any* sale item with lot allocations at varying cost prices, the `cost_total` on the sale item SHALL equal `SUM(quantity_allocated × cost_price_at_time_of_sale)` across all its `lot_allocations`.

**Validates: Requirements 5.5, 7.2**

### Property 10: Cost price immutability

*For any* lot, attempting to update `cost_price` after creation SHALL raise a database exception and the `cost_price` SHALL remain unchanged.

**Validates: Requirements 7.1, 7.3**

### Property 11: Migration creates exactly one lot per product with stock

*For any* set of products, after running the migration, each product with `qty > 0` SHALL have exactly one `inventory_lot` with `source = 'free_stock'`, `remaining_qty = product.qty`, `cost_price = product.cost_price`, and `notes = 'Opening stock — migrated from legacy qty field'`. Products with `qty = 0` SHALL have no lot created.

**Validates: Requirements 8.1, 8.2, 8.3, 8.5**

### Property 12: Lot identifier formatting

*For any* lot with `lot_number = N`, the formatted display identifier SHALL be the string `"Lot #N"`.

**Validates: Requirements 9.2**

---

## Error Handling

### RPC errors (Supabase)
Both RPCs use `RAISE EXCEPTION` for all validation failures. The Next.js API routes catch these as Supabase `PostgrestError` objects and return structured `400` responses with the exception message.

| Condition | Error message |
|---|---|
| `quantity <= 0` | `"quantity must be greater than zero"` |
| `cost_price < 0` | `"cost_price must be non-negative"` |
| `cost_price = 0` for order lot | `"cost_price must be greater than zero for order lots"` |
| Lot not found | `"lot {id} not found"` |
| Lot already depleted | `"lot {id} is already depleted"` |
| Insufficient lot qty | `"insufficient quantity in lot {id}. Available: {R}, Requested: {Q}"` |
| Cost price update attempt | `"cost_price is immutable after lot creation"` |

### UI validation (LotSelector)
- Per-lot: quantity input is capped at `lot.remaining_qty` (HTML `max` attribute + onChange guard).
- Total: if `totalAllocated > product.qty`, a red inline error is shown and the submit button is disabled.
- Empty allocation: if a free-stock product is added but no lots are allocated, submit is blocked with a validation message.

### API route error handling
All new API routes follow the existing pattern: `createErrorResponse(message)` with appropriate HTTP status codes (400 for validation, 404 for not found, 500 for unexpected errors).

---

## Testing Strategy

### Unit tests (example-based)

- `LotSelector` renders active lots with all required fields (lot identifier, arrival date, remaining qty, cost price).
- `LotSelector` does not render when sale contains only order-linked items.
- `ProductLotsTable` renders lot breakdown correctly.
- `useLotSelector` hook: `totalAllocated` equals sum of individual allocation quantities.
- API route `POST /api/inventory-lots` returns 400 for invalid inputs (qty ≤ 0, cost_price < 0).
- API route `POST /api/inventory-lots` returns 404 for unknown product_id.

### Property-based tests

Property-based testing is appropriate here because the core logic — lot creation, qty sync, depletion, allocation — involves pure functions and database operations whose correctness must hold across a wide range of inputs (varying quantities, cost prices, numbers of lots, allocation combinations).

**Library**: [fast-check](https://github.com/dubzzz/fast-check) (TypeScript-native, integrates with Jest/Vitest).

Each property test runs a minimum of **100 iterations**.

Tag format: `// Feature: inventory-lot-tracking, Property {N}: {property_text}`

| Property | Test description |
|---|---|
| P1: Lot creation stores all fields | Generate random valid inputs → call RPC → assert all fields match |
| P2: Product qty sync invariant | Generate N lots, create/deplete randomly → assert `products.qty = SUM(active remaining_qty)` after each operation |
| P3: Invalid inputs rejected | Generate qty ≤ 0 or cost_price < 0 → assert RPC raises exception, no lot created |
| P4: Sequential lot numbering | Create N lots for same product → assert lot_numbers are 1..N in order |
| P5: Active query excludes depleted | Create and deplete random lots → assert active query never returns depleted lots |
| P6: Lot depletion on full sale | Create lot with qty Q → sell Q → assert status = 'depleted', remaining_qty = 0 |
| P7: Over-allocation rejected | Generate lot with qty R, attempt allocation Q > R → assert exception, lot unchanged |
| P8: Allocation records complete | Confirm sale with N lots → assert N lot_allocation records with correct fields |
| P9: Sale cost uses lot cost prices | Generate allocations with varying cost prices → assert cost_total = SUM(qty × cost_price) |
| P10: Cost price immutability | Create lot → attempt UPDATE cost_price → assert exception, cost_price unchanged |
| P11: Migration correctness | Generate products with varying qty → run migration → assert one lot per product with qty > 0 |
| P12: Lot identifier formatting | Generate lot_number N → assert formatted identifier = "Lot #N" |

### Integration tests

- End-to-end: receive stock from pending order → verify lot created, `products.qty` updated.
- End-to-end: confirm free-stock sale → verify lot quantities decremented, `lot_allocations` created, `products.qty` updated.
- Migration script: run against a seeded database, verify all opening stock lots created correctly.
