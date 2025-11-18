import { NextRequest } from 'next/server';
import { prisma } from '@repo/db';
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, apiSuccess } from '@/app/lib/api-response';
import { ClientRepository } from '@/app/lib/repositories/client.repository';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';

/**
 * GET /api/client/dashboard
 * Get dashboard data for authenticated client
 */
export const GET = withAuth(async (request: NextRequest, { dbUserId }) => {
  try {
    // Rate limiting
    const identifier = getRateLimitIdentifier(request);
    const rateLimitResult = await checkRateLimit(
      `client-dashboard:${identifier}`,
      RateLimits.API.limit,
      RateLimits.API.window
    );

    if (!rateLimitResult.success) {
      return apiError('Too many requests. Please try again later.', 429);
    }

    // Use repository to fetch dashboard data
    const repo = new ClientRepository(prisma);
    const { projects, ideaBooks, clientProfile } = await repo.getDashboardData(dbUserId);

    // Calculate stats
    const stats = {
      activeProjects: projects.filter(
        (p) => p.status === 'in_progress' || p.status === 'planning'
      ).length,
      completedProjects: projects.filter((p) => p.status === 'completed').length,
      savedProfessionals: 0, // TODO: Calculate from preferences
      ideaBooks: ideaBooks.length,
    };

    // Transform projects for frontend
    const transformedProjects = projects.map((project) => ({
      id: project.id,
      title: project.title,
      description: project.description,
      status: project.status,
      progress: repo.calculateProgress(project),
      budget: project.budget,
      professional: project.professional
        ? {
            name: `${project.professional.user.firstName} ${project.professional.user.lastName}`.trim(),
            title: project.professional.servicesOffered[0] || 'Professional',
          }
        : null,
      startDate: project.startDate?.toISOString(),
      estimatedEndDate: project.endDate?.toISOString(),
    }));

    // Transform idea books for frontend
    const transformedIdeaBooks = ideaBooks.map((book) => ({
      id: book.id,
      title: book.title,
      itemCount: Array.isArray(book.items) ? book.items.length : 0,
      coverImage: (Array.isArray(book.items) && book.items.length > 0)
        ? (book.items[0] as any)?.imageUrl || '/placeholder.jpg'
        : '/placeholder.jpg',
    }));

    return apiSuccess({
      stats,
      projects: transformedProjects,
      ideaBooks: transformedIdeaBooks,
      savedProfessionals: [], // TODO: Implement saved professionals
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return apiError('Failed to fetch dashboard data');
  }
});
