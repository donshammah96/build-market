import { NextRequest } from 'next/server';
import { healthCheck } from '@/app/lib/resilient-api';
import { prisma } from '@repo/db';

const MESSAGING_SERVICE_URL = process.env.MESSAGING_SERVICE_URL || 'http://localhost:3010';

/**
 * GET /api/health
 * Comprehensive health check endpoint with circuit breaker and cache stats
 */
export async function GET(request: NextRequest) {
  return healthCheck('build-market-client', [
    {
      name: 'database',
      check: async () => {
        try {
          await prisma.$queryRaw`SELECT 1`;
          return true;
        } catch {
          return false;
        }
      },
      critical: true,
    },
    {
      name: 'messaging-service',
      check: async () => {
        try {
          const response = await fetch(`${MESSAGING_SERVICE_URL}/health`, {
            signal: AbortSignal.timeout(3000),
          });
          return response.ok;
        } catch {
          return false;
        }
      },
      critical: false,
    },
  ]);
}
