# Implementation Plan: Inventory Management App

## Overview

This plan implements a comprehensive inventory management system for mobile parts using Next.js 14 (App Router), TypeScript, Supabase, and Clerk. The system features product management with booking/available quantity tracking, order creation with inventory reservation, order-to-sale conversion with automatic inventory deduction, client management, Excel import for bulk uploads, and analytics dashboard with revenue, profit, and sales trends.

## Tasks

- [x] 1. Set up project foundation (no authentication)
  - Initialize Next.js 14 project with TypeScript and App Router
  - Install and configure Tailwind CSS with Radix UI components
  - Create dashboard layout at `app/(dashboard)/layout.tsx`
  - Create home page at `app/(dashboard)/page.tsx`
  - Remove Clerk authentication (no sign-in page needed)
  - Remove middleware authentication checks
  - _Requirements: Modern UI framework, dashboard layout_

- [x] 2. Set up Supabase database and schema
  - [x] 2.1 Create Supabase project and configure connection
    - Install @supabase/supabase-js
    - Create Supabase client utility in `lib/supabase/client.ts`
    - Configure environment variables for Supabase URL and keys
    - _Requirements: Database connection, secure configuration_

  - [x] 2.2 Create database tables with TypeScript types
    - Create `products` table with all fields (id, part_number, model, model_code, description, color, qty, booked_qty, cost_price, sell_price, timestamps) - NO user_id
    - Create `clients` table (id, name, email, phone, address, timestamps) - NO user_id
    - Create `orders` table (id, order_number, client_id, status, total_amount, notes, timestamps) - NO user_id
    - Create `order_items` table (id, order_id, product_id, quantity, unit_price, subtotal, created_at)
    - Create `sales` table (id, sale_number, order_id, client_id, total_amount, total_cost, profit, notes, sale_date, created_at) - NO user_id
    - Create `sale_items` table (id, sale_id, product_id, quantity, unit_price, unit_cost, subtotal, cost_total, profit, created_at)
    - Define TypeScript interfaces in `lib/types/database.ts` matching all table schemas
    - _Requirements: Complete data model, type safety_

  - [x] 2.3 Implement Row-Level Security policies
    - Disable RLS on all tables (single owner system, no data isolation needed)
    - _Requirements: Simplified database access_

  - [x] 2.4 Create database helper functions (Supabase RPC)
    - Create `increment_booked_qty(product_id, amount)` function
    - Create `deduct_inventory(product_id, quantity)` function with negative check
    - Create `generate_order_number()` function returning 'ORD00001' format
    - Create `generate_sale_number()` function returning 'SAL00001' format
    - _Requirements: Atomic operations, inventory management, unique identifiers_

  - [x] 2.5 Create database indexes for performance
    - Add indexes on products: user_id, part_number, model_code, created_at
    - Add indexes on orders: user_id, client_id, status, created_at
    - Add indexes on sales: user_id, client_id, sale_date, order_id
    - Add indexes on order_items: order_id, product_id
    - Add indexes on sale_items: sale_id, product_id
    - Add composite indexes: products(user_id, part_number, model), orders(user_id, status, created_at)
    - _Requirements: Query performance, fast search and filtering_

- [x] 3. Implement core API types and utilities
  - Create API response types in `lib/types/api.ts`: ApiResponse<T>, PaginatedResponse<T>, TableFilters
  - Create view model types: ProductWithAvailability, OrderWithDetails, SaleWithDetails, InventoryOverview, AnalyticsSummary
  - Create Zod validation schemas in `lib/validations/` for product, order, sale, client forms
  - Create error handling utilities in `lib/utils/errors.ts`
  - _Requirements: Type safety, validation, consistent API responses_

