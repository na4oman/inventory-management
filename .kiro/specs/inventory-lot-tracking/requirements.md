# Requirements Document

## Introduction

This feature replaces the current single `qty` field per product with lot/batch tracking. Each stock arrival — whether from a supplier delivery linked to a pending order or a manual free-stock entry — is recorded as a distinct inventory lot with its own cost price, quantity, and arrival date. When selling from free stock, the user manually selects which lot(s) to draw from, enabling accurate per-lot cost tracking and profit calculation. Existing stock is migrated into a single opening-stock lot per product to preserve historical data.

## Glossary

- **Lot**: A discrete batch of stock for a specific product, created at the time of stock arrival. Each lot has its own cost price, quantity, arrival date, and status.
- **Lot_Manager**: The system component responsible for creating, updating, and querying inventory lots.
- **Lot_Selector**: The UI component that allows users to choose which lot(s) to sell from during free-stock sales.
- **Stock_Receiver**: The system component that handles stock arrival — either from a pending order or as a manual free-stock entry.
- **Sale_Processor**: The system component that processes sales, deducts lot quantities, and calculates profit.
- **Product**: An item in the inventory catalogue, identified by a part number.
- **Free_Stock**: Stock not linked to any specific customer order, available for general sale.
- **Order_Stock**: Stock received as part of a specific customer order, linked to an order item.
- **Opening_Stock_Lot**: A synthetic lot created during migration to represent a product's existing `qty` before lot tracking was introduced.
- **Active_Lot**: A lot with a remaining quantity greater than zero.
- **Depleted_Lot**: A lot whose remaining quantity has reached zero; it is archived and excluded from available stock calculations.
- **Lot_Allocation**: A record linking a specific sale item to a specific lot, capturing the quantity drawn and the lot's cost price at the time of sale.

---

## Requirements

### Requirement 1: Lot Creation from Order Stock Receipt

**User Story:** As a warehouse operator, I want a new inventory lot to be created automatically when I receive stock from a pending order, so that the cost price and quantity from that order are tracked separately from other stock.

#### Acceptance Criteria

1. WHEN stock is received from a pending order item, THE Lot_Manager SHALL create a new lot with the product_id, quantity received, cost_price from the order item, the linked order_item_id, and the arrival date.
2. WHEN a lot is created from an order item, THE Lot_Manager SHALL set the lot status to `active`.
3. WHEN a lot is created from an order item, THE Stock_Receiver SHALL NOT increment the product's `qty` field directly; the product's total available quantity SHALL be derived from the sum of all active lot quantities.
4. IF the order item's cost_price is zero or null at the time of receipt, THEN THE Lot_Manager SHALL reject the lot creation and return a descriptive error message.

---

### Requirement 2: Lot Creation from Free Stock Arrival

**User Story:** As a warehouse operator, I want to manually record a free-stock arrival as a new lot with a specific cost price, so that I can track stock that arrives outside of any customer order.

#### Acceptance Criteria

1. WHEN a user submits a free-stock arrival form, THE Lot_Manager SHALL create a new lot with the product_id, quantity, cost_price, arrival date, and optional notes provided by the user.
2. WHEN a free-stock lot is created, THE Lot_Manager SHALL set the lot status to `active`.
3. THE Lot_Manager SHALL assign a sequential, human-readable lot identifier (e.g., "Lot #1", "Lot #2") scoped to each product.
4. IF the quantity submitted is less than or equal to zero, THEN THE Lot_Manager SHALL reject the submission and return a descriptive error message.
5. IF the cost_price submitted is less than zero, THEN THE Lot_Manager SHALL reject the submission and return a descriptive error message.

---

### Requirement 3: Lot Visibility on Product Page

**User Story:** As a warehouse operator, I want to see all active lots for a product on the product detail page, so that I know exactly how much stock is available and at what cost.

#### Acceptance Criteria

1. WHEN a user views a product detail page, THE Lot_Manager SHALL return all active lots for that product, each including: lot identifier, arrival date, remaining quantity, and cost_price per unit.
2. THE Lot_Manager SHALL return lots ordered by arrival date ascending (oldest first).
3. WHEN a product has active lots, THE Lot_Manager SHALL compute the product's total available quantity as the sum of all active lot quantities.
4. WHEN a product has no active lots, THE Lot_Manager SHALL return a total available quantity of zero.
5. WHILE a lot is depleted (remaining quantity equals zero), THE Lot_Manager SHALL exclude it from the active lot list and from the total available quantity calculation.

---

### Requirement 4: Lot Selection for Free-Stock Sales

**User Story:** As a sales operator, I want to manually select which lot(s) to sell from when creating a free-stock sale, so that the correct cost price is used for profit calculation.

#### Acceptance Criteria

