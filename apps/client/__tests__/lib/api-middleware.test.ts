import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withAuth, withRole } from '@/app/lib/api-middleware';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/db';

// Mock dependencies
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@repo/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

describe('API Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('withAuth', () => {
    it('should call handler with auth context when authenticated', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_123' } as any);

      const mockUser = {
        id: 'db_user_123',
        email: 'test@example.com',
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any);

      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const wrappedHandler = withAuth(mockHandler);
      const request = new NextRequest('http://localhost:3000/test');

      await wrappedHandler(request);

      expect(mockHandler).toHaveBeenCalledWith(
        request,
        expect.objectContaining({
          clerkId: 'clerk_123',
          dbUserId: 'db_user_123',
          userEmail: 'test@example.com',
        }),
        undefined
      );
    });

    it('should return 401 when not authenticated', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const mockHandler = vi.fn();
      const wrappedHandler = withAuth(mockHandler);
      const request = new NextRequest('http://localhost:3000/test');

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Unauthorized');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should return 404 when user not found in database', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_123' } as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const mockHandler = vi.fn();
      const wrappedHandler = withAuth(mockHandler);
      const request = new NextRequest('http://localhost:3000/test');

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('User not found');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should handle authentication errors gracefully', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockRejectedValue(new Error('Auth service down'));

      const mockHandler = vi.fn();
      const wrappedHandler = withAuth(mockHandler);
      const request = new NextRequest('http://localhost:3000/test');

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Authentication failed');
    });
  });

  describe('withRole', () => {
    it('should allow access when user has required role', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_123' } as any);

      const mockUser = {
        id: 'db_user_123',
        email: 'test@example.com',
        role: 'professional',
      };

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser as any) // First call for withAuth
        .mockResolvedValueOnce(mockUser as any); // Second call for withRole

      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      );

      const wrappedHandler = withRole(['professional'])(mockHandler);
      const request = new NextRequest('http://localhost:3000/test');

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockHandler).toHaveBeenCalled();
    });

    it('should deny access when user lacks required role', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockResolvedValue({ userId: 'clerk_123' } as any);

      const mockUser = {
        id: 'db_user_123',
        email: 'test@example.com',
        role: 'client',
      };

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce(mockUser as any);

      const mockHandler = vi.fn();
      const wrappedHandler = withRole(['professional'])(mockHandler);
      const request = new NextRequest('http://localhost:3000/test');

      const response = await wrappedHandler(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Forbidden');
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });
});