- [x] 4. Implement Products API routes
  - [x] 4.1 Create GET /api/products route
    - Implement pagination with page and pageSize query params
    - Implement search across part_number, model, model_code, description using ilike
    - Implement sorting by any field with sortBy and sortOrder params
    - No user_id filtering (single owner system)
    - Add computed available_qty field (qty - booked_qty) to response
    - Return PaginatedResponse with data, total, page, pageSize, totalPages
    - _Requirements: Product listing, search, filter, sort, pagination_

  - [x] 4.2 Create POST /api/products route
    - Validate request body with Zod schema (part_number, model, model_code, description required)
    - No authentication check needed
    - Insert product with booked_qty = 0
    - Return created product with success flag
    - _Requirements: Product creation, validation_

  - [x] 4.3 Create PATCH /api/products/[id] route
    - No ownership verification needed (single owner)
    - Validate partial update data
    - Update product fields
    - Return updated product
    - _Requirements: Product editing_

  - [x] 4.4 Create DELETE /api/products/[id] route
    - No ownership verification needed
    - Check if product has pending orders (booked_qty > 0)
    - Delete product if no dependencies
    - Return success response
    - _Requirements: Product deletion, dependency checking_

  - [x] 4.5 Create POST /api/products/import route for Excel import
    - Accept Excel file upload (.xlsx, .xls)
    - Parse Excel using xlsx library
    - Validate each row (required fields, numeric types, non-negative values)
    - Collect validation errors with row numbers
    - Bulk insert valid products with booked_qty = 0
    - Return { imported: number, errors: string[] }
    - _Requirements: Bulk import, Excel parsing, validation, error reporting_

- [-] 5. Implement order creation with inventory booking
  - [x] 5.1 Create POST /api/orders route with transaction logic
    - Validate request body: client_id (UUID), items array (product_id, quantity), optional notes
    - No authentication check needed
    - Begin database transaction
    - For each item: verify product exists, check available_qty >= quantity
    - Generate unique order_number using RPC function
    - Create order record with status = 'pending', total_amount = 0
    - For each item: create order_item, increment product.booked_qty, capture unit_price from product.sell_price
    - Calculate order.total_amount as sum of item subtotals
    - Update order with total_amount
    - Commit transaction
    - On error: rollback transaction and return error
    - _Requirements: Order creation, inventory booking, atomic transactions, validation_

  - [ ]* 5.2 Write property test for order creation
    - **Property 1: Inventory Consistency - booked_qty increments match order quantities**
    - **Validates: Requirements - Order creation increments booked_qty**
    - Generate random valid orders with multiple items
    - Verify product.booked_qty increases by exact order quantity
    - Verify available_qty = qty - booked_qty always holds
    - Verify order.total_amount = sum of item subtotals
    - _Requirements: Correctness property 1, 2, 5_

- [-] 6. Implement order-to-sale conversion with inventory deduction
  - [x] 6.1 Create POST /api/orders/[id]/convert route with transaction logic
    - No authentication check needed
    - Begin database transaction
    - Fetch order with items and products (eager loading)
    - Verify order.status = 'pending'
    - Verify order has items
    - For each item: verify product.qty >= item.quantity
    - Generate unique sale_number using RPC function
    - Create sale record with order_id, client_id, sale_date = now
    - For each order_item: create sale_item with unit_cost from product.cost_price, calculate profit
    - For each product: deduct qty and booked_qty by item.quantity using RPC function
    - Calculate sale totals: total_amount, total_cost, profit
    - Update sale with calculated totals
    - Update order.status to 'completed'
    - Commit transaction
    - On error: rollback transaction and return error
    - _Requirements: Order conversion, inventory deduction, profit calculation, atomic transactions_

  - [ ]* 6.2 Write property test for order-to-sale conversion
    - **Property 2: Order-Sale Relationship - conversion preserves amounts and deducts inventory correctly**
    - **Validates: Requirements - Sale conversion deducts qty and booked_qty**
    - Generate random orders and convert to sales
    - Verify sale.total_amount = order.total_amount
    - Verify product.qty decreases by exact sale quantity
    - Verify product.booked_qty decreases by exact sale quantity
    - Verify sale.profit = sale.total_amount - sale.total_cost
    - Verify order.status = 'completed' after conversion
    - _Requirements: Correctness property 3, 4, 6_

