# Requirements Document

## Introduction

The Bulk Price Import feature allows users to upload an Excel file containing vendor price updates and apply them in bulk to the product catalog. For each row in the file, the system matches the part number to an existing product, compares the new price against the current `cost_price`, and updates the product only when the price has actually changed. Every change is recorded in the existing `product_price_history` audit trail using the same atomic `update_product_price` RPC already used for manual price edits. Rows where the price is unchanged are silently skipped with no history entry created. The feature is accessible from the Prices area of the dashboard as a new tab alongside the existing price list.

## Glossary

- **Bulk_Price_Importer**: The authenticated user who uploads a vendor price list Excel file.
- **Price_Import_File**: An Excel file (`.xlsx` or `.xls`) containing at least the columns `part_number` and `new_price`, with an optional `description` column.
- **Import_Row**: A single data row within a Price_Import_File representing one vendor price update.
- **Part_Number**: The unique identifier for a product, stored as `part_number` on the `products` table.
- **Cost_Price**: The current vendor purchase price for a product, stored as `cost_price` on the `products` table.
- **Price_History**: The immutable audit log in `product_price_history` recording every change to a product's `cost_price`, including old value, new value, changed-by user, and UTC timestamp.
- **Import_Result**: The summary returned after processing a Price_Import_File, containing counts of updated, skipped, and failed rows, plus per-row error details.
- **update_product_price RPC**: The existing Supabase database function that atomically updates a product's price and writes a Price_History entry only when the new value differs from the current value.

---

## Requirements

### Requirement 1: Upload a Vendor Price List File

**User Story:** As a Bulk_Price_Importer, I want to upload an Excel file from the Prices page, so that I can apply vendor price updates without editing each product individually.

#### Acceptance Criteria

1. THE Price_List_Module SHALL provide a "Bulk Price Import" tab on the `/dashboard/prices` page alongside the existing "Price List" and "Customer Prices" tabs.
2. WHEN the Bulk_Price_Importer selects a file, THE Price_List_Module SHALL accept files with the extensions `.xlsx` and `.xls` only.
3. IF the Bulk_Price_Importer selects a file with an extension other than `.xlsx` or `.xls`, THEN THE Price_List_Module SHALL reject the file and display a descriptive error message without uploading it.
4. WHEN a valid file is selected, THE Price_List_Module SHALL upload the file to the server and begin processing without requiring any additional confirmation step.
5. WHILE the file is being processed, THE Price_List_Module SHALL display a loading indicator to the Bulk_Price_Importer.

---

### Requirement 2: Validate Price Import File Structure

**User Story:** As a Bulk_Price_Importer, I want the system to validate the file structure before processing rows, so that I receive clear feedback when the file format is incorrect.

#### Acceptance Criteria

1. WHEN a Price_Import_File is received, THE Price_List_Module SHALL verify that the file contains at least one worksheet; IF the file is empty, THEN THE Price_List_Module SHALL return an error and process no rows.
2. WHEN a Price_Import_File is received, THE Price_List_Module SHALL verify that the first worksheet contains a `part_number` column and a `new_price` column; IF either mandatory column is absent, THEN THE Price_List_Module SHALL return an error identifying the missing column and process no rows.
3. WHEN a Price_Import_File is received, THE Price_List_Module SHALL treat the `description` column as optional and process the file normally whether or not it is present.
4. WHEN a Price_Import_File contains zero data rows after the header, THE Price_List_Module SHALL return an error indicating the file contains no data rows and process no rows.

---

### Requirement 3: Validate Individual Import Rows

**User Story:** As a Bulk_Price_Importer, I want row-level validation errors to be reported per row, so that I can correct specific rows without re-uploading the entire file.

#### Acceptance Criteria

1. WHEN an Import_Row has an empty or missing `part_number` value, THE Price_List_Module SHALL record a row-level error for that row and continue processing the remaining rows.
2. WHEN an Import_Row has a `new_price` value that is non-numeric, negative, or missing, THE Price_List_Module SHALL record a row-level error for that row and continue processing the remaining rows.
3. WHEN an Import_Row has a `new_price` of zero, THE Price_List_Module SHALL treat it as a valid price and process the row normally.
4. WHEN an Import_Row references a `part_number` that does not match any product in the database, THE Price_List_Module SHALL record a row-level error for that row identifying the unmatched part number and continue processing the remaining rows.
5. THE Price_List_Module SHALL include the Excel row number in every row-level error message to allow the Bulk_Price_Importer to locate the offending row in the original file.

---

### Requirement 4: Apply Price Updates and Record History

**User Story:** As a Bulk_Price_Importer, I want the system to update `cost_price` and record a history entry for every product whose price has actually changed, so that the audit trail reflects only genuine vendor price movements.

#### Acceptance Criteria

1. WHEN an Import_Row is valid and the matched product's `cost_price` differs from `new_price`, THE Price_List_Module SHALL call the `update_product_price` RPC with `field_name = 'cost_price'`, the new value, and the authenticated user's ID as `changed_by`.
2. WHEN the `update_product_price` RPC is called, THE Price_List_Module SHALL rely on the RPC to atomically update `cost_price` and write a Price_History entry in the same database transaction.
3. WHEN an Import_Row is valid and the matched product's `cost_price` is already equal to `new_price`, THE Price_List_Module SHALL skip that row and increment the skipped count; THE Price_List_Module SHALL NOT call the `update_product_price` RPC for that row.
4. WHEN an Import_Row includes a non-empty `description` value, THE Price_List_Module SHALL update the product's `description` field in addition to calling the `update_product_price` RPC for the price change.
5. IF the `update_product_price` RPC returns an error for a row, THEN THE Price_List_Module SHALL record a row-level error for that row, leave the product's price unchanged, and continue processing the remaining rows.

---

### Requirement 5: Return Import Result Summary

**User Story:** As a Bulk_Price_Importer, I want a clear summary after the import completes, so that I know how many products were updated, skipped, and failed.

#### Acceptance Criteria

1. WHEN processing of a Price_Import_File is complete, THE Price_List_Module SHALL return an Import_Result containing the count of rows where `cost_price` was updated (`updated`), the count of rows skipped because the price was unchanged (`skipped`), and the count of rows that failed validation or processing (`failed`).
2. THE Price_List_Module SHALL display the Import_Result to the Bulk_Price_Importer on the upload page immediately after processing completes.
3. WHEN the Import_Result contains one or more row-level errors, THE Price_List_Module SHALL display the error messages to the Bulk_Price_Importer and provide an option to download a CSV error report.
4. WHEN the Import_Result contains zero updated rows and zero failed rows, THE Price_List_Module SHALL display a message indicating that all rows were skipped because no prices changed.
5. WHEN at least one row was successfully updated, THE Price_List_Module SHALL display a success message stating the number of products whose `cost_price` was updated.

---

### Requirement 6: Authentication and Authorization

**User Story:** As a system administrator, I want the bulk price import endpoint to require authentication, so that only authorized users can modify product prices in bulk.

#### Acceptance Criteria

1. WHEN a request is made to the bulk price import API endpoint without a valid authenticated session, THE Price_List_Module SHALL return a 401 Unauthorized response and process no rows.
2. WHEN a valid authenticated session is present, THE Price_List_Module SHALL use the authenticated user's ID as the `changed_by` value in every `update_product_price` RPC call made during the import.
