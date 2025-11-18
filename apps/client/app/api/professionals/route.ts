import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@repo/db';
import { ProfessionalCardData } from '../../../types/professional';
import { apiError, apiSuccess } from '@/app/lib/api-response';
import { ProfessionalRepository } from '@/app/lib/repositories/professional.repository';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';
import { env } from '@/app/lib/env';

/**
 * GET /api/professionals
 * Get list of verified professionals with filtering and sorting
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Rate limiting
    const identifier = getRateLimitIdentifier(request);
    const rateLimitResult = await checkRateLimit(
      `professionals:${identifier}`,
      RateLimits.READ.limit,
      RateLimits.READ.window
    );

    if (!rateLimitResult.success) {
      return apiError('Too many requests. Please try again later.', 429);
    }

    const searchParams = request.nextUrl.searchParams;
    
    // Validate and sanitize inputs
    const search = searchParams.get('search')?.trim().slice(0, 100) || '';
    const category = searchParams.get('category')?.trim() || 'All';
    const sortBy = (searchParams.get('sortBy') || 'rating') as 'rating' | 'experience' | 'reviews';

    // Whitelist sortBy values
    const validSortOptions = ['rating', 'experience', 'reviews'];
    if (!validSortOptions.includes(sortBy)) {
      return apiError('Invalid sort option. Must be one of: rating, experience, reviews', 400);
    }

    // Use repository to fetch professionals
    const repo = new ProfessionalRepository(prisma);
    const professionals = await repo.findMany({
      search,
      category,
      sortBy,
      verified: true,
    });

    // Transform data to match ProfessionalCardData interface
    const baseUrl = env.NEXT_PUBLIC_APP_URL;
    
    const transformedData = professionals.map((prof) => {
      const avgRating =
        prof.reviews && prof.reviews.length > 0
          ? prof.reviews.reduce((sum: number, r) => sum + r.rating, 0) / prof.reviews.length
          : undefined;

      // Format location from city, county, country
      // Access fields directly - they exist at runtime after migration
      const profData = prof as typeof prof & { 
        city?: string | null; 
        county?: string | null; 
        country?: string | null;
      };
      const locationParts = [];
      if (profData.city) locationParts.push(profData.city);
      if (profData.county && profData.county !== profData.city) locationParts.push(profData.county);
      if (profData.country) locationParts.push(profData.country);
      const location = locationParts.length > 0 ? locationParts.join(', ') : undefined;

      // Transform certificates
      const certificates = prof.certificates?.map((cert) => ({
        id: cert.id,
        name: cert.name,
        issuer: cert.issuer,
        issueDate: cert.issueDate ? cert.issueDate : undefined,
        expiryDate: cert.expiryDate ? cert.expiryDate : undefined,
        verificationStatus: cert.verificationStatus as 'pending' | 'verified' | 'rejected',
        verifiedAt: cert.verifiedAt ? cert.verifiedAt : undefined,
      })) || [];

      return {
        id: prof.userId,
        name: `${prof.user.firstName || ''} ${prof.user.lastName || ''}`.trim() || prof.companyName,
        companyName: prof.companyName,
        title: prof.servicesOffered[0] || 'Professional',
        bio: prof.bio || undefined,
        servicesOffered: prof.servicesOffered,
        yearsExperience: prof.yearsExperience || undefined,
        verified: prof.verified,
        rating: avgRating ? Math.round(avgRating * 10) / 10 : undefined, // Round to 1 decimal
        reviewCount: prof._count?.reviews || 0,
        portfolioImage: prof.portfolios?.[0]?.images?.[0] || undefined,
        portfolioUrl: prof.portfolioUrl || undefined,
        profileUrl: `${baseUrl}/professionals/${prof.userId}`,
        city: profData.city || undefined,
        county: profData.county || undefined,
        country: profData.country || undefined,
        location: location,
        certificates: certificates.length > 0 ? certificates : undefined,
      };
    });

    // Sort by rating if requested (since we can't do this in DB easily)
    if (sortBy === 'rating') {
      transformedData.sort((a: ProfessionalCardData, b: ProfessionalCardData) => (b.rating || 0) - (a.rating || 0));
    }

    return apiSuccess(transformedData);
  } catch (error) {
    console.error('Error fetching professionals:', error);
    return apiError('Failed to fetch professionals');
  }
}