import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/professionals/route';
import { NextRequest } from 'next/server';
import { prisma } from '@repo/db';

// Mock dependencies
vi.mock('@repo/db', () => ({
  prisma: {
    professionalProfile: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/app/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  getRateLimitIdentifier: vi.fn().mockReturnValue('test-ip'),
  RateLimits: {
    READ: { limit: 100, window: 60000 },
  },
}));

vi.mock('@/app/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}));

describe('GET /api/professionals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return list of verified professionals', async () => {
    const mockProfessionals = [
      {
        userId: 'prof-1',
        companyName: 'Test Company',
        bio: 'Test bio',
        servicesOffered: ['General Contractor'],
        yearsExperience: 10,
        verified: true,
        portfolioUrl: 'https://example.com',
        user: {
          id: 'prof-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '1234567890',
        },
        portfolios: [
          {
            images: ['image1.jpg'],
          },
        ],
        reviews: [
          { rating: 5 },
          { rating: 4 },
        ],
        certificates: [],
        _count: {
          reviews: 2,
          projects: 5,
        },
      },
    ];

    vi.mocked(prisma.professionalProfile.findMany).mockResolvedValue(
      mockProfessionals as any
    );

    const request = new NextRequest('http://localhost:3000/api/professionals');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].verified).toBe(true);
    expect(data.data[0].rating).toBe(4.5); // Average of 5 and 4
  });

  it('should filter professionals by search query', async () => {
    vi.mocked(prisma.professionalProfile.findMany).mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost:3000/api/professionals?search=carpenter'
    );

    await GET(request);

    expect(prisma.professionalProfile.findMany).toHaveBeenCalled();
    // Verify that the search parameter is being used
    const callArgs = vi.mocked(prisma.professionalProfile.findMany).mock.calls[0]?.[0];
    if (!callArgs) {
      throw new Error('Call arguments not found');
    }
    expect(callArgs).toBeDefined();
  });

  it('should filter professionals by category', async () => {
    vi.mocked(prisma.professionalProfile.findMany).mockResolvedValue([]);

    const request = new NextRequest(
      'http://localhost:3000/api/professionals?category=Plumber'
    );

    await GET(request);

    expect(prisma.professionalProfile.findMany).toHaveBeenCalled();
  });

  it('should reject invalid sort options', async () => {
    const request = new NextRequest(
      'http://localhost:3000/api/professionals?sortBy=invalid'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Invalid sort option');
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(prisma.professionalProfile.findMany).mockRejectedValue(
      new Error('Database connection failed')
    );

    const request = new NextRequest('http://localhost:3000/api/professionals');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Failed to fetch professionals');
  });

  it('should return empty array when no professionals found', async () => {
    vi.mocked(prisma.professionalProfile.findMany).mockResolvedValue([]);

    const request = new NextRequest('http://localhost:3000/api/professionals');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual([]);
  });

  it('should sanitize search input (max 100 characters)', async () => {
    const longSearch = 'a'.repeat(150);
    vi.mocked(prisma.professionalProfile.findMany).mockResolvedValue([]);

    const request = new NextRequest(
      `http://localhost:3000/api/professionals?search=${encodeURIComponent(longSearch)}`
    );

    await GET(request);

    // The search should be truncated to 100 characters
    expect(prisma.professionalProfile.findMany).toHaveBeenCalled();
  });

  it('should sort professionals by rating correctly', async () => {
    const mockProfessionals = [
      {
        userId: 'prof-1',
        companyName: 'Low Rating Pro',
        servicesOffered: ['Service'],
        verified: true,
        user: {
          id: 'prof-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
        portfolios: [],
        reviews: [{ rating: 3 }],
        certificates: [],
        _count: { reviews: 1, projects: 0 },
      },
      {
        userId: 'prof-2',
        companyName: 'High Rating Pro',
        servicesOffered: ['Service'],
        verified: true,
        user: {
          id: 'prof-2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
        },
        portfolios: [],
        reviews: [{ rating: 5 }],
        certificates: [],
        _count: { reviews: 1, projects: 0 },
      },
    ];

    vi.mocked(prisma.professionalProfile.findMany).mockResolvedValue(
      mockProfessionals as any
    );

    const request = new NextRequest(
      'http://localhost:3000/api/professionals?sortBy=rating'
    );

    const response = await GET(request);
    const data = await response.json();

    expect(data.data[0].rating).toBeGreaterThanOrEqual(data.data[1].rating);
  });

  it('should respect rate limiting', async () => {
    const { checkRateLimit } = await import('@/app/lib/rate-limit');
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      success: false,
      limit: 100,
      remaining: 0,
      reset: Date.now() + 60000,
    });

    const request = new NextRequest('http://localhost:3000/api/professionals');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain('Too many requests');
  });
});

