import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock supabase server before importing route
vi.mock('@/lib/supabase/server', () => ({
  supabaseServer: {
    from: vi.fn(),
  },
}));

import { GET, POST } from './route';
import { supabaseServer as supabase } from '@/lib/supabase/server';

describe('Clients API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/clients', () => {
    it('should return paginated clients', async () => {
      const mockClients = [
        {
          id: 'client-1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '1234567890',
          address: '123 Main St',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          user_id: 'user-123',
        },
      ];

      // Mock count query
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockResolvedValue({ count: 1, error: null }),
      } as any);

      // Mock data query
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({ data: mockClients, error: null }),
          }),
        }),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/clients?page=1&pageSize=10');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockResolvedValue({ count: null, error: { message: 'DB error' } }),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/clients');
      const response = await GET(request);

      expect(response.status).toBe(500);
    });
  });

  describe('POST /api/clients', () => {
    it('should create a client with valid data', async () => {
      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
        email: 'test@example.com',
        phone: null,
        address: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        user_id: 'user-123',
      };

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockClient, error: null }),
          }),
        }),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/clients', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Client', email: 'test@example.com' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('should return 400 for missing required name', async () => {
      const request = new NextRequest('http://localhost:3000/api/clients', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});
