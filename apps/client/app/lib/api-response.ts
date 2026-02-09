/**
 * Unified API Response utilities
 *
 * This module provides types, constants, and utility functions for API responses.
 * For the actual response functions (apiSuccess, apiError), import from resilient-api.ts
 * which includes enhanced features like correlation ID tracking and observability.
 *
 * @module api-response
 */

import { NextResponse } from 'next/server';

/**
 * Build API success response with correlation ID
 * @deprecated Import from resilient-api.ts instead for better observability
 */
export function apiSuccess<T>(
  data: T,
  status: number = 200,
  correlationId?: string
): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      ...(correlationId && { correlationId }),
    },
    { status, headers: correlationId ? { 'X-Correlation-ID': correlationId } : {} }
  );
}

/**
 * Build API error response with correlation ID
 * @deprecated Import from resilient-api.ts instead for better observability
 */
export function apiError(
  message: string,
  status: number = 500,
  details?: unknown,
  correlationId?: string
): NextResponse {
  const response: {
    success: false;
    error: string;
    timestamp: string;
    details?: unknown;
    correlationId?: string;
  } = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  };

  if (details !== undefined) {
    response.details = details;
  }
  if (correlationId) {
    response.correlationId = correlationId;
  }

  return NextResponse.json(
    response,
    { status, headers: correlationId ? { 'X-Correlation-ID': correlationId } : {} }
  );
}

/**
 * Pagination information for list responses
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Standard API error response format
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
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
 * Standard API list response format with pagination
 */
export interface ApiListResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationInfo;
  timestamp: string;
  correlationId?: string;
}

/**
 * Standard API response type union
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Common HTTP status codes
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  MULTI_STATUS: 207,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * Standard error codes for client-side handling
 */
export const ErrorCodes = {
  // Validation errors
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",

  // Authentication/Authorization
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  SESSION_EXPIRED: "SESSION_EXPIRED",

  // Resource errors
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",

  // Rate limiting
  RATE_LIMITED: "RATE_LIMITED",

  // Server errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",

  // Business logic errors
  INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",
  INVALID_STATE_TRANSITION: "INVALID_STATE_TRANSITION",
  VERIFICATION_REQUIRED: "VERIFICATION_REQUIRED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Build a standardized success response
 */
export function buildSuccessResponse<T>(
  data: T,
  correlationId?: string
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    correlationId,
  };
}

/**
 * Build a standardized list response with pagination
 */
export function buildListResponse<T>(
  data: T[],
  pagination: PaginationInfo,
  correlationId?: string
): ApiListResponse<T> {
  return {
    success: true,
    data,
    pagination,
    timestamp: new Date().toISOString(),
    correlationId,
  };
}

/**
 * Build a standardized error response
 */
export function buildErrorResponse(
  error: string,
  code?: ErrorCode,
  details?: unknown,
  correlationId?: string
): ApiErrorResponse {
  return {
    success: false,
    error,
    code,
    details,
    timestamp: new Date().toISOString(),
    correlationId,
  };
}