- [x] 7. Implement Orders API routes
  - [x] 7.1 Create GET /api/orders route
    - Implement pagination, search, sorting similar to products
    - No user_id filtering (single owner system)
    - Optional status filtering
    - Eager load client and order_items with products
    - Add computed item_count field
    - Return PaginatedResponse<OrderWithDetails>
    - _Requirements: Order listing, filtering, eager loading_

  - [x] 7.2 Create GET /api/orders/[id] route
    - No ownership verification needed
    - Fetch order with client, items, and products
    - Return OrderWithDetails
    - _Requirements: Order details view_

  - [x] 7.3 Create PATCH /api/orders/[id] route
    - No ownership verification needed
    - Only allow updates if status = 'pending'
    - Allow updating notes and status (to 'cancelled')
    - Return updated order
    - _Requirements: Order editing, status management_

- [x] 8. Implement Sales API routes
  - [x] 8.1 Create GET /api/sales route
    - Implement pagination, search, sorting
    - No user_id filtering (single owner system)
    - Optional date range filtering
    - Eager load client and sale_items with products
    - Add computed item_count field
    - Return PaginatedResponse<SaleWithDetails>
    - _Requirements: Sales listing, date filtering_

  - [x] 8.2 Create GET /api/sales/[id] route
    - No ownership verification needed
    - Fetch sale with client, items, and products
    - Return SaleWithDetails
    - _Requirements: Sale details view_

- [x] 9. Implement Clients API routes
  - [x] 9.1 Create GET /api/clients route
    - Implement pagination and search (name, email, phone)
    - No user_id filtering (single owner system)
    - Return PaginatedResponse<Client>
    - _Requirements: Client listing, search_

  - [x] 9.2 Create POST /api/clients route
    - Validate request body: name required, email/phone/address optional
    - No authentication check needed
    - Insert client
    - Return created client
    - _Requirements: Client creation_

  - [x] 9.3 Create PATCH /api/clients/[id] route
    - No ownership verification needed
    - Update client fields
    - Return updated client
    - _Requirements: Client editing_

  - [x] 9.4 Create DELETE /api/clients/[id] route
    - No ownership verification needed
    - Check if client has orders or sales
    - Delete if no dependencies or return error
    - _Requirements: Client deletion, dependency checking_

- [x] 10. Implement Analytics API routes
  - [x] 10.1 Create GET /api/analytics/overview route for inventory overview
    - No authentication check needed
    - Aggregate products: sum(qty), sum(booked_qty), sum(qty * cost_price), count(*)
    - Calculate available_qty = total_qty - booked_qty
    - Return InventoryOverview
    - _Requirements: Inventory overview, aggregation_

  - [x] 10.2 Create GET /api/analytics/summary route for sales analytics
    - No authentication check needed
    - Accept optional startDate and endDate query params
    - Fetch all sales in date range
    - Calculate total_revenue = sum(sale.total_amount)
    - Calculate total_profit = sum(sale.profit)
    - Calculate profit_margin = (total_profit / total_revenue) * 100
    - Aggregate sale_items by product_id for top selling products
    - Sort by total_quantity_sold descending, limit 10
    - Group sales by date for sales_by_period
    - Return AnalyticsSummary
    - _Requirements: Sales analytics, profit calculation, top products, trends_

  - [ ]* 10.3 Write property test for analytics calculations
    - **Property 3: Analytics Accuracy - aggregations match sum of individual records**
    - **Validates: Requirements - Analytics calculations are accurate**
    - Generate random sales data
    - Verify total_revenue = sum of all sale.total_amount
    - Verify total_profit = sum of all sale.profit
    - Verify profit_margin calculation is correct
    - Verify top products aggregation matches manual calculation
    - _Requirements: Correctness property 7_

