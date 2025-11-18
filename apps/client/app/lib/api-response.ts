import { NextResponse } from 'next/server';

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: any;
  timestamp: string;
}

/**
 * Standard API success response format
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * Returns a standardized error response
 * @param message - Error message for the client
 * @param status - HTTP status code (default: 500)
 * @param details - Additional error details (only included in development)
 */
export function apiError(
  message: string,
  status: number = 500,
  details?: any
): NextResponse<ApiErrorResponse> {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return NextResponse.json(
    {
      success: false,
      error: message,
      // Only include details in development to avoid exposing sensitive info
      ...(isDevelopment && details && { details }),
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * Returns a standardized success response
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 */
export function apiSuccess<T>(
  data: T,
  status: number = 200
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

/**
 * Common HTTP status codes
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