1. WHEN a user adds a free-stock product to a sale, THE Lot_Selector SHALL display all active lots for that product, showing the lot identifier, arrival date, remaining quantity, and cost_price per unit.
2. WHEN a user selects a lot and enters a quantity, THE Lot_Selector SHALL prevent the user from entering a quantity greater than the lot's remaining quantity.
3. WHEN a user selects multiple lots for the same product, THE Sale_Processor SHALL record a separate Lot_Allocation for each lot selected.
4. THE Lot_Selector SHALL display a running total of the quantity allocated across all selected lots for a product.
5. IF the total quantity allocated across all selected lots for a product exceeds the product's total active stock, THEN THE Lot_Selector SHALL display a validation error and prevent sale submission.
6. WHEN a sale contains only order-linked items (source = `order_item`), THE Lot_Selector SHALL NOT be shown; those items use the order item's cost_price as before.

---

### Requirement 5: Lot Depletion on Sale Confirmation

**User Story:** As a sales operator, I want lot quantities to be decremented automatically when a sale is confirmed, so that the inventory always reflects the true remaining stock.

#### Acceptance Criteria

1. WHEN a free-stock sale is confirmed, THE Sale_Processor SHALL decrement each selected lot's remaining quantity by the allocated quantity.
2. WHEN a lot's remaining quantity reaches zero after a sale, THE Lot_Manager SHALL set that lot's status to `depleted`.
3. WHEN a lot is depleted, THE Lot_Manager SHALL archive the lot record and exclude it from all active lot queries.
4. WHEN a free-stock sale is confirmed, THE Sale_Processor SHALL record a Lot_Allocation for each lot used, storing: lot_id, sale_item_id, quantity_allocated, and cost_price_at_time_of_sale.
5. WHEN a free-stock sale is confirmed, THE Sale_Processor SHALL calculate the cost for each sale item as the sum of (quantity_allocated × cost_price_at_time_of_sale) across all Lot_Allocations for that sale item.
6. IF a lot's remaining quantity would become negative after a sale, THEN THE Sale_Processor SHALL reject the sale and return a descriptive error message.

---

### Requirement 6: Product Total Quantity Derivation

**User Story:** As a warehouse operator, I want the product's displayed total quantity to always reflect the sum of its active lots, so that I have a single accurate view of available stock.

#### Acceptance Criteria

1. THE Lot_Manager SHALL compute a product's total available quantity as the sum of the `remaining_qty` of all active lots for that product.
2. WHEN a lot is created or updated, THE Lot_Manager SHALL keep the product's `qty` field in sync with the computed total of active lot quantities.
3. WHEN all lots for a product are depleted, THE Lot_Manager SHALL set the product's `qty` field to zero.
4. THE Lot_Manager SHALL ensure that the product's `qty` field and the sum of active lot quantities are always equal (invariant).

---

### Requirement 7: Cost Price Immutability

**User Story:** As a finance manager, I want the cost price recorded on a lot to never change after creation, so that historical profit calculations remain accurate.

#### Acceptance Criteria

1. THE Lot_Manager SHALL store the cost_price on a lot at the time of creation and SHALL NOT allow it to be updated after the lot is created.
2. WHEN a sale item's profit is calculated, THE Sale_Processor SHALL use the cost_price from the Lot_Allocation records, not the product's current cost_price field.
3. THE Lot_Manager SHALL ensure that the cost_price on a lot is independent of any price list changes.

---

### Requirement 8: Opening Stock Migration

**User Story:** As a system administrator, I want existing product stock to be migrated into opening-stock lots, so that no inventory data is lost when lot tracking is introduced.

#### Acceptance Criteria

1. WHEN the migration runs, THE Lot_Manager SHALL create one Opening_Stock_Lot per product that has a `qty` greater than zero.
2. WHEN creating an Opening_Stock_Lot, THE Lot_Manager SHALL set the lot's quantity to the product's current `qty` value, the cost_price to the product's current `cost_price` field, and the arrival date to the migration execution date.
3. WHEN creating an Opening_Stock_Lot, THE Lot_Manager SHALL set the lot's notes to "Opening stock — migrated from legacy qty field".
4. WHEN the migration runs, THE Lot_Manager SHALL NOT delete or modify the product's existing `qty` field until all Opening_Stock_Lots have been successfully created.
5. IF a product has a `qty` of zero, THEN THE Lot_Manager SHALL NOT create an Opening_Stock_Lot for that product.

---

### Requirement 9: Lot Identifier Assignment

**User Story:** As a warehouse operator, I want each lot to have a clear, human-readable identifier scoped to its product, so that I can reference specific lots in conversations and records.

#### Acceptance Criteria

1. THE Lot_Manager SHALL assign a sequential integer lot number to each lot, scoped per product (e.g., the first lot for a product is Lot #1, the second is Lot #2).
2. WHEN a lot is displayed, THE Lot_Manager SHALL format the identifier as "Lot #N" where N is the sequential number.
3. THE Lot_Manager SHALL ensure lot numbers are unique per product and are never reused, even after a lot is depleted.
4. THE Lot_Manager SHALL assign lot numbers in the order lots are created (creation timestamp ascending).
