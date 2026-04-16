import { GET } from './route';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase/client';

// Mock dependencies
jest.mock('@clerk/nextjs/server');
jest.mock('@/lib/supabase/client');

describe('Analytics Summary API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analytics/summary', () => {
    it('should return 401 if not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const request = new NextRequest('http://localhost:3000/api/analytics/summary');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return analytics summary for authenticated user', async () => {
      const mockUserId = 'user-123';
      const mockSales = [
        {
          id: 'sale-1',
          total_amount: 1000,
          profit: 300,
          sale_date: '2024-01-15T10:00:00Z',
          sale_items: [
            {
              quantity: 5,
              unit_price: 200,
              profit: 300,
              product: {
                id: 'prod-1',
                part_number: 'PN001',
                model: 'Model A',
                cost_price: 140,
              },
            },
          ],
        },
        {
          id: 'sale-2',
          total_amount: 500,
          profit: 100,
          sale_date: '2024-01-16T10:00:00Z',
          sale_items: [
            {
              quantity: 2,
              unit_price: 250,
              profit: 100,
              product: {
                id: 'prod-1',
                part_number: 'PN001',
                model: 'Model A',
                cost_price: 200,
              },
            },
          ],
        },
      ];

      (auth as jest.Mock).mockResolvedValue({ userId: mockUserId });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({ data: mockSales, error: null }),
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/summary');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.total_revenue).toBe(1500);
      expect(data.data.total_profit).toBe(400);
      expect(data.data.total_sales).toBe(2);
      expect(data.data.profit_margin).toBeCloseTo(26.67, 1);
      expect(data.data.top_selling_products.length).toBe(1);
      expect(data.data.top_selling_products[0].total_quantity_sold).toBe(7);
      expect(data.data.sales_by_period.length).toBe(2);
    });

    it('should return empty summary when no sales exist', async () => {
      const mockUserId = 'user-123';

      (auth as jest.Mock).mockResolvedValue({ userId: mockUserId });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

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

    it('should filter sales by date range', async () => {
      const mockUserId = 'user-123';
      const mockSales = [
        {
          id: 'sale-1',
          total_amount: 1000,
          profit: 300,
          sale_date: '2024-01-15T10:00:00Z',
          sale_items: [],
        },
      ];

      (auth as jest.Mock).mockResolvedValue({ userId: mockUserId });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({ data: mockSales, error: null }),
            }),
          }),
        }),
      });

      const request = new NextRequest(
        'http://localhost:3000/api/analytics/summary?startDate=2024-01-01&endDate=2024-01-31'
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should handle database errors gracefully', async () => {
      const mockUserId = 'user-123';

      (auth as jest.Mock).mockResolvedValue({ userId: mockUserId });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/summary');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });

    it('should calculate profit margin correctly', async () => {
      const mockUserId = 'user-123';
      const mockSales = [
        {
          id: 'sale-1',
          total_amount: 1000,
          profit: 250,
          sale_date: '2024-01-15T10:00:00Z',
          sale_items: [],
        },
      ];

      (auth as jest.Mock).mockResolvedValue({ userId: mockUserId });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({ data: mockSales, error: null }),
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/summary');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.profit_margin).toBe(25); // (250 / 1000) * 100
    });

    it('should limit top selling products to 10', async () => {
      const mockUserId = 'user-123';
      const mockSales = [
        {
          id: 'sale-1',
          total_amount: 5000,
          profit: 1000,
          sale_date: '2024-01-15T10:00:00Z',
          sale_items: Array.from({ length: 15 }, (_, i) => ({
            quantity: 10,
            unit_price: 100,
            profit: 100,
            product: {
              id: `prod-${i}`,
              part_number: `PN${i}`,
              model: `Model ${i}`,
              cost_price: 90,
            },
          })),
        },
      ];

      (auth as jest.Mock).mockResolvedValue({ userId: mockUserId });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({ data: mockSales, error: null }),
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/analytics/summary');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.top_selling_products.length).toBe(10);
    });
  });
});
