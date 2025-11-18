import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/onboarding/route';
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
    professionalProfile: {
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

describe('POST /api/onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete client onboarding successfully', async () => {
    const mockUser = {
      id: 'db_user_123',
      role: 'client',
      isProfileComplete: true,
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return callback({
        user: {
          update: vi.fn().mockResolvedValue(mockUser),
        },
        clientProfile: {
          upsert: vi.fn().mockResolvedValue({}),
        },
      });
    });

    const requestBody = {
      role: 'client',
      firstName: 'John',
      lastName: 'Doe',
      phone: '1234567890',
      address: '123 Main St',
    };

    const request = new NextRequest('http://localhost:3000/api/onboarding', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.role).toBe('client');
    expect(data.data.isProfileComplete).toBe(true);
  });

  it('should complete professional onboarding successfully', async () => {
    const mockUser = {
      id: 'db_user_123',
      role: 'professional',
      isProfileComplete: true,
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return callback({
        user: {
          update: vi.fn().mockResolvedValue(mockUser),
        },
        professionalProfile: {
          upsert: vi.fn().mockResolvedValue({}),
        },
      });
    });

    const requestBody = {
      role: 'professional',
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '1234567890',
      companyName: 'Test Company',
      servicesOffered: ['General Contractor'],
    };

    const request = new NextRequest('http://localhost:3000/api/onboarding', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.role).toBe('professional');
  });

  it('should reject invalid role', async () => {
    const request = new NextRequest('http://localhost:3000/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        role: 'invalid_role',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Validation failed');
  });

  it('should handle validation errors for missing required fields', async () => {
    const request = new NextRequest('http://localhost:3000/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        role: 'professional',
        // Missing required fields like companyName, servicesOffered
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should use upsert to prevent duplicate profile creation', async () => {
    const mockUser = {
      id: 'db_user_123',
      role: 'client',
      isProfileComplete: true,
    };

    const mockUpsert = vi.fn().mockResolvedValue({});

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return callback({
        user: {
          update: vi.fn().mockResolvedValue(mockUser),
        },
        clientProfile: {
          upsert: mockUpsert,
        },
      });
    });

    const requestBody = {
      role: 'client',
      firstName: 'John',
      lastName: 'Doe',
      phone: '1234567890',
    };

    const request = new NextRequest('http://localhost:3000/api/onboarding', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    await POST(request);

    // Call again to test upsert behavior
    const request2 = new NextRequest('http://localhost:3000/api/onboarding', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });

    const response2 = await POST(request2);

    expect(response2.status).toBe(200);
    expect(mockUpsert).toHaveBeenCalled();
  });

  it('should handle database transaction errors', async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Error('Transaction failed')
    );

    const request = new NextRequest('http://localhost:3000/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        role: 'client',
        firstName: 'John',
      }),
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

    const request = new NextRequest('http://localhost:3000/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({ role: 'client' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain('Too many requests');
  });
});

