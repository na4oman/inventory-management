# Design Document: Price List Management

## Overview

The Price List Management feature adds a dedicated pricing module to the inventory app. It manages `cost_price` and `sell_price` per product, maintains an immutable audit trail of every price change, supports per-customer negotiated prices, and integrates price suggestion into the existing order and sale creation flows.

The existing `/dashboard/price-check` page is a market price research tool (SerpAPI-powered web search). It is kept as-is. The new pricing module lives at `/dashboard/prices`.

Key design principles:
- Price updates are **atomic**: the product row update and the history entry are written in a single Supabase RPC transaction.
- Prices on existing `order_items` and `sale_items` are **immutable** — no price list change ever touches them.
- Customer prices are resolved at the point of order/sale creation, not stored on the order.

---

## Architecture

```mermaid
graph TD
    subgraph UI Layer
        PL[/dashboard/prices - Price List Page/]
        OF[OrderForm - existing/]
        SF[CreateSaleForm - existing/]
    end

    subgraph API Layer
        PA[/api/prices - GET list, PATCH update/]
        PH[/api/prices/history/[productId]/]
        CP[/api/customer-prices - GET, POST, DELETE/]
        PS[/api/prices/suggest - GET suggestion/]
    end

    subgraph Data Layer
        PT[(products table)]
        PPH[(product_price_history table)]
        CPT[(customer_prices table)]
        OI[(order_items table)]
        SI[(sale_items table)]
    end

    subgraph Supabase
        RPC[update_product_price RPC]
    end

    PL --> PA
    PL --> PH
    PL --> CP
    OF --> PS
    SF --> PS
    PA --> RPC
    RPC --> PT
    RPC --> PPH
    PH --> PPH
    CP --> CPT
    PS --> CPT
    PS --> PT
```

The price update path goes through a Supabase RPC function (`update_product_price`) to guarantee atomicity. All other operations use the standard Supabase client.

---

## Components and Interfaces

### New API Routes

#### `GET /api/prices`
Returns paginated, searchable, sortable product list with `cost_price` and `sell_price`.

Query params: `page`, `pageSize` (25|50), `search`, `sortBy` (part_number|cost_price|sell_price), `sortOrder` (asc|desc).

Response: `PaginatedResponse<ProductPriceRow>`

#### `PATCH /api/prices/[id]`
Updates `cost_price` and/or `sell_price` for a product. Calls the `update_product_price` RPC.

Body: `{ cost_price?: number, sell_price?: number }`

Validation: values must be `>= 0` and numeric. Returns 400 with descriptive message on failure.

#### `GET /api/prices/history/[productId]`
Returns all price history entries for a product, ordered by `changed_at` descending.

Response: `PriceHistoryEntry[]`

#### `GET /api/customer-prices`
Query params: `product_id` or `client_id` (at least one required).

Returns customer price records joined with client name (when querying by product) or product `part_number` (when querying by client).

#### `POST /api/customer-prices`
Upserts a customer price record. Uses `ON CONFLICT (client_id, product_id) DO UPDATE`.

Body: `{ client_id: string, product_id: string, price: number }`

#### `DELETE /api/customer-prices/[id]`
Deletes a customer price record by its primary key.

#### `GET /api/prices/suggest`
Returns the suggested unit price for a client–product combination.

Query params: `client_id`, `product_id`

Logic: check `customer_prices` first; fall back to `products.sell_price`.

Response: `{ price: number, source: 'customer_price' | 'sell_price' }`

### New UI Components

#### `PriceListPage` (`/dashboard/prices/page.tsx`)
Main page with two tabs:
- **Price List** — paginated table of all products with inline price editing
- **Customer Prices** — searchable list of per-customer negotiated prices

#### `PriceEditDialog`
Modal for editing `cost_price` and `sell_price` for a single product. Shows current values, accepts new values, validates on submit.

#### `PriceHistoryModal`
Modal triggered from a product row. Displays the full price history for that product in a table (field changed, old value, new value, user, timestamp). Shows empty state when no history exists.

#### `CustomerPriceForm`
Inline form or dialog for creating/updating a customer price. Client and product selectors + price input.

### Modified Components

#### `OrderForm`
When a product is selected and a client is already chosen, call `GET /api/prices/suggest?client_id=X&product_id=Y` and pre-populate `unit_price`. The field remains editable.

