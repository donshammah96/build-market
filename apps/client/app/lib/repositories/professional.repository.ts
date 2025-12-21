import { PrismaClient } from '@prisma/client';

export interface ProfessionalFilters {
  search?: string;
  category?: string;
  /** Array of profession values to filter by (used when category is converted to professions) */
  professions?: string[];
  sortBy?: 'rating' | 'experience' | 'reviews';
  verified?: boolean;
  /** Include unverified professionals (for dev/admin testing) */
  includeUnverified?: boolean;
}

export class ProfessionalRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find professionals with filters and includes
   */
  async findMany(filters: ProfessionalFilters = {}) {
    const { 
      search = '', 
      category = 'All', 
      professions = [],
      sortBy = 'rating', 
      verified = true,
      includeUnverified = false,
    } = filters;

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};
    
    // Verification filter (unless includeUnverified is true for dev/admin testing)
    if (!includeUnverified) {
      where.verified = verified;
    }

    // Search filter
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { bio: { contains: search, mode: 'insensitive' } },
        { servicesOffered: { hasSome: [search] } },
        {
          user: {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    // Profession filter - uses hasSome for matching any profession in the array
    if (professions.length > 0) {
      where.servicesOffered = { hasSome: professions };
    } else if (category !== 'All' && category !== 'all') {
      // Fallback to legacy category filter for backwards compatibility
      where.servicesOffered = { has: category };
    }

    // Build orderBy clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let orderBy: any = {};
    switch (sortBy) {
      case 'experience':
        orderBy = { yearsExperience: 'desc' };
        break;
      case 'reviews':
        orderBy = { reviews: { _count: 'desc' } };
        break;
      case 'rating':
      default:
        orderBy = { createdAt: 'desc' };
    }

    return this.prisma.professionalProfile.findMany({
      where,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        portfolios: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            images: true,
          },
        },
        reviews: {
          where: { approved: true },
          select: {
            rating: true,
          },
        },
        certificates: {
          select: {
            id: true,
            name: true,
            issuer: true,
            issueDate: true,
            expiryDate: true,
            verificationStatus: true,
            verifiedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            reviews: true,
            projects: true,
          },
        },
      },
    });
  }

  /**
   * Find a single professional by user ID
   */
  async findByUserId(userId: string) {
    return this.prisma.professionalProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        portfolios: {
          orderBy: { createdAt: 'desc' },
        },
        reviews: {
          where: { approved: true },
          include: {
            reviewer: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        certificates: {
          select: {
            id: true,
            name: true,
            issuer: true,
            issueDate: true,
            expiryDate: true,
            verificationStatus: true,
            verifiedAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            reviews: true,
            projects: true,
          },
        },
      },
    });
  }

  /**
   * Create or update professional profile
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async upsert(userId: string, data: any) {
    return this.prisma.professionalProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }
}

