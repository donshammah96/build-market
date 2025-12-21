import { NextRequest } from 'next/server';
import { prisma } from '@repo/db';
import { withAuth } from '@/app/lib/api-middleware';
import { apiError, HttpStatus } from '@/app/lib/api-response';
import { initializeCorrelationId, executeResilient, getClientLogger } from '@/app/lib/resilient-api';
import { ClientRepository } from '@/app/lib/repositories/client.repository';
import { checkRateLimit, getRateLimitIdentifier, RateLimits } from '@/app/lib/rate-limit';

const logger = getClientLogger();

interface IdeaBookItem {
  imageUrl?: string;
}

/**
 * GET /api/client/dashboard
 * Get dashboard data for authenticated client
 * Returns stats, projects, idea books, and saved professionals
 */
export const GET = withAuth(async (request: NextRequest, { dbUserId }) => {
  const correlationId = initializeCorrelationId(request);

  // Rate limiting
  const identifier = getRateLimitIdentifier(request);
  const rateLimitResult = await checkRateLimit(
    `client-dashboard:${identifier}`,
    RateLimits.READ.limit,
    RateLimits.READ.window
  );

  if (!rateLimitResult.success) {
    return apiError('Too many requests. Please try again later.', HttpStatus.TOO_MANY_REQUESTS);
  }

  logger.info('Fetching client dashboard data', { correlationId, userId: dbUserId });

  return executeResilient(
    async () => {
      // Use repository to fetch dashboard data
      const repo = new ClientRepository(prisma);
      const { projects, ideaBooks } = await repo.getDashboardData(dbUserId);

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
          ? (book.items[0] as IdeaBookItem)?.imageUrl || '/placeholder.jpg'
          : '/placeholder.jpg',
      }));

      logger.info('Client dashboard data fetched successfully', {
        correlationId,
        userId: dbUserId,
        projectCount: projects.length,
        ideaBookCount: ideaBooks.length,
      });

      return {
        stats,
        projects: transformedProjects,
        ideaBooks: transformedIdeaBooks,
        savedProfessionals: [], // TODO: Implement saved professionals
      };
    },
    {
      operationName: 'get_client_dashboard',
      successStatus: HttpStatus.OK,
    }
  );
});