- [x] 11. Implement React Query hooks for state management
  - Create `lib/hooks/useProducts.ts` with useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct
  - Create `lib/hooks/useOrders.ts` with useOrders, useCreateOrder, useConvertOrderToSale
  - Create `lib/hooks/useSales.ts` with useSales, useSale
  - Create `lib/hooks/useClients.ts` with useClients, useCreateClient, useUpdateClient, useDeleteClient
  - Create `lib/hooks/useAnalytics.ts` with useAnalyticsSummary, useInventoryOverview
  - Configure React Query client in `app/providers.tsx` with staleTime and cacheTime
  - Implement optimistic updates and cache invalidation on mutations
  - _Requirements: Client-side state management, caching, real-time updates_

- [x] 12. Create shared UI components
  - Create `components/ui/` with Radix UI primitives: Button, Dialog, Select, Table, Input, Label, Card
  - Create `components/shared/DataTable.tsx` with search, filter, sort, pagination support
  - Create `components/shared/LoadingSpinner.tsx`
  - Create `components/shared/ErrorMessage.tsx`
  - Create `components/shared/Toast.tsx` for notifications
  - Create `components/layout/Sidebar.tsx` with navigation links
  - Create `components/layout/Header.tsx` with user menu and Clerk UserButton
  - _Requirements: Reusable components, consistent UI, accessibility_

- [x] 13. Implement Products module UI
  - [x] 13.1 Create products list page
    - Create `app/(dashboard)/products/page.tsx`
    - Use DataTable component with useProducts hook
    - Display columns: part_number, model, model_code, qty, booked_qty, available_qty, cost_price, sell_price, actions
    - Implement search, sort, pagination
    - Add "New Product" and "Import Excel" buttons
    - Add row actions: Edit, Delete
    - _Requirements: Product listing, table operations_

  - [x] 13.2 Create product form component
    - Create `components/products/ProductForm.tsx`
    - Use React Hook Form with Zod validation
    - Fields: part_number, model, model_code, description, color, qty, cost_price, sell_price
    - Display validation errors
    - Handle submit with loading state
    - _Requirements: Product form, validation, user feedback_

  - [x] 13.3 Create new product page
    - Create `app/(dashboard)/products/new/page.tsx`
    - Use ProductForm component with useCreateProduct hook
    - Redirect to products list on success
    - Show toast notification
    - _Requirements: Product creation UI_

  - [x] 13.4 Create edit product page
    - Create `app/(dashboard)/products/[id]/edit/page.tsx`
    - Fetch product data and populate ProductForm
    - Use useUpdateProduct hook
    - Redirect to products list on success
    - _Requirements: Product editing UI_

  - [x] 13.5 Create Excel import component
    - Create `components/products/ExcelImport.tsx`
    - File upload input accepting .xlsx, .xls
    - Display upload progress
    - Show import results: success count and error list
    - Allow downloading error report
    - _Requirements: Excel import UI, error reporting_

