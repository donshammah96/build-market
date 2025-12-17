/**
 * Unified API Response utilities
 * 
 * This module re-exports response helpers from resilient-api.ts for backward compatibility.
 * The resilient-api version includes enhanced features like correlation ID tracking.
 * 
 * @module api-response
 */

// Re-export response functions from resilient-api (single source of truth)
export { apiSuccess, apiError } from './resilient-api';

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: unknown;
  timestamp: string;
  correlationId?: string;
}

/**
 * Standard API success response format
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
  correlationId?: string;
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

