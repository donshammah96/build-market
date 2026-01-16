import { PrismaClient, Prisma } from "@prisma/client";

export interface ProfessionalFilters {
  search?: string;
  category?: string;
  /** Array of profession values to filter by (used when category is converted to professions) */
  professions?: string[];
  /** Filter by specific profession enum value */
  profession?: string;
  /** Filter by county */
  county?: string;
  /** Filter by city */
  city?: string;
  sortBy?: "rating" | "experience" | "reviews";
  verified?: boolean;
  /** Include unverified professionals (for dev/admin testing) */
  includeUnverified?: boolean;
  limit?: number;
  offset?: number;
}

export class ProfessionalRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find professionals with filters and includes
   */
  async findMany(filters: ProfessionalFilters = {}) {
    const {
      search = "",
      category = "All",
      professions = [],
      profession,
      county,
      city,
      sortBy = "rating",
      verified = true,
      includeUnverified = false,
      limit = 50,
      offset = 0,
    } = filters;

    // Build where clause
    const where: Prisma.ProfessionalProfileWhereInput = {};

    // Verification filter (unless includeUnverified is true for dev/admin testing)
    if (!includeUnverified) {
      where.verified = verified;
    }

    // Location filters
    if (county) {
      where.county = county;
    }
    if (city) {
      where.city = { contains: city, mode: "insensitive" };
    }

    // Profession enum filter
    if (profession) {
      where.profession = profession as Prisma.EnumProfessionFilter;
    }

    // Search filter
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { bio: { contains: search, mode: "insensitive" } },
        {
          user: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          },
        },
        // Search in services relation
        {
          services: {
            some: {
              name: { contains: search, mode: "insensitive" },
            },
          },
        },
      ];
    }

    // Profession filter - filter by services that match professions
    if (professions.length > 0) {
      where.services = {
        some: {
          OR: professions.map((p) => ({
            name: { contains: p, mode: "insensitive" as const },
          })),
        },
      };
    } else if (category !== "All" && category !== "all") {
      // Fallback to legacy category filter for backwards compatibility
      where.services = {
        some: {
          name: { contains: category, mode: "insensitive" },
        },
      };
    }

    // Build orderBy clause
    let orderBy: Prisma.ProfessionalProfileOrderByWithRelationInput = {};
    switch (sortBy) {
      case "experience":
        orderBy = { yearsExperience: "desc" };
        break;
      case "reviews":
        orderBy = { reviews: { _count: "desc" } };
        break;
      case "rating":
      default:
        orderBy = { createdAt: "desc" };
    }

    const [professionals, total] = await Promise.all([
      this.prisma.professionalProfile.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatar: true,
            },
          },
          // Services offered (many-to-many with ServiceCategory)
          services: {
            select: {
              id: true,
              name: true,
              slug: true,
              icon: true,
            },
          },
          // Professional images
          images: {
            orderBy: { sortOrder: "asc" },
            take: 3,
            select: {
              id: true,
              url: true,
              caption: true,
              isMain: true,
            },
          },
          portfolios: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
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
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: {
              reviews: true,
              projects: true,
              stores: true,
              properties: true,
            },
          },
        },
      }),
      this.prisma.professionalProfile.count({ where }),
    ]);

    return {
      professionals,
      total,
      limit,
      offset,
      hasMore: offset + professionals.length < total,
    };
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
            avatar: true,
          },
        },
        // Services offered (many-to-many with ServiceCategory)
        services: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            icon: true,
          },
        },
        // Professional images
        images: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            url: true,
            key: true,
            caption: true,
            isMain: true,
            sortOrder: true,
          },
        },
        // Verification documents
        documents: {
          select: {
            id: true,
            type: true,
            fileUrl: true,
            isVerified: true,
            verifiedAt: true,
            notes: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
        portfolios: {
          orderBy: { createdAt: "desc" },
          include: {
            images: true,
          },
        },
        reviews: {
          where: { approved: true },
          include: {
            reviewer: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
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
          orderBy: { createdAt: "desc" },
        },
        // Count related entities
        _count: {
          select: {
            reviews: true,
            projects: true,
            stores: true,
            properties: true,
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
