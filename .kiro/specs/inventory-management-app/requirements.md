# Requirements Document: Inventory Management App

## Introduction

This document specifies the functional and non-functional requirements for a comprehensive personal inventory management system for mobile parts. The system is designed as an internal management tool (not customer-facing) that enables the owner to manage product inventory with booking capabilities, create orders that reserve inventory, convert orders to sales with automatic inventory deduction, manage clients, and view analytics on sales performance, profit, and inventory value. The application features advanced table operations (search, filter, sort, pagination), Excel import for bulk uploads, and real-time inventory tracking distinguishing between total, booked, and available quantities. There is no authentication required—all data is accessible to the owner for complete management control.

## Glossary

- **System**: The Personal Inventory Management Application
- **Owner**: The single user managing the system (no authentication required)
- **Product**: A mobile part item in inventory with quantity tracking
- **Inventory**: The collection of all products managed by the owner
- **Available_Quantity**: Computed value representing unbooked inventory (qty - booked_qty)
- **Booked_Quantity**: Quantity of product reserved in pending orders
- **Order**: A client request for products that reserves inventory
- **Sale**: A completed transaction that deducts inventory and records profit
- **Client**: A customer/contact entity associated with orders and sales (manually managed)
- **Order_Item**: A line item in an order specifying product and quantity
- **Sale_Item**: A line item in a sale with pricing and profit information
- **Transaction**: An atomic database operation that succeeds or fails completely
- **Analytics**: Aggregated data on sales performance, profit, and inventory value for business insights
- **Excel_Import**: Bulk product upload functionality from Excel files
- **Data Isolation**: Not required (single owner system)

## Requirements

### Requirement 1: Product Management

**User Story:** As a user, I want to create, view, update, and delete products in my inventory, so that I can maintain an accurate catalog of mobile parts.

#### Acceptance Criteria

1. WHEN a user creates a product with valid data, THE System SHALL create a new product record with a unique ID
2. THE System SHALL require part_number, model, model_code, and description fields for product creation
3. WHEN a user creates a product, THE System SHALL initialize booked_qty to 0
4. WHEN a user creates a product, THE System SHALL validate that qty, cost_price, and sell_price are non-negative numbers
5. WHEN a user views products, THE System SHALL display a computed available_qty field equal to qty minus booked_qty
6. WHEN a user updates a product, THE System SHALL verify the user owns the product before allowing modification
7. WHEN a user deletes a product, THE System SHALL verify the user owns the product before allowing deletion
8. THE System SHALL automatically set created_at and updated_at timestamps for all product operations

### Requirement 2: Product Search and Filtering

**User Story:** As a user, I want to search and filter my product inventory, so that I can quickly find specific items.

#### Acceptance Criteria

1. WHEN a user enters a search term, THE System SHALL search across part_number, model, model_code, and description fields
2. WHEN a user applies search filters, THE System SHALL return results using case-insensitive matching
3. WHEN a user sorts products, THE System SHALL support ascending and descending order on any column
4. WHEN a user requests a page of products, THE System SHALL return paginated results with configurable page size
5. THE System SHALL return pagination metadata including total count, current page, page size, and total pages
6. WHEN displaying products, THE System SHALL include the computed available_qty for each product

### Requirement 3: Excel Import for Products

**User Story:** As a user, I want to import products from an Excel file, so that I can quickly add multiple items to my inventory.

#### Acceptance Crite