- [x] 14. Implement Orders module UI
  - [x] 14.1 Create orders list page
    - Create `app/(dashboard)/orders/page.tsx`
    - Use DataTable with useOrders hook
    - Display columns: order_number, client name, status, total_amount, item_count, created_at, actions
    - Filter by status (all, pending, completed, cancelled)
    - Add "New Order" button
    - Add row actions: View, Convert to Sale (if pending), Cancel
    - _Requirements: Order listing, status filtering_

  - [x] 14.2 Create order form component
    - Create `components/orders/OrderForm.tsx`
    - Use React Hook Form with Zod validation
    - Client selection dropdown (searchable)
    - Order items selector with product search, quantity input, unit price display
    - Display running total
    - Show available quantity for each product
    - Validate quantity <= available_qty
    - _Requirements: Order form, item selection, validation_

  - [x] 14.3 Create new order page
    - Create `app/(dashboard)/orders/new/page.tsx`
    - Use OrderForm with useCreateOrder hook
    - Redirect to orders list on success
    - Show toast notification
    - _Requirements: Order creation UI_

  - [x] 14.4 Create order details page
    - Create `app/(dashboard)/orders/[id]/page.tsx`
    - Display order information: order_number, client, status, notes, created_at
    - Display order items table: product, quantity, unit_price, subtotal
    - Display total_amount
    - Show "Convert to Sale" button if status = 'pending'
    - _Requirements: Order details view_

  - [x] 14.5 Create order conversion dialog
    - Create `components/orders/ConvertOrderDialog.tsx`
    - Show confirmation dialog with order summary
    - Display inventory check: verify all products have sufficient qty
    - Use useConvertOrderToSale hook
    - Show success/error toast
    - Invalidate orders, sales, products, analytics queries on success
    - _Requirements: Order conversion UI, confirmation, validation_

- [x] 15. Implement Sales module UI
  - [x] 15.1 Create sales list page
    - Create `app/(dashboard)/sales/page.tsx`
    - Use DataTable with useSales hook
    - Display columns: sale_number, client name, total_amount, profit, profit_margin, sale_date, actions
    - Filter by date range
    - Add row action: View Details
    - _Requirements: Sales listing, date filtering_

  - [x] 15.2 Create sale details page
    - Create `app/(dashboard)/sales/[id]/page.tsx`
    - Display sale information: sale_number, client, order_number (if from order), sale_date
    - Display sale items table: product, quantity, unit_price, unit_cost, subtotal, cost_total, profit
    - Display totals: total_amount, total_cost, profit, profit_margin
    - _Requirements: Sale details view, profit breakdown_

- [x] 16. Implement Clients module UI
  - [x] 16.1 Create clients list page
    - Create `app/(dashboard)/clients/page.tsx`
    - Use DataTable with useClients hook
    - Display columns: name, email, phone, address, created_at, actions
    - Implement search
    - Add "New Client" button
    - Add row actions: Edit, Delete
    - _Requirements: Client listing, search_

  - [x] 16.2 Create client form component
    - Create `components/clients/ClientForm.tsx`
    - Use React Hook Form with Zod validation
    - Fields: name (required), email, phone, address
    - _Requirements: Client form, validation_

  - [x] 16.3 Create new client page
    - Create `app/(dashboard)/clients/new/page.tsx`
    - Use ClientForm with useCreateClient hook
    - Redirect to clients list on success
    - _Requirements: Client creation UI_

  - [x] 16.4 Create edit client dialog
    - Create `components/clients/EditClientDialog.tsx`
    - Inline editing in dialog
    - Use useUpdateClient hook
    - _Requirements: Client editing UI_

- [x] 17. Implement Analytics dashboard
  - [x] 17.1 Create analytics overview cards
    - Create `components/analytics/AnalyticsCard.tsx`
    - Display metric with icon, value, subtitle, optional trend
    - _Requirements: Analytics visualization_

  - [x] 17.2 Create sales chart component
    - Create `components/analytics/SalesChart.tsx`
    - Use Recharts library for line/bar chart
    - Display sales by period (revenue, profit)
    - Support period selection: day, week, month
    - _Requirements: Sales trends visualization_

  - [x] 17.3 Create top products table
    - Create `components/analytics/TopProductsTable.tsx`
    - Display top 10 selling products
    - Columns: part_number, model, quantity_sold, revenue, profit
    - _Requirements: Top products display_

  - [x] 17.4 Create analytics dashboard page
    - Create `app/(dashboard)/analytics/page.tsx`
    - Display inventory overview cards: total_qty, booked_qty, available_qty, total_value
    - Display sales summary cards: total_revenue, total_profit, total_sales, profit_margin
    - Display SalesChart component
    - Display TopProductsTable component
    - Add date range filter
    - _Requirements: Analytics dashboard, comprehensive metrics_

