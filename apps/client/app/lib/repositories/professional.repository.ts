import { PrismaClient } from '@prisma/client';

export interface ProfessionalFilters {
  search?: string;
  category?: string;
  sortBy?: 'rating' | 'experience' | 'reviews';
  verified?: boolean;
}

export class ProfessionalRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find professionals with filters and includes
   */
  async findMany(filters: ProfessionalFilters = {}) {
    const { search = '', category = 'All', sortBy = 'rating', verified = true } = filters;

    // Build where clause
    const where: any = {
      verified,
    };

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

    // Category filter
    if (category !== 'All') {
      where.servicesOffered = { has: category };
    }

    // Build orderBy clause
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
  async upsert(userId: string, data: any) {
    return this.prisma.professionalProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }
}

