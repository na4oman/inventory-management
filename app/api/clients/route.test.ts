import { GET, POST } from './route';
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabase } from '@/lib/supabase/client';

// Mock dependencies
jest.mock('@clerk/nextjs/server');
jest.mock('@/lib/supabase/client');

describe('Clients API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/clients', () => {
    it('should return 401 if not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const request = new NextRequest('http://localhost:3000/api/clients');
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return paginated clients for authenticated user', async () => {
      const mockUserId = 'user-123';
      const mockClients = [
        {
          id: 'client-1',
          name: 'John Doe',
          email: 'john@example.com',
          phone: '1234567890',
          address: '123 Main St',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          user_id: mockUserId,
        },
      ];

      (auth as jest.Mock).mockResolvedValue({ userId: mockUserId });
      (supabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            or: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({ data: mockClients, error: null }),
              }),
            }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/clients?page=1&pageSize=10');
      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/clients', () => {
    it('should return 401 if not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue({ userId: null });

      const request = new NextRequest('http://localhost:3000/api/clients', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Client' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should create a client with valid data', async () => {
      const mockUserId = 'user-123';
      const mockClient = {
        id: 'client-1',
        name: 'Test Client',
        email: 'test@example.com',
        phone: null,
        address: null,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        user_id: mockUserId,
      };

      (auth as jest.Mock).mockResolvedValue({ userId: mockUserId });
      (supabase.from as jest.Mock).mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockClient, error: null }),
          }),
        }),
      });

      const request = new NextRequest('http://localhost:3000/api/clients', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Client', email: 'test@example.com' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(201);
    });

    it('should return 400 for invalid data', async () => {
      const mockUserId = 'user-123';

      (auth as jest.Mock).mockResolvedValue({ userId: mockUserId });

      const request = new NextRequest('http://localhost:3000/api/clients', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }), // Missing required name
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});
