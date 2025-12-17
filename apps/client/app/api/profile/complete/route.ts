import { NextRequest, NextResponse } from 'next/server';
import { getClientLogger, initializeCorrelationId } from '@/app/lib/resilient-api';

const logger = getClientLogger();

/**
 * @deprecated This endpoint is deprecated. Use /api/user/profile/complete instead.
 * 
 * POST /api/profile/complete
 * 
 * This endpoint has been deprecated in favor of /api/user/profile/complete
 * which provides better structured logging, resilience patterns, and consistent
 * error handling.
 * 
 * This route now redirects to the new endpoint for backward compatibility.
 * Please update your client code to use the new endpoint directly.
 */
export async function POST(req: NextRequest) {
  const correlationId = initializeCorrelationId(req);
  
  logger.warn('Deprecated endpoint called: /api/profile/complete', {
    correlationId,
    deprecatedEndpoint: '/api/profile/complete',
    newEndpoint: '/api/user/profile/complete',
  });

  // Return deprecation notice with redirect information
  return NextResponse.json(
    {
      success: false,
      error: 'This endpoint is deprecated',
      message: 'Please use /api/user/profile/complete instead',
      deprecationNotice: {
        deprecated: true,
        oldEndpoint: '/api/profile/complete',
        newEndpoint: '/api/user/profile/complete',
        migrateBy: '2025-03-01',
      },
      correlationId,
    },
    { 
      status: 410, // Gone
      headers: {
        'X-Deprecated': 'true',
        'X-New-Endpoint': '/api/user/profile/complete',
        'X-Correlation-ID': correlationId || '',
      },
    }
  );
}

/**
 * @deprecated This endpoint is deprecated. Use /api/user/profile/complete instead.
 */
export async function PATCH(req: NextRequest) {
  return POST(req);
}

/**
 * @deprecated This endpoint is deprecated. Use /api/user/profile/complete instead.
 */
export async function PUT(req: NextRequest) {
  return POST(req);
}
