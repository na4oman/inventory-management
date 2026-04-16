# Free Stock & Forecast Orders - Implementation Guide

## Quick Start Summary

### What We're Building
1. **Forecast Orders**: Orders without a customer (for planning/free stock)
2. **Free Stock**: Inventory not booked to any customer
3. **Free Stock Sales**: Ability to create sales from free stock directly

### Key Changes
- Make `orders.client_id` nullable
- Add `orders.order_type` field ('customer' or 'forecast')
- Make `sales.client_id` nullable
- Add `sales.sale_type` field ('customer' or 'free_stock')
- Update order/sales creation logic to handle both types

---

## Phase 1: Enable Forecast Orders

### Step 1.1: Database Migration
```sql
-- Add order_type column
ALTER TABLE orders ADD COLUMN order_type VARCHAR(20) DEFAULT 'customer';

-- Make client_id nullable (if not already)
ALTER TABLE orders ALTER COLUMN client_id DROP NOT NULL;

-- Add index for filtering
CREATE INDEX idx_orders_order_type ON orders(order_type);
```

### Step 1.2: Update Database Types
File: `lib/types/database.ts`

```typescript
export interface Order {
  id: string;
  order_number: string;
  client_id: string | null;  // Changed: now nullable
  order_type: 'customer' | 'forecast';  // New field
  status: 'pending' | 'received' | 'completed' | 'cancelled';
  total_amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
```

### Step 1.3: Update Order Creation API
File: `app/api/orders/route.ts`

Key changes:
1. Make `client_id` optional in request validation
2. Auto-detect `order_type` from client_id presence
3. Skip inventory booking for forecast orders
4. Update validation schema

```typescript
// In createOrderSchema (lib/validations/order.ts)
export const createOrderSchema = z.object({
  client_id: z.string().uuid().optional(),  // Changed: optional
  items: z.array(z.object({
    product_id: z.string().uuid(),
    ordered_qty: z.number().positive(),
    unit_price: z.number().nonnegative().optional(),
  })),
  notes: z.string().optional(),
  order_type: z.enum(['customer', 'forecast']).optional(),  // New
});

// In POST handler
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { client_id, items, notes, order_type } = body;

  // Validate: either client_id provided OR order_type='forecast'
  if (!client_id && order_type !== 'forecast') {
    return NextResponse.json(
      createErrorResponse('Either client_id or order_type=forecast is required'),
      { status: 400 }
    );
  }

  // Auto-detect order_type
  const detectedOrderType = order_type || (client_id ? 'customer' : 'forecast');

  // If customer order, verify client exists
  if (detectedOrderType === 'customer') {
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        createErrorResponse('Client not found'),
        { status: 404 }
      );
    }
  }

  // ... rest of order creation logic ...
  // Note: Skip inventory booking for forecast orders
}
```

### Step 1.4: Update Order Display Components
File: `app/dashboard/orders/page.tsx`

Add indicator for forecast orders:
```typescript
// In order list, add badge
{order.order_type === 'forecast' && (
  <Badge variant="outline" className="bg-amber-50 text-amber-700">
    Forecast
  </Badge>
)}

// Show "No Client" for forecast orders
{order.client_id ? order.client.name : 'Forecast Order'}
```

### Step 1.5: Update Order Form
File: `components/orders/OrderForm.tsx`

```typescript
// Add toggle for forecast order
const [isForecastOrder, setIsForecastOrder] = useState(false);

// In form:
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    id="forecast"
    checked={isForecastOrder}
    onChange={(e) => setIsForecastOrder(e.target.checked)}
  />
  <Label htmlFor="forecast">Create as Forecast Order</Label>
</div>

// Make client selection conditional
{!isForecastOrder && (
  <div>
    <Label>Client *</Label>
    {/* client selection input */}
  </div>
)}

// Update form submission
const onSubmit = async (data) => {
  const payload = {
    ...data,
    client_id: isForecastOrder ? null : data.client_id,
    order_type: isForecastOrder ? 'forecast' : 'customer',
  };
  // submit...
};
```

---

## Phase 2: Enable Free Stock Sales

### Step 2.1: Database Migration
```sql
-- Make sales.client_id nullable
ALTER TABLE sales ALTER COLUMN client_id DROP NOT NULL;

-- Add sale_type column
ALTER TABLE sales ADD COLUMN sale_type VARCHAR(20) DEFAULT 'customer';

-- Make order_item_id nullable in sale_items
ALTER TABLE sale_items ALTER COLUMN order_item_id DROP NOT NULL;

-- Add index
CREATE INDEX idx_sales_sale_type ON sales(sale_type);
```

