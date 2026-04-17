# Implementation Plan: Price List Management

## Overview

Implement the Price List Management module incrementally: database schema and RPC first, then API routes, then React Query hooks, then UI components, and finally integration into existing order/sale creation flows.

## Tasks

- [x] 1. Database schema and Supabase RPC
  - [x] 1.1 Create `product_price_history` table migration
    - Write SQL migration creating the `product_price_history` table with columns `id`, `product_id`, `field_name`, `old_value`, `new_value`, `changed_by`, `changed_at` and the two indexes
    - _Requirements: 2.2, 3.1, 3.3, 7.1_

  - [x] 1.2 Create `customer_prices` table migration
    - Write SQL migration creating the `customer_prices` table with the unique constraint on `(client_id, product_id)` and the two indexes
    - _Requirements: 4.1, 4.2_

  - [x] 1.3 Create `update_product_price` Supabase RPC
    - Write the `update_product_price` PL/pgSQL function that locks the product row, skips no-op updates, updates the price field, and inserts a history entry — all in one transaction
    - _Requirements: 7.1, 7.2, 7.3_

- [x] 2. TypeScript types and validation
  - [x] 2.1 Add TypeScript interfaces for price-list domain
    - Add `ProductPriceRow`, `PriceHistoryEntry`, `CustomerPrice`, `CustomerPriceWithDetails`, and `SuggestedPrice` interfaces to `lib/types/`
    - _Requirements: 1.1, 2.2, 4.1, 5.1_

  - [x] 2.2 Add price validation utilities
    - Write `validatePrice(value: unknown): number` that rejects negative and non-numeric values with descriptive messages and accepts zero
    - _Requirements: 2.3, 2.4, 4.4_

  - [ ]* 2.3 Write property test for invalid price rejection (Property 6)
    - **Property 6: Invalid price rejection**
    - Generate random negative numeric values; assert `validatePrice` throws with a descriptive message and never mutates stored state
    - **Validates: Requirements 2.3, 4.4**

- [x] 3. API route — price list (`/api/prices`)
  - [x] 3.1 Implement `GET /api/prices`
    - Create `app/api/prices/route.ts` handling `page`, `pageSize` (25|50), `search`, `sortBy`, `sortOrder` query params; query `products` table; return `PaginatedResponse<ProductPriceRow>`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 3.2 Write property test for search filter correctness (Property 1)
    - **Property 1: Search filter correctness**
    - Generate random product lists and search strings; assert every returned product contains the search term in `part_number` or `model` and no matching product is omitted
    - **Validates: Requirements 1.2**

  - [ ]* 3.3 Write property test for sort order invariant (Property 2)
    - **Property 2: Sort order invariant**
    - Generate random product lists; sort by each field and direction; assert every adjacent pair satisfies the ordering relation
    - **Validates: Requirements 1.3**

  - [ ]* 3.4 Write property test for pagination completeness and non-overlap (Property 3)
    - **Property 3: Pagination completeness and non-overlap**
    - Generate product catalogs of varying sizes; fetch all pages; assert total count equals N and no product appears twice
    - **Validates: Requirements 1.4**

  - [x] 3.5 Implement `PATCH /api/prices/[id]`
    - Create `app/api/prices/[id]/route.ts`; validate body with `validatePrice`; call `update_product_price` RPC; return 400 on validation failure, 404 if product not found, 500 on RPC failure
    - _Requirements: 2.1, 2.3, 2.4, 7.1, 7.2_

  - [ ]* 3.6 Write property test for price update round-trip (Property 4)
    - **Property 4: Price update round-trip**
    - Generate random non-negative prices; call PATCH then GET; assert the returned value equals the submitted value
    - **Validates: Requirements 2.1**

  - [ ]* 3.7 Write property test for price history entry completeness (Property 5)
    - **Property 5: Price history entry completeness**
    - Generate random price updates; assert the resulting history entry has correct `product_id`, `field_name`, `old_value`, `new_value`, `changed_by`, and a `changed_at` within a reasonable window
    - **Validates: Requirements 2.2, 3.2**

  - [ ]* 3.8 Write property test for no-op price update produces no history entry (Property 13)
    - **Property 13: No-op price update produces no history entry**
    - Submit the same price value twice; assert history count is unchanged after the second submission
    - **Validates: Requirements 7.3**

- [x] 4. API route — price history (`/api/prices/history/[productId]`)
  - [x] 4.1 Implement `GET /api/prices/history/[productId]`
    - Create `app/api/prices/history/[productId]/route.ts`; query `product_price_history` ordered by `changed_at` descending; return 404 if product not found; return empty array when no history exists
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [ ]* 4.2 Write property test for price history ordering and retention (Property 8)
    - **Property 8: Price history ordering and retention**
    - Generate N distinct price updates for a product; assert the history response contains exactly N entries ordered by `changed_at` descending
    - **Validates: Requirements 3.1, 3.3**

  - [ ]* 4.3 Write property test for price isolation — locked prices are immutable (Property 7)
    - **Property 7: Price isolation — locked prices are immutable**
    - Generate order/sale items with known `unit_price` values; update the associated product price; assert every `unit_price` row is unchanged
    - **Validates: Requirements 2.5, 6.1**

