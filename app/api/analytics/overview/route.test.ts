import { GET } from './route';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase/client';

// Mock dependencies
jest.mock('@clerk/nextjs/server');
jest.mock('@/lib/supabase/client');

describe('Analytics Overview API Route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analytics/overview', () => {
    it('should return 401 if not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const request = new NextRequest('http://localhost:3000/api/analytics/overview');
      const response = await GET();

      expect(response.status).toBe(401);
    });

    it('should return inventory overview for authenticated user', async () => {
      const mockUserId = 'user-123';
      const mockProducts = [
        {
          qty: 100,
          booked_qty: 20,
          cost_price: 50,
        },
        {
          qty: 50,
          booked_qty: 10,
          cost_price: 75,
        },
      ];

      (auth as jest.Mock).mockResolvedValue({ userId: mockUserId });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: mockProducts, error: null }),
        }),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        total_qty: 150,
        booked_qty: 30,
        available_qty: 120,
        total_value: 8750, // (100 * 50) + (50 * 75)
        total_products: 2,
      });
    });

    it('should return zero values when no products exist', async () => {
      const mockUserId = 'user-123';

      (auth as jest.Mock).mockResolvedValue({ userId: mockUserId });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual({
        total_qty: 0,
        booked_qty: 0,
        available_qty: 0,
        total_value: 0,
        total_products: 0,
      });
    });

    it('should handle database errors gracefully', async () => {
      const mockUserId = 'user-123';

      (auth as jest.Mock).mockResolvedValue({ userId: mockUserId });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
        }),
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });
});
