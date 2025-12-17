import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/db';
import { PropertyRepository } from '@/app/lib/repositories/property.repository';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';
import { env } from '@/app/lib/env';
import {
  executeResilient,
  initializeCorrelationId,
  apiError,
  getClientLogger,
} from '@/app/lib/resilient-api';
import { PropertyType, PropertyCategory } from '@prisma/client';

const logger = getClientLogger();

/**
 * GET /api/properties
 * Get list of properties with filtering, sorting, and pagination
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = initializeCorrelationId(request);

  // Rate limiting
  const identifier = getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(
    `properties:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    logger.warn('Rate limit exceeded', { correlationId, identifier });
    return apiError('Too many requests. Please try again later.', 429);
  }

  const searchParams = request.nextUrl.searchParams;

  // Parse and validate query parameters
  const type = searchParams.get('type') as PropertyType | null;
  const category = searchParams.get('category') as PropertyCategory | null;
  const location = searchParams.get('location')?.trim().slice(0, 100) || undefined;
  const minPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined;
  const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined;
  const minBedrooms = searchParams.get('beds') ? Number(searchParams.get('beds')) : undefined;
  const featured = searchParams.get('featured') === 'true' ? true : undefined;
  const sortBy = (searchParams.get('sortBy') || 'newest') as 'price_asc' | 'price_desc' | 'newest' | 'oldest';
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50);
  const offset = Number(searchParams.get('offset')) || 0;

  // Validate sortBy
  const validSortOptions = ['price_asc', 'price_desc', 'newest', 'oldest'];
  if (!validSortOptions.includes(sortBy)) {
    return apiError('Invalid sort option. Must be one of: price_asc, price_desc, newest, oldest', 400);
  }

  // Validate type if provided
  if (type && !['SALE', 'RENT', 'LEASE'].includes(type)) {
    return apiError('Invalid property type. Must be one of: SALE, RENT, LEASE', 400);
  }

  // Validate category if provided
  if (category && !['RESIDENTIAL', 'COMMERCIAL', 'LAND', 'INDUSTRIAL'].includes(category)) {
    return apiError('Invalid property category. Must be one of: RESIDENTIAL, COMMERCIAL, LAND, INDUSTRIAL', 400);
  }

  // Execute with resilience patterns
  return executeResilient(
    async () => {
      const repo = new PropertyRepository(prisma);
      const result = await repo.findMany({
        type: type || undefined,
        category: category || undefined,
        location,
        minPrice,
        maxPrice,
        minBedrooms,
        featured,
        sortBy,
        limit,
        offset,
      });

      const baseUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3500';

      // Transform to PropertyCardData format
      const properties = result.properties.map((property) => {
        const agentName = property.agent?.user
          ? `${property.agent.user.firstName || ''} ${property.agent.user.lastName || ''}`.trim() || property.agent.companyName
          : property.agent?.companyName || 'Unknown';

        return {
          id: property.id,
          title: property.title,
          price: Number(property.price),
          currency: property.currency,
          location: property.location,
          type: property.type,
          category: property.category,
          status: property.status,
          beds: property.bedrooms || undefined,
          baths: property.bathrooms || undefined,
          area: property.areaSqFt || undefined,
          image: property.images[0] || '/placeholder-property.jpg',
          featured: property.featured,
          agent: property.agent ? {
            name: agentName,
            image: property.agent.user?.avatar || undefined,
          } : undefined,
          propertyUrl: `${baseUrl}/properties/${property.id}`,
        };
      });

      logger.info('Properties fetched successfully', {
        correlationId,
        count: properties.length,
        total: result.total,
        filters: { type, category, location, minPrice, maxPrice, sortBy },
      });

      return {
        properties,
        total: result.total,
        page: Math.floor(offset / limit) + 1,
        limit,
        hasMore: result.hasMore,
      };
    },
    {
      criticality: 'normal',
      operationName: 'fetch-properties',
      cache: {
        ttl: 30000, // 30s cache
        staleWhileRevalidate: 15000,
      },
      fallback: async () => {
        logger.warn('Using fallback for properties list', { correlationId });
        return {
          properties: [],
          total: 0,
          page: 1,
          limit,
          hasMore: false,
        };
      },
    }
  );
}