#### `CreateSaleForm`
Same integration as `OrderForm`. When a product is added to either the order-items tab or free-stock tab, fetch the suggested price for the selected client and pre-populate the price field.

### New React Query Hooks

- `usePriceList(filters)` — wraps `GET /api/prices`
- `useUpdatePrice(productId)` — wraps `PATCH /api/prices/[id]`
- `usePriceHistory(productId)` — wraps `GET /api/prices/history/[productId]`
- `useCustomerPrices(filters)` — wraps `GET /api/customer-prices`
- `useUpsertCustomerPrice()` — wraps `POST /api/customer-prices`
- `useDeleteCustomerPrice()` — wraps `DELETE /api/customer-prices/[id]`
- `useSuggestedPrice(clientId, productId)` — wraps `GET /api/prices/suggest`

---

## Data Models

### `products` table (existing — no schema change needed)
`sell_price` already exists per `lib/types/database.ts` and `lib/validations/product.ts`. No migration needed.

### `product_price_history` (new table)

```sql
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
```

### `customer_prices` (new table)

```sql
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
```

### `update_product_price` RPC (new Supabase function)

```sql
CREATE OR REPLACE FUNCTION update_product_price(
  p_product_id  uuid,
  p_field_name  text,
  p_new_value   numeric,
  p_changed_by  text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_old_value numeric;
BEGIN
  -- Lock the row and read current value
  SELECT CASE WHEN p_field_name = 'cost_price' THEN cost_price ELSE sell_price END
  INTO v_old_value
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  -- No-op if value is unchanged (Req 7.3)
  IF v_old_value = p_new_value THEN
    RETURN;
  END IF;

  -- Update the product price
  IF p_field_name = 'cost_price' THEN
    UPDATE products SET cost_price = p_new_value, updated_at = now() WHERE id = p_product_id;
  ELSE
    UPDATE products SET sell_price = p_new_value, updated_at = now() WHERE id = p_product_id;
  END IF;

  -- Write history entry in same transaction
  INSERT INTO product_price_history (product_id, field_name, old_value, new_value, changed_by)
  VALUES (p_product_id, p_field_name, v_old_value, p_new_value, p_changed_by);
END;
$$;
```

### TypeScript types

