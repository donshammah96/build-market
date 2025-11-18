import { NextResponse } from 'next/server';
import { env } from './env';

/**
 * Allowed origins for CORS
 */
const getAllowedOrigins = (): string[] => {
  const origins = [env.NEXT_PUBLIC_APP_URL];

  // Add localhost origins in development
  if (env.NODE_ENV === 'development') {
    origins.push(
      'http://localhost:3000',
      'http://localhost:3030',
      'http://localhost:3010'
    );
  }

  return origins;
};

/**
 * Generate CORS headers for a given origin
 */
export function corsHeaders(requestOrigin?: string | null): Record<string, string> {
  const allowedOrigins = getAllowedOrigins();
  const origin = requestOrigin || '';

  // Check if origin is allowed
  const allowOrigin: string = allowedOrigins.includes(origin)
    ? origin
    : allowedOrigins[0] || '';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

/**
 * Apply CORS headers to a NextResponse
 */
export function withCors(response: NextResponse, requestOrigin?: string | null): NextResponse {
  const headers = corsHeaders(requestOrigin);

  Object.entries(headers).forEach(([key, value]) => {
    if (value) {
      response.headers.set(key, value);
    }
  });

  return response;
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleCorsPreFlight(requestOrigin?: string | null): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  return withCors(response, requestOrigin);
}

