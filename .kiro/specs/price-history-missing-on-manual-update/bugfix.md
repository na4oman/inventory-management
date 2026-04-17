# Bugfix Requirements Document

## Introduction

When a product's `cost_price` (or `sell_price`) is updated through the product edit page
(`/dashboard/products/[id]/edit`), the change is applied directly to the `products` table
without going through the `update_product_price` RPC. As a result, no entry is written to
`product_price_history`, making the price change invisible in the price history view.

The dedicated Prices page (`/dashboard/prices`) does not have this problem — it routes
through `PATCH /api/prices/[id]`, which calls the RPC and records history correctly.
The bug is isolated to the product edit flow, which routes through `PATCH /api/products/[id]`
and performs a plain `supabase.update()` that bypasses history tracking entirely.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user edits a product via the product edit page and changes `cost_price`, THEN the system updates `cost_price` on the `products` table but does NOT insert a corresponding entry into `product_price_history`

1.2 WHEN a user edits a product via the product edit page and changes `sell_price`, THEN the system updates `sell_price` on the `products` table but does NOT insert a corresponding entry into `product_price_history`

1.3 WHEN a user views the price history for a product whose price was changed via the product edit page, THEN the system returns an empty or incomplete history, omitting the changes made through that flow

### Expected Behavior (Correct)

2.1 WHEN a user edits a product via the product edit page and changes `cost_price` to a different value, THEN the system SHALL record the previous `cost_price` and the new `cost_price` in `product_price_history` before or atomically with applying the update

2.2 WHEN a user edits a product via the product edit page and changes `sell_price` to a different value, THEN the system SHALL record the previous `sell_price` and the new `sell_price` in `product_price_history` before or atomically with applying the update

2.3 WHEN a user edits a product via the product edit page and submits a `cost_price` or `sell_price` equal to the current stored value, THEN the system SHALL NOT create a history entry for that field (no-op)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user updates prices via the Prices page (`/dashboard/prices`), THEN the system SHALL CONTINUE TO record price history correctly through the existing `PATCH /api/prices/[id]` flow

3.2 WHEN a user edits non-price fields on the product edit page (e.g., `model`, `description`, `color`), THEN the system SHALL CONTINUE TO update those fields without creating price history entries

3.3 WHEN a user edits a product via the product edit page and changes `cost_price`, THEN the system SHALL CONTINUE TO update the `cost_price` value on the `products` table as before

3.4 WHEN a user edits a product via the product edit page and changes `sell_price`, THEN the system SHALL CONTINUE TO update the `sell_price` value on the `products` table as before

---

## Bug Condition

**Bug Condition Function:**

```pascal
FUNCTION isBugCondition(X)
  INPUT: X of type ProductUpdateRequest
  OUTPUT: boolean

  // Returns true when the request goes through the product edit flow
  // AND includes a price field that differs from the current stored value
  RETURN (X.route = 'PATCH /api/products/[id]')
     AND (X.body.cost_price ≠ current.cost_price
          OR X.body.sell_price ≠ current.sell_price)
END FUNCTION
```

**Property: Fix Checking**

```pascal
FOR ALL X WHERE isBugCondition(X) DO
  result ← updateProduct'(X)
  ASSERT product_price_history contains entry for X.product_id
     AND entry.old_value = current price before update
     AND entry.new_value = X.body.cost_price (or sell_price)
END FOR
```

**Property: Preservation Checking**

```pascal
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT updateProduct(X) = updateProduct'(X)
END FOR
```
