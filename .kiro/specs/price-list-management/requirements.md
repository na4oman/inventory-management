# Requirements Document

## Introduction

The Price List & Price History feature adds a standalone pricing module to the inventory management app. It manages the current vendor cost price and customer sell price per product, maintains a full audit trail of price changes over time, and supports per-customer negotiated prices. Prices stored on orders and sales at the time of creation remain locked and are never retroactively modified by price list changes.

## Glossary

- **Price_List_Module**: The standalone module responsible for managing cost and sell prices per product, independent of inventory stock levels.
- **Cost_Price**: The latest vendor purchase price for a product, stored on the `products` table as `cost_price`.
- **Sell_Price**: The standard customer sell price for a product, stored on the `products` table as `sell_price`.
- **Price_History**: An immutable audit log recording every change to a product's `cost_price` or `sell_price`, including the old value, new value, changed-by user, and timestamp.
- **Customer_Price**: A negotiated sell price for a specific product–client combination that overrides the standard `sell_price` when creating orders or sales for that client.
- **Locked_Price**: The `unit_price` captured on an `order_item` or `sale_item` row at the moment of creation, which is never changed by subsequent price list updates.
- **Price_Manager**: The authenticated user who views and edits prices through the Price List Module.
- **Order_Item**: A row in the `order_items` table containing a `unit_price` that was locked at order creation time.
- **Sale_Item**: A row in the `sale_items` table containing a `unit_price` that was locked at sale creation time.

---

## Requirements

### Requirement 1: View Price List

**User Story:** As a Price_Manager, I want to view all products with their current Cost_Price and Sell_Price on a single page, so that I can quickly assess the current pricing state of the catalog.

#### Acceptance Criteria

1. THE Price_List_Module SHALL display all products in a paginated, searchable table showing `part_number`, `model`, `cost_price`, and `sell_price` for each product.
2. WHEN the Price_Manager enters a search term, THE Price_List_Module SHALL filter the displayed products to those whose `part_number` or `model` contains the search term within 500ms.
3. THE Price_List_Module SHALL allow sorting the product list by `part_number`, `cost_price`, or `sell_price` in ascending or descending order.
4. WHEN the product catalog contains more than 50 products, THE Price_List_Module SHALL paginate results with a configurable page size of 25 or 50 items per page.

---

### Requirement 2: Update Cost Price and Sell Price

**User Story:** As a Price_Manager, I want to update the Cost_Price and Sell_Price for any product, so that the price list always reflects the latest vendor and market rates.

#### Acceptance Criteria

1. WHEN the Price_Manager submits a valid price update for a product, THE Price_List_Module SHALL persist the new `cost_price` and/or `sell_price` to the `products` table.
2. WHEN a price update is persisted, THE Price_List_Module SHALL record a Price_History entry containing the product ID, field name (`cost_price` or `sell_price`), old value, new value, the authenticated user's ID, and the UTC timestamp of the change.
3. IF the Price_Manager submits a price value that is negative or non-numeric, THEN THE Price_List_Module SHALL reject the update and return a descriptive validation error without modifying any data.
4. IF the Price_Manager submits a price value of zero, THEN THE Price_List_Module SHALL accept the update, as zero is a valid price (e.g. free items or placeholder entries).
5. WHEN a product's `cost_price` or `sell_price` is updated, THE Price_List_Module SHALL NOT modify the `unit_price` of any existing Order_Item or Sale_Item.

---

### Requirement 3: Price History Audit Trail

**User Story:** As a Price_Manager, I want to view the full history of price changes for any product, so that I can audit when and how prices changed over time.

#### Acceptance Criteria

1. WHEN the Price_Manager requests the price history for a product, THE Price_List_Module SHALL return all Price_History entries for that product ordered by timestamp descending.
2. THE Price_List_Module SHALL display each Price_History entry showing the field changed (`cost_price` or `sell_price`), the old value, the new value, the user who made the change, and the formatted UTC timestamp.
3. THE Price_List_Module SHALL retain Price_History entries indefinitely and SHALL NOT delete them when a product's price is subsequently updated.
4. WHEN a product has no Price_History entries, THE Price_List_Module SHALL display an empty state message indicating no price changes have been recorded.