```typescript
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
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Search filter correctness

*For any* product catalog and any non-empty search string, every product returned by the price list search must have a `part_number` or `model` that contains the search string (case-insensitive), and no product whose `part_number` and `model` both contain the search string is omitted.

**Validates: Requirements 1.2**

---

### Property 2: Sort order invariant

*For any* product list and any sort field (`part_number`, `cost_price`, `sell_price`) with any direction (asc|desc), the returned list must be ordered such that for every adjacent pair of items, the sort field of the first item compares correctly to the sort field of the second item according to the specified direction.

**Validates: Requirements 1.3**

---

### Property 3: Pagination completeness and non-overlap

*For any* product catalog of size N and page size P, fetching all pages must yield exactly N products total with no product appearing on more than one page.

**Validates: Requirements 1.4**

---

### Property 4: Price update round-trip

*For any* valid (non-negative) price value submitted as `cost_price` or `sell_price` for a product, reading the product back from the database immediately after the update must return the submitted value.

**Validates: Requirements 2.1**

---

### Property 5: Price history entry completeness

*For any* price update that changes a value, the resulting `product_price_history` entry must contain the correct `product_id`, `field_name`, `old_value`, `new_value`, `changed_by` (matching the authenticated user), and a `changed_at` timestamp within a reasonable window of the update time.

**Validates: Requirements 2.2, 3.2**

---

### Property 6: Invalid price rejection

*For any* negative numeric value submitted as a price update (for either `cost_price`, `sell_price`, or a customer price), the API must return a 400 error with a descriptive message, and the stored price must remain unchanged.

**Validates: Requirements 2.3, 4.4**

---

### Property 7: Price isolation — locked prices are immutable

*For any* set of `order_items` and `sale_items` with known `unit_price` values, updating the `cost_price` or `sell_price` of the associated product must leave every `unit_price` on those rows unchanged.

**Validates: Requirements 2.5, 6.1**

---

### Property 8: Price history ordering and retention

*For any* product that has received N price updates (each changing the value), querying its price history must return exactly N entries ordered by `changed_at` descending, with no entries missing or deleted.

**Validates: Requirements 3.1, 3.3**

---

### Property 9: Customer price upsert idempotence

*For any* `client_id` and `product_id` combination, setting a customer price K times must result in exactly one `customer_prices` record for that combination, containing the price from the most recent submission.

**Validates: Requirements 4.2**

---

### Property 10: Customer price delete removes record

*For any* existing `customer_prices` record, deleting it must result in no record existing for that `client_id`–`product_id` combination.

**Validates: Requirements 4.3**

---

### Property 11: Customer price suggestion — customer price takes precedence

*For any* `client_id` and `product_id` where a `customer_prices` record exists, the suggested price returned by `GET /api/prices/suggest` must equal the `customer_prices.price` value, not the product's `sell_price`.

**Validates: Requirements 5.2**

---

### Property 12: Customer price suggestion — sell_price fallback

*For any* `client_id` and `product_id` where no `customer_prices` record exists, the suggested price returned by `GET /api/prices/suggest` must equal the product's `sell_price`.

**Validates: Requirements 5.3**

---

### Property 13: No-op price update produces no history entry

*For any* product, submitting a price update where the new value equals the current stored value must not create a new `product_price_history` entry.

**Validates: Requirements 7.3**

---

### Property 14: Non-pending order item price modification is rejected

*For any* `order_item` whose parent `order` has a status other than `pending` (i.e., `received`, `completed`, or `cancelled`), attempting to update its `unit_price` must return an error and leave the `unit_price` unchanged.

**Validates: Requirements 6.5**

---

## Error Handling

### Validation errors (400)
- Price value is negative → `"Price must be 0 or greater"`
- Price value is non-numeric → `"Price must be a valid number"`
- Missing required fields → field-specific messages

### Not found (404)
- Product ID does not exist → `"Product not found"`
- Customer price record does not exist → `"Customer price not found"`

### Conflict / business rule violations (400)
- Attempting to update `unit_price` on a non-pending order item → `"Cannot modify price: order is not in pending status"`

### Transaction failures (500)
- If the `update_product_price` RPC fails (e.g., history write fails), Supabase rolls back the entire transaction. The API returns a 500 with `"Failed to update price"`. The product and history remain in their previous state.

### Price suggestion fallback
- If `GET /api/prices/suggest` is called but the product does not exist, return 404.
- If the client does not exist, return 404.
- Network errors during price suggestion in the UI are handled gracefully: the price field is left empty (not pre-populated) and a non-blocking toast is shown.

---

## Testing Strategy

### Unit tests (example-based)
- Validation logic: zero price accepted, negative rejected, non-numeric rejected
- Price suggestion logic: customer price present → returns customer price; absent → returns sell_price
- History ordering: given a list of entries, verify descending sort
- Empty state: product with no history returns empty array

### Property-based tests
Using **fast-check** (TypeScript PBT library).

Each property test runs a minimum of **100 iterations**.

Tag format: `// Feature: price-list-management, Property N: <property text>`

| Property | Test description |
|---|---|
| P1 | Generate random product lists + search strings; verify filter correctness |
| P2 | Generate random product lists; sort by each field/direction; verify ordering |
| P3 | Generate product lists of varying sizes; paginate; verify completeness + no overlap |
| P4 | Generate random non-negative prices; update + read back; verify round-trip |
| P5 | Generate random price updates; verify history entry fields are complete and correct |
| P6 | Generate random negative values; verify rejection + no data mutation |
| P7 | Generate random order/sale items; update product price; verify unit_prices unchanged |
| P8 | Generate random sequences of price changes; verify history count and ordering |
| P9 | Generate random client/product pairs; upsert price N times; verify single record |
| P10 | Create customer price; delete; verify absence |
| P11 | Generate client/product pairs with customer prices; verify suggestion returns customer price |
| P12 | Generate client/product pairs without customer prices; verify suggestion returns sell_price |
| P13 | Submit same price twice; verify history count unchanged |
| P14 | Generate order items with non-pending orders; attempt price update; verify rejection |

### Integration tests
- `update_product_price` RPC: verify both product and history are updated in a single call
- Rollback behavior: simulate history write failure (via mock); verify product price is unchanged
- Customer price cascade delete: deleting a client or product cascades to `customer_prices`

### Navigation
Add a "Prices" nav item to `Sidebar.tsx` pointing to `/dashboard/prices`, using the `Tag` or `DollarSign` icon from lucide-react.