- [x] 18. Create dashboard home page
  - Create `app/(dashboard)/page.tsx`
  - Display quick stats: total products, pending orders, recent sales
  - Display recent activity: latest orders and sales
  - Display inventory alerts: low stock, high booked_qty
  - Add quick action buttons: New Product, New Order, View Analytics
  - _Requirements: Dashboard overview, quick access_

- [x] 19. Implement error handling and loading states
  - Create error boundaries for each module
  - Add loading skeletons for tables and forms
  - Implement toast notifications for success/error messages
  - Add retry logic for failed API requests
  - Display user-friendly error messages
  - _Requirements: User experience, error recovery_

- [x] 20. Add form validation and user feedback
  - Ensure all forms show inline validation errors
  - Add loading spinners on submit buttons
  - Disable forms during submission
  - Show success toasts after mutations
  - Implement optimistic UI updates where appropriate
  - _Requirements: Form UX, validation feedback_

- [ ] 21. Implement responsive design
  - Ensure all pages work on mobile, tablet, desktop
  - Make tables horizontally scrollable on mobile
  - Adjust sidebar to drawer on mobile
  - Test all forms on different screen sizes
  - _Requirements: Mobile responsiveness, accessibility_

- [ ] 22. Add data export functionality
  - Create export to Excel button on products list
  - Create export to Excel button on sales list
  - Use xlsx library to generate Excel files
  - Include all visible columns and applied filters
  - _Requirements: Data export, reporting_

- [x] 23. Implement search and filter enhancements
  - Add advanced filters dialog for products: price range, stock level
  - Add advanced filters for orders: date range, status, client
  - Add advanced filters for sales: date range, profit range, client
  - Persist filter state in URL query params
  - _Requirements: Advanced filtering, user experience_

- [ ] 24. Add keyboard shortcuts and accessibility
  - Implement keyboard navigation for tables (arrow keys)
  - Add keyboard shortcuts: Ctrl+K for search, N for new item
  - Ensure all interactive elements are keyboard accessible
  - Add proper ARIA labels and roles
  - Test with screen reader
  - _Requirements: Accessibility, keyboard navigation_

- [ ] 25. Final integration and testing
  - Test complete order-to-sale workflow end-to-end
  - Test Excel import with various file formats and error cases
  - Test concurrent order creation (race conditions)
  - Verify all analytics calculations are accurate
  - Test authentication flows (login, logout, session expiry)
  - Verify RLS policies prevent data leakage between users
  - Test error scenarios: insufficient inventory, network failures
  - _Requirements: Integration testing, security verification_

- [ ] 26. Performance optimization
  - Implement virtual scrolling for large product lists
  - Add debounced search inputs (300ms delay)
  - Optimize database queries with proper indexes
  - Enable React Query caching with appropriate staleTime
  - Use Next.js dynamic imports for heavy components (charts, Excel)
  - Measure and optimize Core Web Vitals
  - _Requirements: Performance, scalability_

- [ ] 27. Documentation and deployment preparation
  - Create README with setup instructions
  - Document environment variables
  - Create database migration scripts
  - Set up Vercel deployment configuration
  - Configure production environment variables
  - Test production build locally
  - _Requirements: Deployment readiness, documentation_

## Notes

- Tasks marked with `*` are optional property-based tests and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The implementation follows the design document's algorithms and specifications
- All database operations use transactions to ensure atomicity
- Authentication is verified on every API route using Clerk
- Row-Level Security ensures user data isolation at the database level
- The system tracks inventory with three quantities: qty (total), booked_qty (reserved), available_qty (qty - booked_qty)
- Order creation increments booked_qty, sale conversion decrements both qty and booked_qty
- All financial calculations maintain 2 decimal precision
- The UI uses React Query for state management with automatic cache invalidation
- Forms use React Hook Form with Zod validation for type-safe validation
- The design includes 10 correctness properties that are validated through the implementation
