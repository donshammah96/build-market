import { PrismaClient, Prisma, County, Profession } from "@prisma/client";
import { prisma } from "@build/db";
import {
  REGULATORY_AUTHORITIES,
  type RegulatoryAuthority,
  DOCUMENT_BADGE_MAP,
  hasValidLicense,
  AUTHORITY_BADGE_MAP,
  type ProfessionalBadges,
} from "@build/types";

// ============================================================================
// DTOs (Data Transfer Objects) - Type-safe return types
// ============================================================================

export interface ProfessionalCardDTO {
  id: string;
  companyName: string | null;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
  };
  rating: number | null;
  reviewCount: number;
  verified: boolean;
  city: string | null;
  county: County | null;
  avatar: string | null;
  skills: string[];
  authorities: string[];
  documents: string[];
}

export interface ServiceDTO {
  id: string;
  name: string;
  slug: string;
  price: number | null;
  unit: string | null;
  isPrimary: boolean;
  yearsExperience: number | null;
}

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
}


export interface ProfessionalDetailDTO {
  userId: string;
  companyName: string | null;
  bio: string | null;
  rating: number | null;
  reviewCount: number;
  verified: boolean;
  yearsExperience: number | null;
  city: string | null;
  county: County | null;
  isInsured: boolean;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    avatar: string | null;
    createdAt: Date;
  };
  derivedCategories: CategoryDTO[];
  services: ServiceDTO[];
  badges: ProfessionalBadges;
  portfolios: unknown[];
  reviews: unknown[];
  documents: unknown[];
  licenses: unknown[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}


export interface ProfessionalFilters {
  search?: string;
  categorySlug?: string;
  serviceSlugs?: string[];
  /** Filter by specific profession enum value */
  profession?: Profession;
  /** Filter by county */
  county?: County;
  /** Filter by city */
  city?: string;
  sortBy?: "rating" | "experience" | "reviews" | "newest";
  verifiedOnly?: boolean;
  minRating?: number;

  //Pagination
  /** Include unverified professionals (for dev/admin testing) */
  // includeUnverified?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================================================
// PRISMA PAYLOAD TYPES (The Purist Layer)
// ============================================================================

/**
 * Defines the exact shape of data needed for the Card View.
 * We define the `select/include` here to ensure the generic `GetPayload` 
 * matches the actual query.
 */
const professionalCardInclude = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      avatar: true,
    },
  },
  offeredServices: {
    take: 5,
    where: { isPrimary: true },
    include: {
      service: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  },
  reviews: {
    take: 1,
    where: { status: "PUBLISHED" },
    select: {
      rating: true,
    },
  },
  documents: {
    select: {
      category: true,
    },
  },
  licenses: {
    select: {
      authority: true,
    },
  },
} satisfies Prisma.ProfessionalProfileInclude;

type ProfessionalCardPayload = Prisma.ProfessionalProfileGetPayload<{
  include: typeof professionalCardInclude;
}>;

/**
 * Defines the exact shape for the Detail View.
 */