- [ ] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. API routes — customer prices (`/api/customer-prices`)
  - [x] 6.1 Implement `GET /api/customer-prices`
    - Create `app/api/customer-prices/route.ts`; require at least one of `product_id` or `client_id`; join with `clients` or `products` as appropriate; return `CustomerPriceWithDetails[]`
    - _Requirements: 4.5, 4.6_

  - [x] 6.2 Implement `POST /api/customer-prices`
    - Add POST handler to `app/api/customer-prices/route.ts`; validate price with `validatePrice`; upsert using `ON CONFLICT (client_id, product_id) DO UPDATE`; return the upserted record
    - _Requirements: 4.1, 4.2, 4.4_

  - [ ]* 6.3 Write property test for customer price upsert idempotence (Property 9)
    - **Property 9: Customer price upsert idempotence**
    - Generate random client/product pairs; upsert a price K times; assert exactly one record exists containing the most recent price
    - **Validates: Requirements 4.2**

  - [x] 6.4 Implement `DELETE /api/customer-prices/[id]`
    - Create `app/api/customer-prices/[id]/route.ts`; delete the record by primary key; return 404 if not found
    - _Requirements: 4.3_

  - [ ]* 6.5 Write property test for customer price delete removes record (Property 10)
    - **Property 10: Customer price delete removes record**
    - Create a customer price record; delete it; assert no record exists for that `client_id`–`product_id` combination
    - **Validates: Requirements 4.3**

- [x] 7. API route — price suggestion (`/api/prices/suggest`)
  - [x] 7.1 Implement `GET /api/prices/suggest`
    - Create `app/api/prices/suggest/route.ts`; require `client_id` and `product_id`; check `customer_prices` first, fall back to `products.sell_price`; return `SuggestedPrice`; return 404 if product or client not found
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 7.2 Write property test for customer price suggestion — customer price takes precedence (Property 11)
    - **Property 11: Customer price suggestion — customer price takes precedence**
    - Generate client/product pairs with a `customer_prices` record; assert the suggestion response equals `customer_prices.price` and `source` is `'customer_price'`
    - **Validates: Requirements 5.2**

  - [ ]* 7.3 Write property test for customer price suggestion — sell_price fallback (Property 12)
    - **Property 12: Customer price suggestion — sell_price fallback**
    - Generate client/product pairs without a `customer_prices` record; assert the suggestion response equals `products.sell_price` and `source` is `'sell_price'`
    - **Validates: Requirements 5.3**

- [x] 8. Order item price protection
  - [x] 8.1 Enforce non-pending order item price lock in `PATCH /api/order-items/[id]`
    - Modify `app/api/order-items/[id]/update/route.ts` to check the parent order's status before allowing `unit_price` changes; return 400 with `"Cannot modify price: order is not in pending status"` if status is not `pending`
    - _Requirements: 6.4, 6.5_

  - [ ]* 8.2 Write property test for non-pending order item price modification rejection (Property 14)
    - **Property 14: Non-pending order item price modification is rejected**
    - Generate order items whose parent order has status `received`, `completed`, or `cancelled`; attempt to update `unit_price`; assert 400 response and unchanged `unit_price`
    - **Validates: Requirements 6.5**

- [ ] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. React Query hooks
  - [x] 10.1 Implement `usePriceList`, `useUpdatePrice`, and `usePriceHistory` hooks
    - Create `lib/hooks/usePriceList.ts`, `lib/hooks/useUpdatePrice.ts`, and `lib/hooks/usePriceHistory.ts` wrapping the corresponding API routes
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 3.1_

  - [x] 10.2 Implement `useCustomerPrices`, `useUpsertCustomerPrice`, and `useDeleteCustomerPrice` hooks
    - Create `lib/hooks/useCustomerPrices.ts`, `lib/hooks/useUpsertCustomerPrice.ts`, and `lib/hooks/useDeleteCustomerPrice.ts`
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [x] 10.3 Implement `useSuggestedPrice` hook
    - Create `lib/hooks/useSuggestedPrice.ts` wrapping `GET /api/prices/suggest`; handle network errors gracefully (return `null` on failure)
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 11. UI — Price List page and dialogs
  - [x] 11.1 Create `PriceListPage` at `/dashboard/prices`
    - Create `app/dashboard/prices/page.tsx` with two tabs: "Price List" and "Customer Prices"; wire up `usePriceList` with search input, sort controls, and pagination (page sizes 25 and 50)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 11.2 Create `PriceEditDialog` component
    - Create `components/prices/PriceEditDialog.tsx`; show current `cost_price` and `sell_price`; validate inputs on submit using `validatePrice`; call `useUpdatePrice`; display descriptive error messages on validation failure
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 11.3 Create `PriceHistoryModal` component
    - Create `components/prices/PriceHistoryModal.tsx`; display history entries (field, old value, new value, user, formatted UTC timestamp) ordered newest first; show empty state message when no history exists
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 11.4 Create `CustomerPriceForm` component and wire Customer Prices tab
    - Create `components/prices/CustomerPriceForm.tsx` with client and product selectors and a price input; wire `useUpsertCustomerPrice` and `useDeleteCustomerPrice`; display customer price records in the Customer Prices tab using `useCustomerPrices`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 12. Sidebar navigation
  - Add a "Prices" nav item to `components/layout/Sidebar.tsx` pointing to `/dashboard/prices` using the `Tag` or `DollarSign` icon from lucide-react
  - _Requirements: 1.1_

- [x] 13. Integrate price suggestion into `OrderForm` and `CreateSaleForm`
  - [x] 13.1 Integrate `useSuggestedPrice` into `OrderForm`
    - Modify `components/orders/OrderForm.tsx`: when a product is selected and a client is already chosen, call `useSuggestedPrice` and pre-populate the `unit_price` field; keep the field editable; show a non-blocking toast on network error
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 13.2 Integrate `useSuggestedPrice` into `CreateSaleForm`
    - Modify `components/sales/CreateSaleForm.tsx`: same integration as `OrderForm` for both the order-items tab and the free-stock tab
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 14. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use **fast-check** with a minimum of 100 iterations each
- Tag format for property tests: `// Feature: price-list-management, Property N: <property text>`
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