### Step 2.2: Update Database Types
File: `lib/types/database.ts`

```typescript
export interface Sale {
  id: string;
  sale_number: string;
  client_id: string | null;  // Changed: now nullable
  sale_type: 'customer' | 'free_stock';  // New field
  total_amount: number;
  total_cost: number;
  profit: number;
  notes: string | null;
  sale_date: string;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  order_item_id: string | null;  // Changed: now nullable
  product_id: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  subtotal: number;
  cost_total: number;
  profit: number;
  created_at: string;
}
```

### Step 2.3: Create Free Stock Sales API
File: `app/api/sales/from-free-stock/route.ts` (NEW)

```typescript
import { supabase } from '@/lib/supabase/client';
import { createSuccessResponse, createErrorResponse } from '@/lib/types/api';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/sales/from-free-stock
 * Create a sale from free (unbooked) inventory
 * 
 * Request body:
 * {
 *   client_id?: string (optional)
 *   items: Array<{
 *     product_id: string,
 *     quantity: number,
 *     unit_price: number
 *   }>,
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { client_id, items, notes } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        createErrorResponse('Items are required'),
        { status: 400 }
      );
    }

    // Fetch all products with current inventory
    const productIds = items.map((item: any) => item.product_id);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, qty, booked_qty, cost_price')
      .in('id', productIds);

    if (productsError) {
      return NextResponse.json(
        createErrorResponse('Failed to fetch products'),
        { status: 500 }
      );
    }

    const productMap = new Map(products?.map(p => [p.id, p]) || []);

    // Validate all items have sufficient free stock
    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return NextResponse.json(
          createErrorResponse(`Product ${item.product_id} not found`),
          { status: 404 }
        );
      }

      const freeQty = product.qty - product.booked_qty;
      if (item.quantity > freeQty) {
        return NextResponse.json(
          createErrorResponse(
            `Insufficient free stock for product. Free: ${freeQty}, Requested: ${item.quantity}`
          ),
          { status: 400 }
        );
      }
    }

    // Generate sale number
    const { data: saleNumberData, error: saleNumberError } = await supabase
      .rpc('generate_sale_number');

    if (saleNumberError || !saleNumberData) {
      return NextResponse.json(
        createErrorResponse('Failed to generate sale number'),
        { status: 500 }
      );
    }

    // Create sale record
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        sale_number: saleNumberData,
        client_id: client_id || null,
        sale_type: 'free_stock',
        total_amount: 0,
        total_cost: 0,
        profit: 0,
        notes: notes || null,
        sale_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (saleError || !sale) {
      return NextResponse.json(
        createErrorResponse('Failed to create sale'),
        { status: 500 }
      );
    }

    // Create sale items and deduct inventory
    let totalAmount = 0;
    let totalCost = 0;

    for (const item of items) {
      const product = productMap.get(item.product_id);
      const quantity = item.quantity;
      const unitPrice = item.unit_price;
      const unitCost = product.cost_price;
      const subtotal = quantity * unitPrice;
      const costTotal = quantity * unitCost;
      const profit = subtotal - costTotal;

      // Create sale item (no order_item_id for free stock sales)
      const { error: saleItemError } = await supabase
        .from('sale_items')
        .insert({
          sale_id: sale.id,
          order_item_id: null,
          product_id: product.id,
          quantity: quantity,
          unit_price: unitPrice,
          unit_cost: unitCost,
          subtotal: subtotal,
          cost_total: costTotal,
          profit: profit,
        });

      if (saleItemError) {
        return NextResponse.json(
          createErrorResponse('Failed to create sale item'),
          { status: 500 }
        );
      }

      // Deduct inventory
      const { error: deductError } = await supabase.rpc('deduct_inventory', {
        product_id: product.id,
        quantity: quantity,
      });

      if (deductError) {
        return NextResponse.json(
          createErrorResponse('Failed to deduct inventory'),
          { status: 500 }
        );
      }

      totalAmount += subtotal;
      totalCost += costTotal;
    }

    const saleProfit = totalAmount - totalCost;

    // Update sale with totals
    const { data: updatedSale, error: updateSaleError } = await supabase
      .from('sales')
      .update({
        total_amount: totalAmount,
        total_cost: totalCost,
        profit: saleProfit,
      })
      .eq('id', sale.id)
      .select()
      .single();

    if (updateSaleError || !updatedSale) {
      return NextResponse.json(
        createErrorResponse('Failed to update sale totals'),
        { status: 500 }
      );
    }

    return NextResponse.json(
      createSuccessResponse(updatedSale),
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating free stock sale:', error);
    return NextResponse.json(
      createErrorResponse('Failed to create sale'),
      { status: 500 }
    );
  }
}
```

