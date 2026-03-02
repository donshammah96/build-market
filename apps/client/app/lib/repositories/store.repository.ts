import {
  PrismaClient,
  StoreType,
  DeliveryOption,
  VerificationStatus,
  Prisma,
  County
} from "@prisma/client";

export interface StoreFilters {
  query?: string;
  type?: StoreType;
  county?: County;
  city?: string;
  verified?: boolean;
  featured?: boolean;
  category?: string; // Search by category name or ID
  sortBy?: "rating_desc" | "newest" | "name_asc";
  limit?: number;
  offset?: number;
}

export interface StoreListItem {
  id: string;
  name: string;
  slug: string;
  type: StoreType;
  description: string | null;
  logo: string;
  banner: string | null;
  location: string;
  rating: number; // Decimal to number
  reviewCount: number;
  verified: boolean;
  featured: boolean;
  deliveryOption: DeliveryOption;
  categoryNames: string[];
  createdAt: string;
}

export interface StoreDetail extends StoreListItem {
  address: string;
  city: string;
  county: County | null;
  contact: {
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    website: string | null;
  };
  payment: {
    mpesaTill: string | null;
    mpesaPaybill: string | null;
    acceptsCard: boolean;
    acceptsCash: boolean;
  };
  operatingHours: any; // Json
  delivery: {
    option: DeliveryOption;
    radiusKm: number | null;
    baseFee: number | null;
    minOrderValue: number | null;
  };
  images: {
    id: string;
    url: string;
    caption: string | null;
    isMain: boolean;
  }[];
  owner: {
    id: string;
    name: string;
    company: string | null;
    verified: boolean;
  };
}

export interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  price: Prisma.Decimal;
  compareAt: Prisma.Decimal | null;
  stock: number;
  lowStock: boolean;
  image: string; // Thumbnail
  category: string; // Category Name
  storeId: string;
  storeName: string;
}

export interface StoreRepositoryResult {
  stores: StoreListItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export class StoreRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Find stores with filters
   */
  async findMany(filters: StoreFilters = {}): Promise<StoreRepositoryResult> {
    const {
      query,
      type,
      county,
      city,
      verified,
      featured,
      category,
      sortBy = "rating_desc",
      limit = 20,
      offset = 0,
    } = filters;

    const where: Prisma.StoreWhereInput = {
      deletedAt: null,
      isOpen: true,
      verificationStatus: "VERIFIED", // Default to showing only verified/approved stores publicly? Or make configurable. Assuming public listing.
    };

    // Override verification if explicitly requested (e.g. for admin or specific views, though usually public view restricts this)
    if (verified !== undefined) {
      where.verified = verified;
    }

    if (featured !== undefined) {
      where.featured = featured;
    }

    if (type) where.storeType = type;
    if (county) where.county = county;
    
    if (city) {
      where.city = { contains: city, mode: "insensitive" };
    }

    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
      ];
    }

    // Category filter
    if (category) {
       // Assuming categories is Enum array
       // Prisine doesn't support 'contains' on Enums comfortably without full text search or exact match
       // where.categories = { has: category as any };
    }

    // Sorting
    let orderBy: Prisma.StoreOrderByWithRelationInput = {};
    switch (sortBy) {
      case "rating_desc":
        orderBy = { rating: "desc" };
        break;
      case "name_asc":
        orderBy = { name: "asc" };
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" };
    }

    const total = await this.prisma.store.count({ where });

    const storesData = await this.prisma.store.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
      select: {
        id: true,
        name: true,
        slug: true,
        storeType: true,
        description: true,
        logoUrl: true,
        bannerUrl: true,
        city: true,
        county: true,
        rating: true,
        reviewCount: true,
        verified: true,
        featured: true,
        deliveryOption: true,
        createdAt: true,
        categories: true,
        professional: {
          select: {
            companyName: true, 
            user: {
              select: { firstName: true, lastName: true }
            }
          }
        }
      }
    });

    const stores: StoreListItem[] = storesData.map(store => ({
      id: store.id,
      name: store.name,
      slug: store.slug,
      type: store.storeType,
      description: store.description,
      logo: store.logoUrl ?? "/placeholder-store.jpg", 
      banner: store.bannerUrl,
      location: `${store.city}${store.county ? `, ${store.county}` : ''}`,
      rating: Number(store.rating),
      reviewCount: store.reviewCount,
      verified: store.verified,
      featured: store.featured,
      deliveryOption: store.deliveryOption,
      categoryNames: store.categories as unknown as string[],
      createdAt: store.createdAt.toISOString(),
    }));

    return {
      stores,
      total,
      limit,
      offset,
      hasMore: offset + stores.length < total,
    };
  }

  // ... findByIdOrSlug ...

  /**
   * Find products for a store
   */
  async findProducts(storeId: string, page = 1, limit = 20, category?: string): Promise<{ products: ProductListItem[]; total: number }> {
    const offset = (page - 1) * limit;
    
    const where: Prisma.ProductWhereInput = {
      storeId,
      deletedAt: null,
      isActive: true,
    };

    if (category) {
       // where.category = category as any;
    }

    const total = await this.prisma.product.count({ where });

    const productsData = await this.prisma.product.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        compareAt: true,
        stockQuantity: true,
        lowStockAlert: true,
        category: true,
        store: {
            select: { id: true, name: true }
        },
        images: {
            take: 1,
            select: {
                cdnUrl: true, 
                thumbnailUrl: true
            }
        }
      }
    });

    const products: ProductListItem[] = productsData.map(p => {
        const cover = p.images[0]?.thumbnailUrl || p.images[0]?.cdnUrl || "/placeholder-product.jpg";
        return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: p.price,
            compareAt: p.compareAt,
            stock: p.stockQuantity,
            lowStock: p.stockQuantity <= p.lowStockAlert,
            image: cover,
            // eslint-disable-next-line /typescript-eslint/no-explicit-any
            category: String(p.category),
            storeId: p.store.id,
            storeName: p.store.name
        };
    });

    return { products, total };
  }
}

