# Implementation Plan: Inventory Lot Tracking

## Overview

Replaces the single `products.qty` field with a full lot/batch tracking system. Stock arrivals are recorded as distinct inventory lots. Sales from free stock draw from user-selected lots. All qty sync is handled atomically inside Supabase RPCs. The existing `products.qty` field is retained as a denormalised cache kept in sync by the RPCs.

## Tasks

- [x] 1. Add TypeScript types and database schema
  - [x] 1.1 Add `InventoryLot`, `LotAllocation`, and `SaleItemWithAllocations` interfaces to `lib/types/database.ts`
    - _Requirements: 1.1, 2.1, 4.3, 5.4_
  - [x] 1.2 Create Supabase migration file with `inventory_lots` table, `lot_allocations` table, `prevent_cost_price_update` trigger, `create_inventory_lot` RPC, and `process_lot_sale` RPC
    - Include all constraints, indexes, and the `UNIQUE (product_id, lot_number)` constraint
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 5.1, 5.2, 5.4, 6.1, 7.1, 9.1, 9.3_
  - [ ]* 1.3 Write property test for lot creation field correctness (Property 1)
    - **Property 1: Lot creation stores all fields correctly**
    - **Validates: Requirements 1.1, 1.2, 2.1, 2.2**
  - [ ]* 1.4 Write property test for invalid lot input rejection (Property 3)
    - **Property 3: Invalid lot inputs are rejected**
    - **Validates: Requirements 1.4, 2.4, 2.5**
  - [ ]* 1.5 Write property test for sequential lot numbering (Property 4)
    - **Property 4: Sequential lot numbering per product**
    - **Validates: Requirements 2.3, 9.1, 9.3, 9.4**
  - [ ]* 1.6 Write property test for cost price immutability (Property 10)
    - **Property 10: Cost price immutability**
    - **Validates: Requirements 7.1, 7.3**

- [x] 2. Implement `GET /api/inventory-lots` and `POST /api/inventory-lots` API routes
  - [x] 2.1 Create `app/api/inventory-lots/route.ts` with GET handler (filter by `product_id` and optional `status`, ordered by `arrival_date ASC`) and POST handler (calls `create_inventory_lot` RPC, returns 400 for validation errors, 404 for unknown product)
    - _Requirements: 2.1, 2.4, 2.5, 3.1, 3.2, 3.5_
  - [ ]* 2.2 Write unit tests for `POST /api/inventory-lots`
    - Test 400 for `quantity <= 0`, `cost_price < 0`, and `cost_price = 0` on order lots
    - Test 404 for unknown `product_id`
    - _Requirements: 1.4, 2.4, 2.5_

- [x] 3. Implement React Query hooks `useInventoryLots` and `useLotSelector`
  - [x] 3.1 Create `lib/hooks/useInventoryLots.ts` — fetches lots for a product with optional status filter; invalidated on lot creation and sale confirmation
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_
  - [x] 3.2 Create `lib/hooks/useLotSelector.ts` — wraps `useInventoryLots`, manages local allocation state (`allocations`, `setAllocation`, `totalAllocated`, `isValid`, `validationError`)
    - _Requirements: 4.1, 4.2, 4.4, 4.5_
  - [ ]* 3.3 Write unit tests for `useLotSelector` hook
    - Test that `totalAllocated` equals sum of individual allocation quantities
    - Test `isValid` is false when `totalAllocated > maxQty`
    - _Requirements: 4.4, 4.5_

- [x] 4. Build `ProductLotsTable` component
  - [x] 4.1 Create `components/products/ProductLotsTable.tsx` — displays active lots for a product with columns: Lot #, Arrival Date, Remaining Qty, Cost Price/unit, Status; accepts `productId` and optional `showDepleted` prop
    - _Requirements: 3.1, 3.2, 9.2_
  - [ ]* 4.2 Write unit tests for `ProductLotsTable`
    - Test that it renders lot identifier, arrival date, remaining qty, and cost price
    - Test that depleted lots are hidden by default
    - _Requirements: 3.1, 3.5_

