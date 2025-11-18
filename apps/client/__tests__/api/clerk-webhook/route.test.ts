import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/clerk-webhook/route';
import { NextRequest } from 'next/server';
import { prisma } from '@repo/db';

// Mock dependencies
vi.mock('@repo/db', () => ({
  prisma: {
    $connect: vi.fn().mockResolvedValue(undefined),
    user: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: vi.fn().mockReturnValue({
      type: 'user.created',
      data: {
        id: 'clerk_123',
        email_addresses: [{ email_address: 'test@example.com' }],
        first_name: 'John',
        last_name: 'Doe',
        phone_numbers: [{ phone_number: '1234567890' }],
      },
    }),
  })),
}));

vi.mock('@/app/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue('webhook-ip'),
  RateLimits: {
    WEBHOOK: { limit: 100, window: 60000 },
  },
}));

vi.mock('@/app/lib/env', () => ({
  env: {
    CLERK_WEBHOOK_SECRET: 'test_webhook_secret',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}));

describe('POST /api/clerk-webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle user.created event successfully', async () => {
    const mockUser = {
      id: 'db_user_123',
      clerkId: 'clerk_123',
      email: 'test@example.com',
    };

    vi.mocked(prisma.user.upsert).mockResolvedValue(mockUser as any);

    const request = new NextRequest('http://localhost:3000/api/clerk-webhook', {
      method: 'POST',
      body: JSON.stringify({
        type: 'user.created',
        data: {
          id: 'clerk_123',
          email_addresses: [{ email_address: 'test@example.com' }],
        },
      }),
      headers: {
        'svix-id': 'test-id',
        'svix-timestamp': Date.now().toString(),
        'svix-signature': 'test-signature',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(prisma.user.upsert).toHaveBeenCalled();
  });

  it('should handle user.updated event successfully', async () => {
    const { Webhook } = await import('svix');
    const mockWebhookInstance = vi.mocked(Webhook).mock.results[0]?.value;
    if (!mockWebhookInstance) {
      throw new Error('Webhook mock not initialized');
    }
    vi.mocked(mockWebhookInstance.verify).mockReturnValue({
      type: 'user.updated',
      data: {
        id: 'clerk_123',
        email_addresses: [{ email_address: 'updated@example.com' }],
      },
    } as any);

    const mockUser = {
      id: 'db_user_123',
      email: 'updated@example.com',
    };

    vi.mocked(prisma.user.update).mockResolvedValue(mockUser as any);

    const request = new NextRequest('http://localhost:3000/api/clerk-webhook', {
      method: 'POST',
      body: JSON.stringify({
        type: 'user.updated',
        data: {
          id: 'clerk_123',
          email_addresses: [{ email_address: 'updated@example.com' }],
        },
      }),
      headers: {
        'svix-id': 'test-id',
        'svix-timestamp': Date.now().toString(),
        'svix-signature': 'test-signature',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should reject webhook with invalid signature', async () => {
    const { Webhook } = await import('svix');
    const mockWebhookInstance = vi.mocked(Webhook).mock.results[0]?.value;
    if (!mockWebhookInstance) {
      throw new Error('Webhook mock not initialized');
    }
    vi.mocked(mockWebhookInstance.verify).mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const request = new NextRequest('http://localhost:3000/api/clerk-webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'user.created', data: {} }),
      headers: {
        'svix-id': 'test-id',
        'svix-timestamp': Date.now().toString(),
        'svix-signature': 'invalid-signature',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid webhook signature');
  });

  it('should handle missing required data in webhook payload', async () => {
    const { Webhook } = await import('svix');
    const mockWebhookInstance = vi.mocked(Webhook).mock.results[0]?.value;
    if (!mockWebhookInstance) {
      throw new Error('Webhook mock not initialized');
    }
    vi.mocked(mockWebhookInstance.verify).mockReturnValue({
      type: 'user.created',
      data: {
        id: null, // Missing required ID
      },
    } as any);

    const request = new NextRequest('http://localhost:3000/api/clerk-webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'user.created', data: {} }),
      headers: {
        'svix-id': 'test-id',
        'svix-timestamp': Date.now().toString(),
        'svix-signature': 'test-signature',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Missing required user data');
  });

  it('should handle database connection failures', async () => {
    vi.mocked(prisma.$connect).mockRejectedValue(
      new Error('Database connection failed')
    );

    const request = new NextRequest('http://localhost:3000/api/clerk-webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'user.created', data: {} }),
      headers: {
        'svix-id': 'test-id',
        'svix-timestamp': Date.now().toString(),
        'svix-signature': 'test-signature',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.error).toContain('Database connection failed');
  });

  it('should handle duplicate user creation (unique constraint)', async () => {
    const { Webhook } = await import('svix');
    const mockWebhookInstance = vi.mocked(Webhook).mock.results[0]?.value;
    if (!mockWebhookInstance) {
      throw new Error('Webhook mock not initialized');
    }
    vi.mocked(mockWebhookInstance.verify).mockReturnValue({
      type: 'user.created',
      data: {
        id: 'clerk_123',
        email_addresses: [{ email_address: 'test@example.com' }],
      },
    } as any);

    const prismaError = new Error('Unique constraint failed');
    (prismaError as any).code = 'P2002';

    vi.mocked(prisma.user.upsert).mockRejectedValue(prismaError);

    const request = new NextRequest('http://localhost:3000/api/clerk-webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'user.created', data: {} }),
      headers: {
        'svix-id': 'test-id',
        'svix-timestamp': Date.now().toString(),
        'svix-signature': 'test-signature',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain('User already exists');
  });

  it('should acknowledge unhandled event types', async () => {
    const { Webhook } = await import('svix');
    const mockResult = vi.mocked(Webhook).mock.results[0];
    if (!mockResult?.value) {
      throw new Error('Webhook mock not initialized');
    }
    const mockWebhookInstance = mockResult.value;
    vi.mocked(mockWebhookInstance.verify).mockReturnValue({
      type: 'user.something_else',
      data: {},
    } as any);

    const request = new NextRequest('http://localhost:3000/api/clerk-webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'user.something_else', data: {} }),
      headers: {
        'svix-id': 'test-id',
        'svix-timestamp': Date.now().toString(),
        'svix-signature': 'test-signature',
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.message).toContain('acknowledged');
  });
});

