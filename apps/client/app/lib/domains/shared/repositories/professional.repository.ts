import { PrismaClient, Prisma, County, Profession } from "@prisma/client";
import { prisma } from "@build/db";
import {
  REGULATORY_AUTHORITIES,
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
  profession: Profession | null;
  yearsExperience: number | null;
  bio: string | null;
  portfolioUrl: string | null;
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
  country: string | null;
  avatar: string | null;
  skills: string[];
  authorities: string[];
  documents: string[];
  _count?: {
    reviews: number;
    projects: number;
    stores: number;
    properties: number;
  };
  portfolios?: {
    images: { asset?: { cdnUrl?: string; thumbnailUrl?: string } }[];
  }[];
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
  profession?: Profession | null;
  bio: string | null;
  rating: number | null;
  reviewCount: number;
  verified: boolean;
  yearsExperience: number | null;
  city: string | null;
  county: County | null;
  country?: string | null;
  isInsured: boolean;
  portfolioUrl?: string | null;
  website?: string | null;
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
  documents: {
    where: { status: "VERIFIED" },
    select: { category: true },
  },
  licenses: {
    where: {
      status: "VERIFIED",
      OR: [{ validUntil: { gt: new Date() } }, { validUntil: null }],
    },
    select: { authority: true },
  },
  portfolios: {
    take: 1,
    orderBy: { createdAt: "desc" as const },
    include: {
      images: {
        take: 1,
        select: {
          id: true,
          asset: { select: { cdnUrl: true, thumbnailUrl: true } },
        },
      },
    },
  },
  _count: {
    select: {
      reviews: true,
      projects: true,
      stores: true,
      properties: true,
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
    orderBy: { createdAt: "desc" as const },
    select: {
      authority: true,
      status: true,
      validUntil: true,
      category: true,
    },
  },
  portfolios: {
    orderBy: { createdAt: "desc" as const },
    take: 6,
    include: {
      images: { take: 1 },
    },
  },
  reviews: {
    take: 10,
    where: { status: "PUBLISHED" },
    include: {
      reviewer: {
        select: {
          firstName: true,
          avatar: true,
        },
      },
    },
    orderBy: { createdAt: "desc" as const },
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
    orderBy: { createdAt: "desc" as const },
  },
} satisfies Prisma.ProfessionalProfileInclude;

const buildPublicProfileInclude = (now: Date) =>
  ({
    user: {
      select: {
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
      },
    },
    offeredServices: {
      include: {
        service: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
                icon: true,
              },
            },
          },
        },
      },
    },
    licenses: {
      where: {
        status: "VERIFIED",
        OR: [{ validUntil: { gt: now } }, { validUntil: null }],
      },
      select: {
        authority: true,
        licenseNumber: true,
        category: true,
        validFrom: true,
        validUntil: true,
      },
      orderBy: { createdAt: "desc" as const },
    },
    portfolios: {
      take: 6,
      orderBy: { createdAt: "desc" as const },
      select: {
        id: true,
        title: true,
        description: true,
        projectType: true,
        completionDate: true,
        images: {
          orderBy: [{ isMain: "desc" as const }, { sortOrder: "asc" as const }],
          take: 4,
          select: {
            id: true,
            caption: true,
            isMain: true,
            category: true,
            asset: {
              select: {
                cdnUrl: true,
                thumbnailUrl: true,
                blurHash: true,
              },
            },
          },
        },
      },
    },
    documents: {
      where: {
        status: "VERIFIED",
        category: { not: "ID_OR_PASSPORT" },
      },
      select: {
        id: true,
        title: true,
        issuer: true,
        category: true,
        status: true,
        verifiedAt: true,
      },
      orderBy: { createdAt: "desc" as const },
    },
    reviews: {
      where: { status: "PUBLISHED" },
      take: 5,
      orderBy: { createdAt: "desc" as const },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        reviewer: {
          select: {
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    },
    _count: {
      select: {
        reviews: true,
        projects: true,
        portfolios: true,
        stores: true,
        properties: true,
      },
    },
  }) satisfies Prisma.ProfessionalProfileInclude;

type ProfessionalDetailPayload = Prisma.ProfessionalProfileGetPayload<{
  include: typeof professionalDetailInclude;
}>;

type PublicProfessionalProfileInclude = ReturnType<
  typeof buildPublicProfileInclude
>;

type PublicProfessionalProfilePayload = Prisma.ProfessionalProfileGetPayload<{
  include: PublicProfessionalProfileInclude;
}>;

