import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/onboarding/skip/route';
import { NextRequest } from 'next/server';
import { prisma } from '@repo/db';

// Mock dependencies
vi.mock('@repo/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    user: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    clientProfile: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'clerk_123' }),
}));

vi.mock('@/app/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue('test-ip'),
  RateLimits: {
    AUTH: { limit: 5, window: 60000 },
  },
}));

vi.mock('@/app/lib/api-middleware', () => ({
  withAuth: (handler: any) => {
    return async (req: NextRequest) => {
      const context = {
        clerkId: 'clerk_123',
        dbUserId: 'db_user_123',
        userEmail: 'test@example.com',
      };
      return handler(req, context);
    };
  },
}));

describe('POST /api/onboarding/skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow homeowner to skip onboarding', async () => {
    const mockUser = {
      id: 'db_user_123',
      role: 'client',
      isProfileComplete: false,
      clientProfile: null,
      professionalProfile: null,
    };

    const mockUpdatedUser = {
      id: 'db_user_123',
      role: 'client',
      isProfileComplete: false,
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return callback({
        user: {
          findUnique: vi.fn().mockResolvedValue(mockUser),
          update: vi.fn().mockResolvedValue(mockUpdatedUser),
        },
        clientProfile: {
          upsert: vi.fn().mockResolvedValue({}),
        },
      });
    });

    const request = new NextRequest('http://localhost:3500/api/onboarding/skip', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.role).toBe('client');
    expect(data.data.isProfileComplete).toBe(false);
    expect(data.data.skipped).toBe(true);
    expect(data.data.redirectTo).toBe('/dashboard');
  });

  it('should reject skip for professionals', async () => {
    const mockUser = {
      id: 'db_user_123',
      role: 'client',
      isProfileComplete: false,
      clientProfile: null,
      professionalProfile: { userId: 'db_user_123' }, // Has professional profile
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return callback({
        user: {
          findUnique: vi.fn().mockResolvedValue(mockUser),
        },
      });
    });

    const request = new NextRequest('http://localhost:3500/api/onboarding/skip', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });

  it('should reject if user already completed onboarding', async () => {
    const mockUser = {
      id: 'db_user_123',
      role: 'client',
      isProfileComplete: true, // Already complete
      clientProfile: { userId: 'db_user_123' },
      professionalProfile: null,
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return callback({
        user: {
          findUnique: vi.fn().mockResolvedValue(mockUser),
        },
      });
    });

    const request = new NextRequest('http://localhost:3500/api/onboarding/skip', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
  });

  it('should respect rate limiting', async () => {
    const { checkRateLimit } = await import('@/app/lib/rate-limit');
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const request = new NextRequest('http://localhost:3500/api/onboarding/skip', {
      method: 'POST',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain('Too many requests');
  });
});
