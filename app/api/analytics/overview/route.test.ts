import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock supabase server before importing route
vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: {
    from: vi.fn(),
  },
}));

import { GET } from './route';
import { supabaseServer as supabase } from '@/lib/supabase/server';

describe('Analytics Overview API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/analytics/overview', () => {
    it('should return inventory overview for authenticated user', async () => {
      const mockProducts = [
        { qty: 100, booked_qty: 20, cost_price: 50 },
        { qty: 50, booked_qty: 10, cost_price: 75 },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: mockProducts, error: null }),
      } as any);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.total_qty).toBe(150);
      expect(data.data.booked_qty).toBe(30);
      expect(data.data.total_products).toBe(2);
    });

    it('should return zero values when no products exist', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.total_qty).toBe(0);
      expect(data.data.total_products).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
      } as any);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });
});