- [x] 5. Build `LotSelector` component
  - [x] 5.1 Create `components/sales/LotSelector.tsx` — renders a table of active lots with inline quantity inputs per lot; shows running total; shows validation error when total exceeds `maxQty`; disables submit when invalid or no allocation made
    - Props: `productId`, `maxQty`, `onChange`, `disabled`
    - _Requirements: 4.1, 4.2, 4.4, 4.5_
  - [ ]* 5.2 Write unit tests for `LotSelector`
    - Test that it renders active lots with all required fields
    - Test that it does not render for order-linked items
    - Test that quantity input is capped at `lot.remaining_qty`
    - Test that validation error appears when total > maxQty
    - _Requirements: 4.1, 4.2, 4.5, 4.6_
  - [ ]* 5.3 Write property test for active lot query exclusion of depleted lots (Property 5)
    - **Property 5: Active lot query excludes depleted lots**
    - **Validates: Requirements 3.5, 5.3**
  - [ ]* 5.4 Write property test for lot identifier formatting (Property 12)
    - **Property 12: Lot identifier formatting**
    - **Validates: Requirements 9.2**

- [ ] 6. Checkpoint — Ensure all tests pass, ask the user if questions arise.

- [x] 7. Upgrade `ProductForm` to make qty read-only and add "Add Free Stock" modal
  - [x] 7.1 In `components/products/ProductForm.tsx`, make the `qty` field read-only (display only, not editable)
    - _Requirements: 6.2, 6.4_
  - [x] 7.2 Add an "Add Free Stock" button to `ProductForm` that opens a modal with fields: quantity, cost_price, arrival_date, notes; on submit calls `POST /api/inventory-lots` and invalidates the product query
    - _Requirements: 2.1, 2.2, 2.4, 2.5_
  - [x] 7.3 Mount `ProductLotsTable` on the product detail/edit page to show active lots below the form
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 8. Upgrade `CreateSaleForm` to use `LotSelector` for free-stock items
  - [x] 8.1 In `components/sales/CreateSaleForm.tsx`, replace the single qty input for free-stock products with `<LotSelector>`; collect `lot_allocations` per free-stock item
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 8.2 Update the totals summary in `CreateSaleForm` to compute cost using `cost_price_at_time_of_sale` from selected lot allocations
    - _Requirements: 5.5, 7.2_
  - [x] 8.3 Pass `lot_allocations: { lot_id, quantity }[]` per free-stock item in the sale submission payload to the sales API
    - _Requirements: 4.3, 5.4_

- [x] 9. Upgrade the sales API route to call `process_lot_sale` RPC
  - [x] 9.1 In `app/api/sales/route.ts` (or the relevant sale creation handler), after inserting each free-stock sale item, call the `process_lot_sale` RPC with the `sale_item_id` and its `lot_allocations`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [ ]* 9.2 Write property test for lot depletion on full sale (Property 6)
    - **Property 6: Lot depletion on full sale**
    - **Validates: Requirements 5.1, 5.2**
  - [ ]* 9.3 Write property test for over-allocation rejection (Property 7)
    - **Property 7: Over-allocation is rejected**
    - **Validates: Requirements 4.2, 4.5, 5.6**
  - [ ]* 9.4 Write property test for allocation records completeness (Property 8)
    - **Property 8: Lot allocation records are complete**
    - **Validates: Requirements 4.3, 5.4**
  - [ ]* 9.5 Write property test for sale cost using lot cost prices (Property 9)
    - **Property 9: Sale cost uses lot cost prices**
    - **Validates: Requirements 5.5, 7.2**
  - [ ]* 9.6 Write property test for product qty sync invariant (Property 2)
    - **Property 2: Product qty sync invariant**
    - **Validates: Requirements 1.3, 3.3, 6.1, 6.2, 6.3, 6.4**

- [x] 10. Upgrade order stock receipt to call `create_inventory_lot` RPC
  - [x] 10.1 In the order item tracking route (`app/api/order-items/[id]/tracking/route.ts`), replace the direct `products.qty` increment with a call to `create_inventory_lot` RPC using the order item's `cost_price`, `quantity`, `order_item_id`, and current date as `arrival_date`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 11. Write and run the opening stock migration
  - [x] 11.1 Create a Supabase migration SQL file that runs the opening stock migration script — iterates all products with `qty > 0` and calls `create_inventory_lot` with `source = 'free_stock'` and notes `'Opening stock — migrated from legacy qty field'`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [ ]* 11.2 Write property test for migration correctness (Property 11)
    - **Property 11: Migration creates exactly one lot per product with stock**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.5**

- [x] 12. Final checkpoint — Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use [fast-check](https://github.com/dubzzz/fast-check) with a minimum of 100 iterations each
- Tag format for property tests: `// Feature: inventory-lot-tracking, Property {N}: {property_text}`
- `products.qty` is never written directly by application code — only by the two RPCs
- All RPC errors surface as Supabase `PostgrestError` and are returned as structured `400` responses