### Step 2.4: Create Free Stock Endpoint
File: `app/api/free-stock/route.ts` (NEW)

```typescript
import { supabase } from '@/lib/supabase/client';
import { createSuccessResponse, createErrorResponse, createPaginatedResponse } from '@/lib/types/api';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/free-stock
 * Get products with free (unbooked) inventory
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '10')));
    const search = searchParams.get('search') || '';

    // Build count query
    let countQuery = supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    if (search) {
      countQuery = countQuery.or(
        `part_number.ilike.%${search}%,model.ilike.%${search}%`
      );
    }

    const { count } = await countQuery;

    // Build data query
    let query = supabase
      .from('products')
      .select('*');

    if (search) {
      query = query.or(
        `part_number.ilike.%${search}%,model.ilike.%${search}%`
      );
    }

    query = query.order('created_at', { ascending: false });

    const offset = (page - 1) * pageSize;
    query = query.range(offset, offset + pageSize - 1);

    const { data: products, error } = await query;

    if (error) {
      return NextResponse.json(
        createErrorResponse(error.message),
        { status: 500 }
      );
    }

    // Calculate free stock for each product
    const freeStockProducts = (products || [])
      .map(product => ({
        ...product,
        free_qty: product.qty - product.booked_qty,
      }))
      .filter(product => product.free_qty > 0);  // Only show products with free stock

    const total = freeStockProducts.length;
    const response = createPaginatedResponse(
      freeStockProducts,
      total,
      page,
      pageSize
    );

    return NextResponse.json(createSuccessResponse(response));
  } catch (error) {
    console.error('Error fetching free stock:', error);
    return NextResponse.json(
      createErrorResponse('Failed to fetch free stock'),
      { status: 500 }
    );
  }
}
```

### Step 2.5: Update Sales Form
File: `components/sales/CreateSaleForm.tsx` (NEW or UPDATED)

```typescript
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function CreateSaleForm() {
  const [saleType, setSaleType] = useState<'customer' | 'free_stock'>('customer');

  return (
    <div className="w-full max-w-4xl">
      <Tabs value={saleType} onValueChange={(v) => setSaleType(v as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="customer">From Customer Order</TabsTrigger>
          <TabsTrigger value="free_stock">From Free Stock</TabsTrigger>
        </TabsList>

        <TabsContent value="customer">
          {/* Existing customer order sales form */}
        </TabsContent>

        <TabsContent value="free_stock">
          {/* New free stock sales form */}
          <FreeStockSaleForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FreeStockSaleForm() {
  // Implementation for free stock sales
  // - Show available free stock products
  // - Allow selecting products and quantities
  // - Calculate totals
  // - Submit to /api/sales/from-free-stock
}
```

---

## Testing Checklist

### Phase 1: Forecast Orders
- [ ] Create forecast order without client_id
- [ ] Verify order_type = 'forecast'
- [ ] Verify inventory is NOT booked
- [ ] Display forecast order in list with badge
- [ ] Cannot create forecast order with client_id
- [ ] Backward compatibility: existing orders still work

### Phase 2: Free Stock Sales
- [ ] Get free stock products endpoint works
- [ ] Create sale from free stock
- [ ] Verify sale_type = 'free_stock'
- [ ] Verify inventory is deducted
- [ ] Cannot sell more than free stock
- [ ] Sales display shows sale type
- [ ] Backward compatibility: existing sales still work

---

## Rollout Plan

1. **Day 1**: Deploy Phase 1 (forecast orders)
   - Database migration
   - API updates
   - UI updates
   - Testing

2. **Day 2**: Deploy Phase 2 (free stock sales)
   - Database migration
   - API updates
   - UI updates
   - Testing

3. **Day 3**: Monitor and fix issues
   - User feedback
   - Bug fixes
   - Documentation

---

## Rollback Plan

If issues occur:
1. Revert database migrations
2. Revert code changes
3. Restore from backup if needed

All changes are backward compatible, so rollback is safe.
