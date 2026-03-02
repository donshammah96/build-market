import {
  PrismaClient,
  PropertyType,
  PropertyCategory,
  PropertyStatus,
  Prisma,
  County
} from "@prisma/client";

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

// DTOs
export interface PropertyListItem {
  id: string;
  title: string;
  slug: string;
  price: Prisma.Decimal;
  currency: string;
  location: string;
  type: PropertyType;
  category: PropertyCategory;
  status: PropertyStatus;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  areaUnit: string;
  featured: boolean;
  verified: boolean;
  image: string; // Cover image
  agent: {
    id: string; // userId
    name: string;
    company: string | null;
    avatar: string | null;
    verified: boolean;
  };
  createdAt: string;
}

export interface PropertyRepositoryResult {
  properties: PropertyListItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PropertyDetail {
  id: string;
  title: string;
  description: string | null;
  price: Prisma.Decimal;
  currency: string;
  location: string;
  address: string | null;
  type: PropertyType;
  category: PropertyCategory;
  status: PropertyStatus;
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
  area: number | null; // Unified from buildingSize/plotSize
  areaUnit: string;
  yearBuilt: number | null;
  furnishing: any; // FurnishingStatus
  features: string[];
  featured: boolean;
  verified: boolean;
  createdAt: string; // ISO Date
  
  images: {
    id: string;
    url: string;
    caption: string | null;
    isMain: boolean;
  }[];

  attachments: {
    id: string;
    title: string;
    type: any; // AttachmentType
    url: string | null;
  }[];

  agent: {
    id: string;
    name: string;
    company: string | null;
    location: string;
    bio: string | null;
    avatar: string | null;
    verified: boolean;
    contact: {
      email: string | null;
      phone: string | null;
    };
  };
}

export class PropertyRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find properties with filters, sorting, and pagination
   */
  async findMany(filters: PropertyFilters = {}): Promise<PropertyRepositoryResult> {
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
      if (verified) {
        where.verificationStatus = "VERIFIED";
      } else {
        where.verificationStatus = { not: "VERIFIED" };
      }
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

    // Fetch properties with optimized select
    const propertiesData = await this.prisma.property.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        price: true,
        currency: true,
        location: true,
        type: true,
        category: true,
        status: true,
        bedrooms: true,
        bathrooms: true,
        buildingSize: true, // using buildingSize as 'area' default
        plotSize: true,     // fallback for Land
        areaUnit: true,
        featured: true,
        verified: true,
        createdAt: true,
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1, // Only need cover image
          select: {
            url: true, // Legacy
            asset: {   // New Asset system
              select: { cdnUrl: true } 
            }
          },
        },
        agent: {
          select: {
            userId: true,
            companyName: true,
            verified: true,
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

    // Transform to DTO
    const properties: PropertyListItem[] = propertiesData.map((p) => {
      // Image resolution: Asset > Legacy > Placeholder
      let image = "/placeholder-property.jpg";
      const firstImg = p.images[0];
      if (firstImg) {
        if (firstImg.asset?.cdnUrl) image = firstImg.asset.cdnUrl;
        else if (firstImg.url) image = firstImg.url;
      }

      // Agent name resolution
      const agentName = `${p.agent.user.firstName ?? ""} ${p.agent.user.lastName ?? ""}`.trim() || p.agent.companyName || "Agent";

      return {
        id: p.id,
        title: p.title,
        slug: p.slug,
        price: p.price,
        currency: p.currency,
        location: p.location,
        type: p.type,
        category: p.category,
        status: p.status,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        area: p.buildingSize ?? p.plotSize,
        areaUnit: p.areaUnit,
        featured: p.featured,
        verified: p.verified,
        image,
        agent: {
          id: p.agent.userId,
          name: agentName,
          company: p.agent.companyName,
          avatar: p.agent.user.avatar,
          verified: p.agent.verified,
        },
        createdAt: p.createdAt.toISOString(),
      };
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
  /**
   * Find a single property by ID with full details
   */
  async findById(id: string) {
    const property = await this.prisma.property.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        currency: true,
        location: true,
        address: true,
        type: true,
        category: true,
        status: true,
        bedrooms: true,
        bathrooms: true,
        parkingSpaces: true,
        buildingSize: true,
        plotSize: true,
        areaUnit: true,
        yearBuilt: true,
        furnishing: true,
        features: true,
        featured: true,
        verified: true,
        createdAt: true,
        images: {
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            url: true, // Legacy
            caption: true,
            isMain: true,
            asset: { select: { cdnUrl: true } }
          },
        },
        attachments: {
          select: {
            id: true,
            title: true,
            type: true,
            fileUrl: true, // Legacy
            asset: { select: { cdnUrl: true } }
          },
        },
        agent: {
          select: {
            userId: true,
            companyName: true,
            verified: true,
            bio: true,
            city: true, // ProfessionalProfile city
            county: true,
            user: {
              select: {
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

    if (!property) return null;

    // Transform images
    const images = property.images.map(img => ({
      id: img.id,
      url: img.asset?.cdnUrl ?? img.url ?? "/placeholder-property.jpg",
      caption: img.caption,
      isMain: img.isMain,
    }));

    // Transform attachments
    const attachments = property.attachments.map(att => ({
      id: att.id,
      title: att.title,
      type: att.type,
      url: att.asset?.cdnUrl ?? att.fileUrl,
    }));

    // Transform Agent
    const agent = {
      id: property.agent.userId,
      name: `${property.agent.user.firstName ?? ""} ${property.agent.user.lastName ?? ""}`.trim() || property.agent.companyName || "Agent",
      company: property.agent.companyName,
      location: `${property.agent.city ?? ""}, ${property.agent.county ?? ""}`.trim().replace(/^, |, $/g, ""),
      bio: property.agent.bio,
      avatar: property.agent.user.avatar,
      verified: property.agent.verified,
      contact: {
        email: property.agent.user.email,
        phone: property.agent.user.phone,
      }
    };

    return {
      id: property.id,
      title: property.title,
      description: property.description,
      price: property.price,
      currency: property.currency,
      location: property.location,
      address: property.address,
      type: property.type,
      category: property.category,
      status: property.status,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      parkingSpaces: property.parkingSpaces,
      area: property.buildingSize ?? property.plotSize,
      areaUnit: property.areaUnit,
      yearBuilt: property.yearBuilt,
      furnishing: property.furnishing,
      features: property.features,
      featured: property.featured,
      verified: property.verified,
      createdAt: property.createdAt.toISOString(),
      images,
      attachments,
      agent,
    };
  }

  /**
   * Find similar properties (same location or type)
   */
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

    const propertiesData = await this.prisma.property.findMany({
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
      select: {
        id: true,
        title: true,
        price: true,
        currency: true,
        location: true,
        type: true,
        category: true,
        status: true,
        bedrooms: true,
        bathrooms: true,
        buildingSize: true, // using buildingSize as 'area' default
        plotSize: true,     // fallback for Land
        areaUnit: true,
        featured: true,
        verified: true,
        createdAt: true,
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1, // Only need cover image
          select: {
            url: true, // Legacy
            asset: {   // New Asset system
              select: { cdnUrl: true } 
            }
          },
        },
        agent: {
          select: {
            userId: true,
            companyName: true,
            verified: true,
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

    // Reuse transformation logic (could be extracted to private helper)
    return propertiesData.map((p) => {
      let image = "/placeholder-property.jpg";
      const firstImg = p.images[0];
      if (firstImg) {
        if (firstImg.asset?.cdnUrl) image = firstImg.asset.cdnUrl;
        else if (firstImg.url) image = firstImg.url;
      }
      
      const agentName = `${p.agent.user.firstName ?? ""} ${p.agent.user.lastName ?? ""}`.trim() || p.agent.companyName || "Agent";

      return {
        id: p.id,
        title: p.title,
        price: p.price,
        currency: p.currency,
        location: p.location,
        type: p.type,
        category: p.category,
        status: p.status,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        area: p.buildingSize ?? p.plotSize,
        areaUnit: p.areaUnit,
        featured: p.featured,
        verified: p.verified,
        image,
        agent: {
          id: p.agent.userId,
          name: agentName,
          company: p.agent.companyName,
          avatar: p.agent.user.avatar,
          verified: p.agent.verified,
        },
        createdAt: p.createdAt.toISOString(),
      };
    });
  }

  /**
   * Get featured properties
   */
  async findFeatured(limit: number = 6) {
    const propertiesData = await this.prisma.property.findMany({
      where: {
        featured: true,
        status: "AVAILABLE",
        deletedAt: null,
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        price: true,
        currency: true,
        location: true,
        type: true,
        category: true,
        status: true,
        bedrooms: true,
        bathrooms: true,
        buildingSize: true, // using buildingSize as 'area' default
        plotSize: true,     // fallback for Land
        areaUnit: true,
        featured: true,
        verified: true,
        createdAt: true,
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1, // Only need cover image
          select: {
            url: true, // Legacy
            asset: {   // New Asset system
              select: { cdnUrl: true } 
            }
          },
        },
        agent: {
          select: {
            userId: true,
            companyName: true,
            verified: true,
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

    return propertiesData.map((p) => {
      let image = "/placeholder-property.jpg";
      const firstImg = p.images[0];
      if (firstImg) {
        if (firstImg.asset?.cdnUrl) image = firstImg.asset.cdnUrl;
        else if (firstImg.url) image = firstImg.url;
      }
      
      const agentName = `${p.agent.user.firstName ?? ""} ${p.agent.user.lastName ?? ""}`.trim() || p.agent.companyName || "Agent";

      return {
        id: p.id,
        title: p.title,
        price: p.price,
        currency: p.currency,
        location: p.location,
        type: p.type,
        category: p.category,
        status: p.status,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        area: p.buildingSize ?? p.plotSize,
        areaUnit: p.areaUnit,
        featured: p.featured,
        verified: p.verified,
        image,
        agent: {
          id: p.agent.userId,
          name: agentName,
          company: p.agent.companyName,
          avatar: p.agent.user.avatar,
          verified: p.agent.verified,
        },
        createdAt: p.createdAt.toISOString(),
      };
    });
  }
}