export class ProfessionalRepository {
  private pendingSearch: Promise<PaginatedResult<ProfessionalCardDTO>> | null =
    null;
  private inFlightRequests = new Map<
    string,
    Promise<PaginatedResult<ProfessionalCardDTO>>
  >();

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Find professionals with filters and includes
   */
  async findMany(
    filters: ProfessionalFilters = {},
  ): Promise<PaginatedResult<ProfessionalCardDTO>> {
    // 1. GENERATE KEY
    const {
      search,
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

    const cacheKey = JSON.stringify({
      search,
      serviceSlugs,
      categorySlug,
      profession,
      county,
      city,
      sortBy,
      verifiedOnly,
      minRating,
      limit,
      offset,
    });

    // 2. CHECK IN-FLIGHT
    const existingRequest = this.inFlightRequests.get(cacheKey);
    if (existingRequest) return existingRequest;

    // 3. EXECUTE & CACHE
    const requestPromise = (async () => {
      try {
        const where: Prisma.ProfessionalProfileWhereInput = {
          ...(verifiedOnly && { verified: true }),
          ...(minRating && { rating: { gte: minRating } }),
          ...(county && { county }),
          ...(profession && { profession }),
          ...(city && { city: { contains: city, mode: "insensitive" } }),
          ...(search && this._buildSearchClause(search)),
          ...this._buildCategoryFilter(categorySlug, serviceSlugs),
        };

        const [rawProfiles, total] = await this.prisma.$transaction([
          this.prisma.professionalProfile.findMany({
            where,
            orderBy: this._getOrderBy(sortBy),
            skip: offset,
            take: limit,
            include: professionalCardInclude,
          }),
          this.prisma.professionalProfile.count({ where }),
        ]);

        const professionals = rawProfiles.map((p) =>
          this._transformForCard(p as ProfessionalCardPayload),
        );

        return {
          data: professionals,
          total,
          limit,
          offset,
          hasMore: offset + professionals.length < total,
        };
      } catch (error) {
        console.error(
          "[ProfessionalRepository.findMany] Critical query failure:",
          error,
        );
        throw new Error("Professional search is currently unavailable.");
      } finally {
        // 4. CLEANUP
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    this.inFlightRequests.set(cacheKey, requestPromise);
    return requestPromise;
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

      return this._transformProfile(rawProfile as ProfessionalDetailPayload);
    } catch (error) {
      console.error(
        "[ProfessionalRepository.findByUserId] Critical query failure:",
        error,
      );
      throw new Error(
        `Failed to fetch professional profile for user: ${userId}`,
      );
    }
  }

  /**
   * Find a single professional profile for public viewing by user ID.
   */
  async findPublicProfileByUserId(
    userId: string,
  ): Promise<PublicProfessionalProfilePayload | null> {
    try {
      const rawProfile = await this.prisma.professionalProfile.findUnique({
        where: { userId },
        include: buildPublicProfileInclude(new Date()),
      });

      if (!rawProfile) return null;

      return rawProfile as PublicProfessionalProfilePayload;
    } catch (error) {
      console.error(
        "[ProfessionalRepository.findPublicProfileByUserId] Critical query failure:",
        error,
      );
      throw new Error(
        `Failed to fetch public professional profile for user: ${userId}`,
      );
    }
  }

  /**
   * Create or update a professional profile
   */
  async upsert(
    userId: string,
    data: Omit<Prisma.ProfessionalProfileUncheckedCreateInput, "userId"> &
      Prisma.ProfessionalProfileUpdateInput,
  ) {
    try {
      return await this.prisma.professionalProfile.upsert({
        where: { userId },
        update: data as Prisma.ProfessionalProfileUpdateInput,
        create: {
          userId,
          ...(data as any),
        },
      });
    } catch (error) {
      console.error(
        "[ProfessionalRepository.upsert] Critical query failure:",
        error,
      );
      throw new Error(
        `Failed to upsert professional profile for user: ${userId}`,
      );
    }
  }

  // PRIVATE HELPERS ("The View Model" Layer)
  /**
   * Transforms the deep nested DB structure into a clean UI object
   */
  private _transformProfile(
    profile: ProfessionalDetailPayload,
  ): ProfessionalDetailDTO {
    const categories: Record<string, CategoryDTO> = {};

    const services: ServiceDTO[] = profile.offeredServices.map((os) => {
      const cat = os.service.category;
      if (!categories[cat.id]) {
        categories[cat.id] = {
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          icon: cat.icon,
        };
      }
      return {
        id: os.service.id,
        name: os.service.name,
        slug: os.service.slug,
        price: os.price ? os.price.toNumber() : null,
        unit: os.pricingUnit || os.service.defaultUnit,
        isPrimary: os.isPrimary,
        yearsExperience: os.yearsExperience,
      };
    });

    return {
      ...profile,
      rating: profile.rating.toNumber(),
      derivedCategories: Object.values(categories),
      services,
      badges: this._computeBadges(profile),
      // Map JSON/Prisma objects to pure objects for serialization
      portfolios: profile.portfolios,
      reviews: profile.reviews,
      documents: profile.documents,
      licenses: profile.licenses,
    };
  }

  /**
   * Lightweight transform for list views
   */
  private _transformForCard(
    profile: ProfessionalCardPayload,
  ): ProfessionalCardDTO {
    return {
      id: profile.userId,
      companyName: profile.companyName,
      profession: profile.profession ?? null,
      yearsExperience: profile.yearsExperience ?? null,
      bio: profile.bio ?? null,
      portfolioUrl: profile.portfolioUrl ?? null,
      user: profile.user ?? {
        id: profile.userId,
        firstName: null,
        lastName: null,
        avatar: null,
      },
      rating: profile.rating != null ? Number(profile.rating) : null,
      reviewCount: profile.reviewCount ?? 0,
      verified: profile.verified ?? false,
      city: profile.city,
      county: profile.county,
      country: profile.country ?? null,
      avatar: profile.user?.avatar ?? null,
      skills: (profile.offeredServices ?? [])
        .map((os) => os.service?.name)
        .filter(Boolean),
      authorities: (profile.licenses ?? [])
        .map((l) => l.authority)
        .filter(Boolean),
      documents: (profile.documents ?? [])
        .map((d) => d.category)
        .filter(Boolean),
      _count: (
        profile as {
          _count?: {
            reviews: number;
            projects: number;
            stores: number;
            properties: number;
          };
        }
      )._count,
      portfolios: profile.portfolios.map((p) => ({
        images: p.images.map((img) => ({
          asset: img.asset
            ? {
                cdnUrl: img.asset.cdnUrl ?? undefined,
                thumbnailUrl: img.asset.thumbnailUrl ?? undefined,
              }
            : undefined,
        })),
      })),
    };
  }

  // ============================================================================
  // 4. PRIVATE UTILITIES
  // ============================================================================

  private _buildSearchClause(
    search: string,
  ): Prisma.ProfessionalProfileWhereInput {
    const term = { contains: search, mode: "insensitive" as const };
    return {
      OR: [
        { companyName: term },
        { bio: term },
        { user: { OR: [{ firstName: term }, { lastName: term }] } },
        { offeredServices: { some: { service: { name: term } } } },
      ],
    };
  }

  private _buildCategoryFilter(
    catSlug?: string,
    svcSlugs?: string[],
  ): Prisma.ProfessionalProfileWhereInput {
    if (svcSlugs?.length) {
      return {
        offeredServices: { some: { service: { slug: { in: svcSlugs } } } },
      };
    }
    if (catSlug && catSlug !== "all") {
      return {
        offeredServices: { some: { service: { category: { slug: catSlug } } } },
      };
    }
    return {};
  }

  private _getOrderBy(
    sortBy: string,
  ): Prisma.ProfessionalProfileOrderByWithRelationInput {
    const map: Record<
      string,
      Prisma.ProfessionalProfileOrderByWithRelationInput
    > = {
      experience: { yearsExperience: "desc" },
      reviews: { reviewCount: "desc" },
      rating: { rating: "desc" },
      newest: { createdAt: "desc" },
    };
    return map[sortBy] || { createdAt: "desc" };
  }

  private _computeBadges(
    profile: ProfessionalDetailPayload,
  ): ProfessionalBadges {
    const licenseBadges = Object.fromEntries(
      REGULATORY_AUTHORITIES.map((auth) => [
        AUTHORITY_BADGE_MAP[auth],
        hasValidLicense(profile.licenses, auth),
      ]),
    );

    const documentBadges = Object.entries(DOCUMENT_BADGE_MAP).reduce(
      (acc, [category, badgeKey]) => {
        acc[badgeKey] = profile.documents.some(
          (d) => d.category === category && d.status === "VERIFIED",
        );
        return acc;
      },
      {} as Record<string, boolean>,
    );

    return {
      ...licenseBadges,
      ...documentBadges,
      isVerified: profile.verified,
    } as unknown as ProfessionalBadges;
  }
}
// ============================================================================
// Singleton Export - Use this in your routes and components
// ============================================================================
export const professionalRepository = new ProfessionalRepository(prisma);
