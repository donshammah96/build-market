"use server";

import { prisma } from "@repo/db";
import { auth } from "@clerk/nextjs/server";
import { syncUserRole } from "../../lib/auth-sync";
import type { ActionResponse } from "./types";

// Re-export types from the non-server types file
// NOTE: Zod schemas (PaginationSchema, UpdateProfileSchema, SystemSettingsSchema)
// cannot be re-exported from "use server" files. Import them directly from "./types".
export type {
  ActionResponse,
  PaginationMeta,
  SystemSettingsInput,
  UpdateProfileInput,
} from "./types";

// ============================================================================
// Constants
// ============================================================================

// Client app base URL for API calls
const CLIENT_API_BASE_URL = process.env.CLIENT_APP_URL || "http://localhost:3500";

// Allowed roles for verification actions
const VERIFICATION_ALLOWED_ROLES = ["admin", "verification_admin"] as const;

// ============================================================================
// Middleware
// ============================================================================

/**
 * Validates that the current user has admin privileges.
 * Uses a multi-layer check: Clerk session -> DB fallback
 */
export async function assertAdmin(): Promise<void> {
  const { userId, sessionClaims } = await auth();
  
  // 1. Check Auth
  if (!userId) throw new Error("Unauthorized: User not authenticated");

  // 2. Sync Role (Fail-safe)
  await syncUserRole().catch(err => console.error("Role sync warning:", err));

  // 3. Fast Role Check (from Clerk session claims)
  const metadata = sessionClaims?.metadata as { role?: string } | undefined;
  if (metadata?.role === "admin") return;

  // 4. Deep DB Check (Fallback)
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true }
  });

  if (user?.role !== "admin") {
    throw new Error("Forbidden: Admin privileges required");
  }
}

/**
 * Validates that the current user has verification privileges.
 * Allows both admin and verification_admin roles.
 */
export async function assertVerificationAdmin(): Promise<{ userId: string; role: string }> {
  const { userId, sessionClaims } = await auth();
  
  // 1. Check Auth
  if (!userId) throw new Error("Unauthorized: User not authenticated");

  // 2. Sync Role (Fail-safe)
  await syncUserRole().catch(err => console.error("Role sync warning:", err));

  // 3. Fast Role Check (from Clerk session claims)
  const metadata = sessionClaims?.metadata as { role?: string } | undefined;
  const clerkRole = metadata?.role;
  
  if (clerkRole && VERIFICATION_ALLOWED_ROLES.includes(clerkRole as typeof VERIFICATION_ALLOWED_ROLES[number])) {
    return { userId, role: clerkRole };
  }

  // 4. Deep DB Check (Fallback)
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
    select: { role: true }
  });

  if (!user?.role || !VERIFICATION_ALLOWED_ROLES.includes(user.role as typeof VERIFICATION_ALLOWED_ROLES[number])) {
    throw new Error("Forbidden: Verification admin privileges required");
  }

  return { userId, role: user.role };
}

/**
 * Wrapper for admin actions that standardizes error handling and auth checks.
 * Returns a consistent ActionResponse<T> shape for all actions.
 */
export async function safeAction<T>(
  actionName: string, 
  fn: () => Promise<T>
): Promise<ActionResponse<T>> {
  try {
    await assertAdmin();
    const data = await fn();
    return { 
      success: true, 
      data,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[AdminAction: ${actionName}] Error:`, error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return { success: false, error: message };
  }
}

/**
 * Wrapper for verification actions that allows both admin and verification_admin roles.
 * Returns a consistent ActionResponse<T> shape and includes admin context.
 */
export async function safeVerificationAction<T>(
  actionName: string, 
  fn: (context: { adminUserId: string; adminRole: string }) => Promise<T>
): Promise<ActionResponse<T>> {
  try {
    const { userId, role } = await assertVerificationAdmin();
    const data = await fn({ adminUserId: userId, adminRole: role });
    return { 
      success: true, 
      data,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[VerificationAction: ${actionName}] Error:`, error);
    const message = error instanceof Error ? error.message : "An unexpected error occurred";
    return { success: false, error: message };
  }
}

// ============================================================================
// Client API Helpers
// ============================================================================

interface ClientApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Makes authenticated requests to the client app API.
 * Includes proper error handling and timeout support.
 */
export async function callClientApi<T>(
  endpoint: string,
  options: ClientApiOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {}, timeout = 30000 } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const url = `${CLIENT_API_BASE_URL}${endpoint}`;
    
    const fetchOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      signal: controller.signal,
    };

    if (body && method !== "GET") {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || errorData.message || `API request failed with status ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Request to ${endpoint} timed out after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
