/**
 * Shared request utilities for API routes
 * Centralizes common request processing patterns
 */

import { NextRequest } from "next/server";
import { z } from "zod";

/**
 * UUID validation schema for query parameters
 */
export const UUIDSchema = z
  .string()
  .uuid("Invalid ID format. Must be a valid UUID.");

/**
 * Extract client IP address from request headers
 * Handles various proxy configurations (CloudFlare, nginx, etc.)
 */
export function getClientIpAddress(req: NextRequest): string {
  // CloudFlare
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  // Standard proxy headers
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // Take first IP (original client) from comma-separated list
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  // nginx real IP
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return "unknown";
}

/**
 * Extract user agent from request
 */
export function getUserAgent(req: NextRequest): string {
  return req.headers.get("user-agent") || "unknown";
}

/**
 * Extract request metadata for audit logging
 */
export function getRequestMetadata(req: NextRequest): {
  ipAddress: string;
  userAgent: string;
} {
  return {
    ipAddress: getClientIpAddress(req),
    userAgent: getUserAgent(req),
  };
}

/**
 * Safely parse JSON body with error handling
 * Returns parsed body or null if parsing fails
 */
export async function safeParseJsonBody<T = unknown>(
  req: NextRequest,
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const body = await req.json();
    return { success: true, data: body as T };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { success: false, error: "Invalid JSON in request body" };
    }
    return { success: false, error: "Failed to parse request body" };
  }
}

/**
 * Timeout configuration constants
 * Maps to OperationCriticality in resilience package
 * Use these instead of magic strings for type safety
 */
export const TimeoutConfig = {
  /** Critical operations: auth, payments (shorter timeout, faster failures) */
  CRITICAL: "critical",
  /** Normal operations: standard DB queries, most API calls */
  NORMAL: "normal",
  /** Background operations: exports, batch processing (longer timeout) */
  BACKGROUND: "background",
} as const;

export type TimeoutConfigType =
  (typeof TimeoutConfig)[keyof typeof TimeoutConfig];

export function extractExpectedVersion(
  req: NextRequest,
  body: unknown,
): number | null {
  const ifMatch = req.headers.get("If-Match");
  if (ifMatch) {
    const v = parseInt(ifMatch.replace(/"/g, ""), 10);
    return Number.isNaN(v) ? null : v;
  }
  if (
    body &&
    typeof body === "object" &&
    "version" in (body as Record<string, unknown>)
  ) {
    const raw = (body as Record<string, unknown>).version;
    const v = parseInt(String(raw), 10);
    return Number.isNaN(v) ? null : v;
  }
  return null;
}
