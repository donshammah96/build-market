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
