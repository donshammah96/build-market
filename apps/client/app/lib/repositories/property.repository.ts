import {
  PrismaClient,
  PropertyType,
  PropertyCategory,
  PropertyStatus,
  Prisma,
} from "@prisma/client";

// County enum - matches Prisma County
type County =
  | "MOMBASA"
  | "KWALE"
  | "KILIFI"
  | "TANA_RIVER"
  | "LAMU"
  | "TAITA_TAVETA"
  | "GARISSA"
  | "WAJIR"
  | "MANDERA"
  | "MARSABIT"
  | "ISIOLO"
  | "MERU"
  | "THARAKA_NITHI"
  | "EMBU"
  | "KITUI"
  | "MACHAKOS"
  | "MAKUENI"
  | "NYANDARUA"
  | "NYERI"
  | "KIRINYAGA"
  | "MURANGA"
  | "KIAMBU"
  | "TURKANA"
  | "WEST_POKOT"
  | "SAMBURU"
  | "TRANS_NZOIA"
  | "UASIN_GISHU"
  | "ELGEYO_MARAKWET"
  | "NANDI"
  | "BARINGO"
  | "LAIKIPIA"
  | "NAKURU"
  | "NAROK"
  | "KAJIADO"
  | "KERICHO"
  | "BOMET"
  | "KAKAMEGA"
  | "VIHIGA"
  | "BUNGOMA"
  | "BUSIA"
  | "SIAYA"
  | "KISUMU"
  | "HOMA_BAY"
  | "MIGORI"
  | "KISII"
  | "NYAMIRA"
  | "NAIROBI";

export interface PropertyFilters {
  type?: PropertyType;
  category?: PropertyCategory;
  status?: PropertyStatus;
  county?: County;
  constituency?: string;
  neighbourhood?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  verified?: boolean;
  featured?: boolean;
  agentId?: string;
  sortBy?: "price_asc" | "price_desc" | "newest" | "oldest";
  limit?: number;
  offset?: number;
}

export class PropertyRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find properties with filters, sorting, and pagination
   */
  async findMany(filters: PropertyFilters = {}) {
    const {
      type,
      category,
      status = "AVAILABLE",
      county,
      constituency,
      neighbourhood,
      location,
      minPrice,
      maxPrice,
      minBedrooms,
      minBathrooms,
      verified,
      featured,
      agentId,
      sortBy = "newest",
      limit = 20,
      offset = 0,
    } = filters;

    // Build where clause
    const where: Prisma.PropertyWhereInput = {
      deletedAt: null, // Exclude soft-deleted properties
    };

    if (type) where.type = type;
    if (category) where.category = category;
    if (status) where.status = status;
    if (county) where.county = county;
    if (featured !== undefined) where.featured = featured;
    if (agentId) where.agentId = agentId;

    // Constituency filter
    if (constituency) {
      where.constituency = { contains: constituency, mode: "insensitive" };
    }

    // Neighbourhood filter
    if (neighbourhood) {
      where.neighbourhood = { contains: neighbourhood, mode: "insensitive" };
    }

    // Location search (case-insensitive contains)
    if (location) {
      where.location = { contains: location, mode: "insensitive" };
    }

    // Price range
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    // Bedrooms minimum
    if (minBedrooms !== undefined) {
      where.bedrooms = { gte: minBedrooms };
    }

    // Bathrooms minimum
    if (minBathrooms !== undefined) {
      where.bathrooms = { gte: minBathrooms };
    }

    // Verification status filter
    if (verified !== undefined) {
      where.verificationStatus = verified ? "VERIFIED" : "UNVERIFIED";
    }

    // Build orderBy clause
    let orderBy: Prisma.PropertyOrderByWithRelationInput = {};
    switch (sortBy) {
      case "price_asc":
        orderBy = { price: "asc" };
        break;
      case "price_desc":
        orderBy = { price: "desc" };
        break;
      case "oldest":
        orderBy = { createdAt: "asc" };
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" };
    }

    // Get total count for pagination
    const total = await this.prisma.property.count({ where });

    // Fetch properties with agent info and images
    const properties = await this.prisma.property.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            url: true,
            caption: true,
            isMain: true,
            sortOrder: true,
          },
        },
        agent: {
          select: {
            userId: true,
            companyName: true,
            verified: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });

    return {
      properties,
      total,
      limit,
      offset,
      hasMore: offset + properties.length < total,
    };
  }

  /**
   * Find a single property by ID with full details
   */
  async findById(id: string) {
    return this.prisma.property.findFirst({
      where: {
        id,
        deletedAt: null, // Exclude soft-deleted
      },
      include: {
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
        attachments: {
          select: {
            id: true,
            type: true,
            fileUrl: true,
            fileKey: true,
            isVerified: true,
            notes: true,
            createdAt: true,
          },
        },
        agent: {
          select: {
            userId: true,
            companyName: true,
            verified: true,
            bio: true,
            city: true,
            county: true,
            earbNumber: true,
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
          },
        },
      },
    });
  }

  /**
   * Find similar properties (same location or type)
   */
  async findSimilar(propertyId: string, limit: number = 4) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        location: true,
        type: true,
        category: true,
        county: true,
        id: true,
      },
    });

    if (!property) return [];

    return this.prisma.property.findMany({
      where: {
        id: { not: propertyId },
        status: "AVAILABLE",
        deletedAt: null,
        OR: [
          { county: property.county },
          {
            location: {
              contains: property.location.split(",")[0],
              mode: "insensitive",
            },
          },
          { type: property.type, category: property.category },
        ],
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        images: {
          where: { isMain: true },
          take: 1,
          select: {
            id: true,
            url: true,
            caption: true,
          },
        },
        agent: {
          select: {
            userId: true,
            companyName: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get featured properties
   */
  async findFeatured(limit: number = 6) {
    return this.prisma.property.findMany({
      where: {
        featured: true,
        status: "AVAILABLE",
        deletedAt: null,
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: {
            id: true,
            url: true,
            caption: true,
            isMain: true,
          },
        },
        agent: {
          select: {
            userId: true,
            companyName: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
  }
}
