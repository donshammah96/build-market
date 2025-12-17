import { PrismaClient, PropertyType, PropertyCategory, PropertyStatus, Prisma } from '@prisma/client';

export interface PropertyFilters {
  type?: PropertyType;
  category?: PropertyCategory;
  status?: PropertyStatus;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  featured?: boolean;
  agentId?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'oldest';
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
      status = 'AVAILABLE',
      location,
      minPrice,
      maxPrice,
      minBedrooms,
      featured,
      agentId,
      sortBy = 'newest',
      limit = 20,
      offset = 0,
    } = filters;

    // Build where clause
    const where: Prisma.PropertyWhereInput = {};

    if (type) where.type = type;
    if (category) where.category = category;
    if (status) where.status = status;
    if (featured !== undefined) where.featured = featured;
    if (agentId) where.agentId = agentId;

    // Location search (case-insensitive contains)
    if (location) {
      where.location = { contains: location, mode: 'insensitive' };
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

    // Build orderBy clause
    let orderBy: Prisma.PropertyOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'price_asc':
        orderBy = { price: 'asc' };
        break;
      case 'price_desc':
        orderBy = { price: 'desc' };
        break;
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
    }

    // Get total count for pagination
    const total = await this.prisma.property.count({ where });

    // Fetch properties with agent info
    const properties = await this.prisma.property.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
      include: {
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
    return this.prisma.property.findUnique({
      where: { id },
      include: {
        agent: {
          select: {
            userId: true,
            companyName: true,
            verified: true,
            bio: true,
            city: true,
            county: true,
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
      select: { location: true, type: true, category: true, id: true },
    });

    if (!property) return [];

    return this.prisma.property.findMany({
      where: {
        id: { not: propertyId },
        status: 'AVAILABLE',
        OR: [
          { location: { contains: property.location.split(',')[0], mode: 'insensitive' } },
          { type: property.type, category: property.category },
        ],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
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
        status: 'AVAILABLE',
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
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