---

### Requirement 4: Per-Customer Negotiated Prices

**User Story:** As a Price_Manager, I want to define a negotiated sell price for a specific product–client combination, so that repeat orders for that client automatically use the agreed price.

#### Acceptance Criteria

1. THE Price_List_Module SHALL allow the Price_Manager to create a Customer_Price record associating a `client_id`, `product_id`, and a negotiated `price` value.
2. WHEN a Customer_Price record already exists for a given `client_id` and `product_id`, THE Price_List_Module SHALL update the existing record's `price` rather than creating a duplicate.
3. THE Price_List_Module SHALL allow the Price_Manager to delete a Customer_Price record, after which the standard `sell_price` applies for that client–product combination.
4. IF the Price_Manager submits a Customer_Price with a negative or non-numeric price value, THEN THE Price_List_Module SHALL reject the request and return a descriptive validation error.
5. THE Price_List_Module SHALL display all Customer_Price records for a given product, showing the client name and negotiated price.
6. THE Price_List_Module SHALL display all Customer_Price records for a given client, showing the product `part_number` and negotiated price.

---

### Requirement 5: Customer Price Suggestion During Order and Sale Creation

**User Story:** As a Price_Manager, I want the system to suggest the negotiated Customer_Price when I add a product to an order or sale for a specific client, so that I do not have to remember or manually look up agreed prices.

#### Acceptance Criteria

1. WHEN an order or sale is being created for a client and a product is added, THE Price_List_Module SHALL check whether a Customer_Price exists for that `client_id` and `product_id` combination.
2. WHEN a Customer_Price exists for the client–product combination, THE Price_List_Module SHALL pre-populate the `unit_price` field with the Customer_Price value.
3. WHEN no Customer_Price exists for the client–product combination, THE Price_List_Module SHALL pre-populate the `unit_price` field with the product's standard `sell_price`.
4. WHILE an order or sale is being created, THE Price_List_Module SHALL allow the Price_Manager to manually override the pre-populated `unit_price` for any individual line item.

---

### Requirement 6: Price Isolation for Orders and Sales

**User Story:** As a Price_Manager, I want prices on existing orders and sales to remain unchanged when I update the price list, so that historical records accurately reflect the prices agreed at the time of transaction.

#### Acceptance Criteria

1. WHEN the Price_List_Module updates a product's `cost_price` or `sell_price`, THE Price_List_Module SHALL NOT update the `unit_price` on any Order_Item or Sale_Item row.
2. WHEN an Order_Item is created, THE Price_List_Module SHALL capture the `unit_price` at that moment and store it on the `order_items` row as a Locked_Price.
3. WHEN a Sale_Item is created, THE Price_List_Module SHALL capture the `unit_price` at that moment and store it on the `sale_items` row as a Locked_Price.
4. WHILE an order has status `pending`, THE Price_List_Module SHALL allow the Price_Manager to manually override the Locked_Price on individual Order_Item rows.
5. IF the Price_Manager attempts to modify the `unit_price` of an Order_Item whose parent order does not have status `pending`, THEN THE Price_List_Module SHALL reject the modification and return a descriptive error.

---

### Requirement 7: Price History Data Integrity

**User Story:** As a Price_Manager, I want every price change to be recorded atomically with the product update, so that the audit trail is always consistent with the current prices.

#### Acceptance Criteria

1. WHEN a product's `cost_price` or `sell_price` is updated, THE Price_List_Module SHALL write the Price_History entry and the product update in the same database transaction.
2. IF the Price_History entry cannot be written, THEN THE Price_List_Module SHALL roll back the product price update and return an error, leaving both the product and history in their previous state.
3. THE Price_List_Module SHALL record a Price_History entry only when the new price value differs from the current price value; submitting the same price SHALL NOT create a duplicate history entry.
