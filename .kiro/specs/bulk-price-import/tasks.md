# Implementation Plan: Bulk Price Import

## Overview

Implement the bulk price import feature by adding a new API route, a client component, shared types, and wiring everything into the existing prices dashboard page. The implementation reuses the existing `update_product_price` RPC and follows the same patterns as the product Excel import.

## Tasks

- [x] 1. Add `ImportResult` and `PriceImportRow` types to `lib/types/price.ts`
  - Add `PriceImportRow` interface with `part_number`, `new_price`, and optional `description` fields
  - Add `ImportResult` interface with `updated`, `skipped`, `failed` (numbers) and `errors` (string array) fields
  - _Requirements: 5.1_

- [ ] 2. Implement pure validation helpers for the import route
  - [x] 2.1 Create `lib/validations/priceImport.ts` with `validatePriceImportFile` and `validatePriceImportRow` functions
    - `validatePriceImportFile(headers: string[])` — checks for presence of `part_number` and `new_price` columns; returns array of missing column names
    - `validatePriceImportRow(row: unknown, rowNum: number)` — validates `part_number` (non-empty string) and `new_price` (numeric, ≥ 0); returns a `PriceImportRow` or throws with the exact error message format from the design
    - _Requirements: 2.2, 3.1, 3.2, 3.3, 3.5_

  - [ ]* 2.2 Write unit tests for `validatePriceImportFile`
    - Test: both columns present → no errors
    - Test: `part_number` missing → error names the column
    - Test: `new_price` missing → error names the column
    - Test: both missing → error names both columns
    - _Requirements: 2.2_

  - [ ]* 2.3 Write unit tests for `validatePriceImportRow`
    - Test: valid row with price 0 → accepted (Requirement 3.3)
    - Test: empty `part_number` → error with row number
    - Test: missing `new_price` → error with row number
    - Test: negative `new_price` → error with row number
    - Test: non-numeric `new_price` → error with row number
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [ ]* 2.4 Write property test for `validatePriceImportFile` (Property 2)
    - `// Feature: bulk-price-import, Property 2: Missing required column produces a named error`
    - Generate workbooks missing subsets of required columns → API returns 400 naming missing columns
    - **Property 2: Missing required column produces a named error**
    - **Validates: Requirements 2.2**

  - [ ]* 2.5 Write property test for `validatePriceImportRow` — invalid `part_number` (Property 3)
    - `// Feature: bulk-price-import, Property 3: Row with invalid part_number produces a row-level error and processing continues`
    - Generate rows with empty/missing `part_number` values → each produces a row-level error
    - **Property 3: Row with invalid part_number produces a row-level error and processing continues**
    - **Validates: Requirements 3.1**

  - [ ]* 2.6 Write property test for `validatePriceImportRow` — invalid `new_price` (Property 4)
    - `// Feature: bulk-price-import, Property 4: Row with invalid new_price produces a row-level error and processing continues`
    - Generate rows with non-numeric, negative, or missing `new_price` values → each produces a row-level error
    - **Property 4: Row with invalid new_price produces a row-level error and processing continues**
    - **Validates: Requirements 3.2**