const professionalDetailInclude = {
  user: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      avatar: true,
      createdAt: true,
    },
  },
  offeredServices: {
    include: {
      service: {
        include: {
          category: true,
        },
      },
    },
  },
  licenses: {
    orderBy: { createdAt: "desc" },
    select: {
      authority: true,
      status: true,
      validUntil: true,
      category: true,
    }
  },
  portfolios: {
    orderBy: { createdAt: "desc" },
    take: 6,
    include: {
      images: { take: 1 },
    },
  },
  reviews: {
    take: 5,
    where: { status: "PUBLISHED" },
    include: {
      reviewer: {
        select: {
          firstName: true,
          avatar: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  },
  documents: {
    where: { category: { not: "ID_OR_PASSPORT" } }, // Exclude sensitive docs
    select: {
      title: true,
      issuer: true,
      category: true,
      fileUrl: true,
      status: true,
    },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.ProfessionalProfileInclude;

type ProfessionalDetailPayload = Prisma.ProfessionalProfileGetPayload<{
  include: typeof professionalDetailInclude;
}>;


export class ProfessionalRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find professionals with filters and includes
   */
  async findMany(filters: ProfessionalFilters = {}): Promise<PaginatedResult<ProfessionalCardDTO>> {
    try {
      const {
        search = "",
        serviceSlugs,
        categorySlug,
        profession,
        county,
        city,
        sortBy = "rating",
        verifiedOnly = true,
        minRating,
        limit = 50,
        offset = 0,
      } = filters;

    // Build where clause
    const where: Prisma.ProfessionalProfileWhereInput = {
      // Base filters
      ...(verifiedOnly ? { verified: true } : {}),
      ...(minRating ? { rating: { gte: minRating } } : {}),
      ...(county ? { county } : {}),
      ...(profession ? { profession } : {}),
    };

    // Location filters
    if (city) {
      where.city = { contains: city, mode: "insensitive" };
    }

    // Search filter
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: "insensitive" } },
        { bio: { contains: search, mode: "insensitive" } },
        {
          // Search user name
          user: {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
            ],
          },
        },
        // Search for specific skills
        {
          offeredServices: {
            some: {
              service: {
                name: { contains: search, mode: "insensitive" },
              },
            },
          },
        },
      ];
    }

    // Category & Service Filtering (The Rational Logic)
    if (serviceSlugs && serviceSlugs.length > 0) {
      // Find pros who offer ANY of these specific services
      where.offeredServices = {
        some: {
          service: {
            slug: { in: serviceSlugs },
          },
        },
      };
    } else if (categorySlug && categorySlug !== "all") {
      // Find pros in this category
      where.offeredServices = {
        some: {
          service: {
            category: {
              slug: categorySlug,
            },
          },
        },
      };
    }
    
    // --- BUILD ORDER BY ---
    let orderBy: Prisma.ProfessionalProfileOrderByWithRelationInput = {};
    switch (sortBy) {
      case "experience":
        orderBy = { yearsExperience: "desc" };
        break;
      case "reviews":
        orderBy = { reviewCount: "desc" };
        break;
      case "rating":
        orderBy = { rating: "desc" };
        break;
      case "newest":
        orderBy = { createdAt: "desc" };
        break;
      default:
        orderBy = { createdAt: "desc" };
    }

    // --- EXECUTE QUERY ---
    const [rawProfiles, total] = await Promise.all([
      this.prisma.professionalProfile.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        // Smart Select: Fetch only what's needed for the card
        include: {
          ...professionalCardInclude,
          licenses: {
            where: {
              status: "VERIFIED",
              OR: [
                { validUntil: { gt: new Date() } },
                { validUntil: null }
              ]
            },
            select: {
              authority: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
      }),
      this.prisma.professionalProfile.count({ where }),
    ]);

    // TRANSFORM & RETURN
    const professionals = rawProfiles.map(this._transformForCard);

      return {
        data: professionals,
        total,
        limit,
        offset,
        hasMore: offset + professionals.length < total,
      };
    } catch (error) {
      console.error("[ProfessionalRepository.findMany] Error:", error);
      throw new Error("Failed to fetch professionals");
    }
  }

  /**
   * Find a single professional by user ID
   */
  async findByUserId(userId: string): Promise<ProfessionalDetailDTO | null> {
    try {
      const rawProfile = await this.prisma.professionalProfile.findUnique({
      where: { userId },
      include: professionalDetailInclude,
    });

      if (!rawProfile) return null;

      return this._transformProfile(rawProfile);
    } catch (error) {
      console.error("[ProfessionalRepository.findByUserId] Error:", error);
      throw new Error(`Failed to fetch professional profile for user: ${userId}`);
    }
  }

  /**
   * Create or update professional profile
   */
  async upsert(
    userId: string,
    data: Prisma.ProfessionalProfileUpdateInput
  ): Promise<Prisma.ProfessionalProfileGetPayload<object>> {
    try {
      return await this.prisma.professionalProfile.upsert({
        where: { userId },
        update: data,
        create: {
          userId,
          companyName: (data.companyName as string) ?? "Unnamed Professional",
          ...data,
        } as Prisma.ProfessionalProfileUncheckedCreateInput,
      });
    } catch (error) {
      console.error("[ProfessionalRepository.upsert] Error:", error);
      throw new Error(`Failed to upsert professional profile for user: ${userId}`);
    }
  }

  // PRIVATE HELPERS ("The View Model" Layer)
  /**
   * Transforms the deep nested DB structure into a clean UI object
   */
  private _transformProfile(profile: ProfessionalDetailPayload): ProfessionalDetailDTO {
  // Group Services by Category
  const categoryMap = new Map();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceList: any[] = [];

  profile.offeredServices.forEach((os) => {
    serviceList.push({
      id: os.service.id,
      name: os.service.name,
      slug: os.service.slug,
      price: os.price,
      unit: os.pricingUnit || os.service.defaultUnit,
      isPrimary: os.isPrimary,
      yearsExperience: os.yearsExperience,
    });

    const cat = os.service.category;
    if (!categoryMap.has(cat.id)) {
      categoryMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon
      });
    }
  });

  // Use imported utilities from license.types.ts
  const licenseVerifications = Object.fromEntries(
    REGULATORY_AUTHORITIES.map((auth) => [
      AUTHORITY_BADGE_MAP[auth],
      hasValidLicense(profile.licenses as any, auth),
    ])
  ) as Record<string, boolean>;

  const documentVerifications = Object.entries(DOCUMENT_BADGE_MAP).reduce(
    (acc, [category, badgeKey]) => {
      acc[badgeKey] = profile.documents.some(
        (d) =>
          d.category === category && d.status === "VERIFIED"
      );
      return acc;
    },
    {} as Record<string, boolean>
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { offeredServices, ...rest } = profile;

  return {
    ...rest,
    rating: profile.rating.toNumber(),
    derivedCategories: Array.from(categoryMap.values()),
    services: serviceList,
    badges: {
      ...licenseVerifications,
      ...documentVerifications,
      isVerified: profile.verified
    } as unknown as ProfessionalBadges,
  };
  }


  /**
   * Lightweight transform for list views
   */
  private _transformForCard(profile: ProfessionalCardPayload): ProfessionalCardDTO {
    return {
      id: profile.userId,
      companyName: profile.companyName,
      user: profile.user ?? { id: profile.userId, firstName: null, lastName: null, avatar: null },
      rating: profile.rating.toNumber(),
      reviewCount: profile.reviewCount ?? 0,
      verified: profile.verified ?? false,
      city: profile.city,
      county: profile.county,
      avatar: profile.user?.avatar ?? null,
      // Flatten skills for the card tags
      skills: (profile.offeredServices ?? []).map((os) => os.service?.name).filter(Boolean),
      authorities: (profile.licenses ?? []).map((l) => l.authority).filter(Boolean),
      documents: (profile.documents ?? []).map((d) => d.category).filter(Boolean),
    };
  }
}

// ============================================================================
// Singleton Export - Use this in your routes and components
// ============================================================================
export const professionalRepository = new ProfessionalRepository(prisma);