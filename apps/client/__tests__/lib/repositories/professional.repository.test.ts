import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProfessionalRepository } from '@/app/lib/repositories/professional.repository';
import { PrismaClient } from '@prisma/client';

// Mock Prisma client
const mockPrisma = {
  professionalProfile: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
} as unknown as PrismaClient;

describe('ProfessionalRepository', () => {
  let repo: ProfessionalRepository;

  beforeEach(() => {
    repo = new ProfessionalRepository(mockPrisma);
    vi.clearAllMocks();
  });

  describe('findMany', () => {
    it('should find professionals with default filters', async () => {
      const mockResults = [
        {
          userId: 'prof-1',
          companyName: 'Test Company',
          verified: true,
        },
      ];

      vi.mocked(mockPrisma.professionalProfile.findMany).mockResolvedValue(
        mockResults as any
      );

      const results = await repo.findMany();

      expect(results).toEqual(mockResults);
      expect(mockPrisma.professionalProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ verified: true }),
        })
      );
    });

    it('should filter by search term', async () => {
      vi.mocked(mockPrisma.professionalProfile.findMany).mockResolvedValue([]);

      await repo.findMany({ search: 'carpenter' });

      expect(mockPrisma.professionalProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                companyName: { contains: 'carpenter', mode: 'insensitive' },
              }),
            ]),
          }),
        })
      );
    });

    it('should filter by category', async () => {
      vi.mocked(mockPrisma.professionalProfile.findMany).mockResolvedValue([]);

      await repo.findMany({ category: 'Plumber' });

      expect(mockPrisma.professionalProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            servicesOffered: { has: 'Plumber' },
          }),
        })
      );
    });

    it('should sort by experience', async () => {
      vi.mocked(mockPrisma.professionalProfile.findMany).mockResolvedValue([]);

      await repo.findMany({ sortBy: 'experience' });

      expect(mockPrisma.professionalProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { yearsExperience: 'desc' },
        })
      );
    });

    it('should sort by reviews count', async () => {
      vi.mocked(mockPrisma.professionalProfile.findMany).mockResolvedValue([]);

      await repo.findMany({ sortBy: 'reviews' });

      expect(mockPrisma.professionalProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { reviews: { _count: 'desc' } },
        })
      );
    });
  });

  describe('findByUserId', () => {
    it('should find a professional by user ID', async () => {
      const mockProfessional = {
        userId: 'prof-1',
        companyName: 'Test Company',
      };

      vi.mocked(mockPrisma.professionalProfile.findUnique).mockResolvedValue(
        mockProfessional as any
      );

      const result = await repo.findByUserId('prof-1');

      expect(result).toEqual(mockProfessional);
      expect(mockPrisma.professionalProfile.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'prof-1' },
        })
      );
    });

    it('should return null if professional not found', async () => {
      vi.mocked(mockPrisma.professionalProfile.findUnique).mockResolvedValue(null);

      const result = await repo.findByUserId('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('upsert', () => {
    it('should create or update a professional profile', async () => {
      const mockData = {
        companyName: 'New Company',
        servicesOffered: ['Service1'],
      };

      const mockResult = {
        userId: 'prof-1',
        ...mockData,
      };

      vi.mocked(mockPrisma.professionalProfile.upsert).mockResolvedValue(
        mockResult as any
      );

      const result = await repo.upsert('prof-1', mockData);

      expect(result).toEqual(mockResult);
      expect(mockPrisma.professionalProfile.upsert).toHaveBeenCalledWith({
        where: { userId: 'prof-1' },
        update: mockData,
        create: { userId: 'prof-1', ...mockData },
      });
    });
  });
});