- [ ] 3. Implement `POST /api/prices/import` route handler
  - [x] 3.1 Create `app/api/prices/import/route.ts`
    - Authenticate via Clerk `auth()`; return 401 if no session (_Requirements: 6.1_)
    - Parse `multipart/form-data`, validate file extension (`.xlsx`/`.xls`); return 400 on mismatch (_Requirements: 1.2, 1.3_)
    - Read workbook with `xlsx`, check for empty workbook and zero data rows; return 400 on failure (_Requirements: 2.1, 2.4_)
    - Call `validatePriceImportFile` on headers; return 400 naming missing columns (_Requirements: 2.2_)
    - Batch-fetch all products matching the file's `part_number` values in a single Supabase query
    - For each data row: call `validatePriceImportRow`; on error collect and continue (_Requirements: 3.1, 3.2, 3.5_)
    - For valid rows: look up product; if not found collect named error and continue (_Requirements: 3.4_)
    - If product found and `new_price === cost_price`: increment `skipped`, do not call RPC (_Requirements: 4.3_)
    - If product found and price changed: call `update_product_price` RPC with `p_field_name = 'cost_price'`, `p_new_value`, `p_changed_by = userId`; on RPC error collect row error and continue (_Requirements: 4.1, 4.5, 6.2_)
    - If row includes non-empty `description` and price changed: update `products.description` via Supabase (_Requirements: 4.4_)
    - Return `ImportResult` with `updated`, `skipped`, `failed`, `errors` (_Requirements: 5.1_)
    - _Requirements: 1.2, 1.3, 2.1, 2.2, 2.4, 3.1, 3.2, 3.4, 3.5, 4.1, 4.3, 4.4, 4.5, 5.1, 6.1, 6.2_

  - [ ]* 3.2 Write property test for file extension validation (Property 1)
    - `// Feature: bulk-price-import, Property 1: Invalid file extension is always rejected`
    - Generate random filenames with non-xlsx/xls extensions → validation rejects without upload
    - **Property 1: Invalid file extension is always rejected**
    - **Validates: Requirements 1.3**

  - [ ]* 3.3 Write property test for unmatched part_number (Property 5)
    - `// Feature: bulk-price-import, Property 5: Unmatched part_number produces a named row-level error and processing continues`
    - Generate files with random unknown part numbers → row errors name the part_number, other rows still process
    - **Property 5: Unmatched part_number produces a named row-level error and processing continues**
    - **Validates: Requirements 3.4**

  - [ ]* 3.4 Write property test for row error messages containing Excel row number (Property 6)
    - `// Feature: bulk-price-import, Property 6: Every row-level error message contains the Excel row number`
    - Generate files with any error-producing rows → all error messages contain the Excel row number
    - **Property 6: Every row-level error message contains the Excel row number**
    - **Validates: Requirements 3.5**

  - [ ]* 3.5 Write property test for RPC call arguments (Property 7)
    - `// Feature: bulk-price-import, Property 7: Changed price triggers RPC call with correct arguments`
    - Generate valid rows with changed prices → RPC called with `field_name = 'cost_price'`, correct value, correct userId
    - **Property 7: Changed price triggers RPC call with correct arguments**
    - **Validates: Requirements 4.1, 6.2**

  - [ ]* 3.6 Write property test for unchanged price skip (Property 8)
    - `// Feature: bulk-price-import, Property 8: Unchanged price is skipped without an RPC call`
    - Generate valid rows where `new_price === cost_price` → RPC not called, `skipped` incremented
    - **Property 8: Unchanged price is skipped without an RPC call**
    - **Validates: Requirements 4.3**

  - [ ]* 3.7 Write property test for RPC failure resilience (Property 9)
    - `// Feature: bulk-price-import, Property 9: RPC failure produces a row-level error and processing continues`
    - Generate files where RPC fails for some rows → those rows error, subsequent rows still process
    - **Property 9: RPC failure produces a row-level error and processing continues**
    - **Validates: Requirements 4.5**

  - [ ]* 3.8 Write property test for result count consistency (Property 10)
    - `// Feature: bulk-price-import, Property 10: Import result counts are consistent`
    - Generate any valid import file → `updated + skipped + failed === total data rows`
    - **Property 10: Import result counts are consistent**
    - **Validates: Requirements 5.1**

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement `BulkPriceImport` client component
  - [x] 5.1 Create `components/prices/BulkPriceImport.tsx`
    - File input that accepts `.xlsx,.xls` only; validate extension client-side before upload (_Requirements: 1.2, 1.3_)
    - On valid file selected: POST `multipart/form-data` to `/api/prices/import` (_Requirements: 1.4_)
    - Show loading spinner while request is in-flight (_Requirements: 1.5_)
    - On success: display `ImportResult` summary — updated count, skipped count, failed count (_Requirements: 5.2, 5.4, 5.5_)
    - When `errors.length > 0`: render error list and a "Download error CSV" button that triggers client-side CSV download (_Requirements: 5.3_)
    - On HTTP 4xx/5xx: surface the `error` field from the response body as an error message
    - Clear loading state in a `finally` block
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 5.2 Write unit tests for `BulkPriceImport` component
    - Test: file with invalid extension → error shown, no fetch called (_Requirements: 1.3_)
    - Test: all-skipped result → "no prices changed" message displayed (_Requirements: 5.4_)
    - Test: partial errors result → error list and CSV download button rendered (_Requirements: 5.3_)
    - Test: full success result → success message with updated count displayed (_Requirements: 5.5_)
    - _Requirements: 1.3, 5.3, 5.4, 5.5_

- [x] 6. Wire `BulkPriceImport` into the prices dashboard page
  - Modify `app/dashboard/prices/page.tsx` to import `BulkPriceImport`
  - Add a `"bulk-import"` `TabsTrigger` labelled "Bulk Price Import" to the existing `TabsList`
  - Add a corresponding `TabsContent` that renders `<BulkPriceImport />`
  - _Requirements: 1.1_

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use [fast-check](https://github.com/dubzzz/fast-check) with a minimum of 100 iterations each
- Each property test must include the tag comment `// Feature: bulk-price-import, Property N: ...`
- The `update_product_price` RPC is called only when `new_price !== cost_price`; the RPC itself is also a no-op for equal values, so the skip check is a performance optimisation
- Row numbers in error messages are Excel row numbers (header = row 1, first data row = row 2)
