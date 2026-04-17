import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock supabase server before importing route
vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: {
    from: vi.fn(),
  },
}));

import { GET } from './route';
import { supabaseServer as supabase } from '@/lib/supabase/server';

const makeSalesQuery = (data: any[], error: any = null) =>
  ({
    select: vi.fn().mockReturnValue({
      gte: vi.fn().mockReturnValue({
        lte: vi.fn().mockResolvedValue({ data, error }),
      }),
      lte: vi.fn().mockResolvedValue({ data, error }),
      // no date filters path
      then: undefined,
    }),
  } as any);

describe('Analytics Summary API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/analytics/summary', () => {
    it('should return empty summary when no sales exist', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          lte: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/analytics/summary');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        total_revenue: 0,
        total_profit: 0,
        total_sales: 0,
        profit_margin: 0,
        top_selling_products: [],
        sales_by_period: [],
      });
    });

    it('should handle database errors gracefully', async () => {
      // No date params → query resolves directly from select
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/analytics/summary');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('should return analytics summary with correct totals', async () => {
      const mockSales = [
        {
          id: 'sale-1',
          total_amount: 1000,
          total_cost: 700,
          profit: 300,
          sale_date: '2024-01-15T10:00:00Z',
          sale_items: [
            {
              quantity: 5,
              unit_price: 200,
              cost_total: 700,
              profit: 300,
              product: { id: 'prod-1', part_number: 'PN001', model: 'Model A', cost_price: 140 },
            },
          ],
        },
        {
          id: 'sale-2',
          total_amount: 500,
          total_cost: 400,
          profit: 100,
          sale_date: '2024-01-16T10:00:00Z',
          sale_items: [
            {
              quantity: 2,
              unit_price: 250,
              cost_total: 400,
              profit: 100,
              product: { id: 'prod-1', part_number: 'PN001', model: 'Model A', cost_price: 200 },
            },
          ],
        },
      ];

      // No date params → query resolves directly from select
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockSales, error: null }),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/analytics/summary');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.total_revenue).toBe(1500);
      expect(data.data.total_profit).toBe(400);
      expect(data.data.total_sales).toBe(2);
      expect(data.data.top_selling_products.length).toBe(1);
      expect(data.data.top_selling_products[0].total_quantity_sold).toBe(7);
      expect(data.data.sales_by_period.length).toBe(2);
    });

    it('should limit top selling products to 10', async () => {
      const mockSales = [
        {
          id: 'sale-1',
          total_amount: 5000,
          total_cost: 4000,
          profit: 1000,
          sale_date: '2024-01-15T10:00:00Z',
          sale_items: Array.from({ length: 15 }, (_, i) => ({
            quantity: 10,
            unit_price: 100,
            cost_total: 90,
            profit: 10,
            product: { id: `prod-${i}`, part_number: `PN${i}`, model: `Model ${i}`, cost_price: 90 },
          })),
        },
      ];

      // No date params → query resolves directly from select
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockSales, error: null }),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/analytics/summary');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.top_selling_products.length).toBe(10);
    });
  });
});
