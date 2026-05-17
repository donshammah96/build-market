"use server";

import { prisma } from "@build/db";
import { auth } from "@clerk/nextjs/server";
import { syncUserRole } from "../../lib/auth-sync";
import {
  getAdminActionPolicy,
  type AdminAccessRole,
} from "@/lib/security/authorization-policy";
import {
  normalizeAdminAccessRole,
  parseSessionMetadata,
} from "@/lib/security/claims";
import type { ActionResponse } from "./types";
import { adminEnvConfig } from "@/lib/infrastructure/env";
import { omitUndefined } from "@/lib/utils";

export type {
  ActionResponse,
  PaginationMeta,
  SystemSettingsInput,
  UpdateProfileInput,
} from "./types";

const CLIENT_API_BASE_URL =
  adminEnvConfig.CLIENT_APP_URL ?? "http://localhost:3500";

const VERIFICATION_ALLOWED_ROLES = ["admin", "verification_admin"] as const;
const ADMIN_SUPER_ROLES = ["SUPER_ADMIN"] as const;

type ActionActorRole = (typeof VERIFICATION_ALLOWED_ROLES)[number];

export type AdminPermissions = {
  role: AdminAccessRole | undefined;
  granularRole: string | null;
  canAccess: boolean;
  dbUserId?: string | undefined;
  clerkId?: string | undefined;
};

function toAdminAccessRole(value: unknown): AdminAccessRole | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = normalizeAdminAccessRole(value);
  if (!normalized) {
    return undefined;
  }

  return normalized;
}

export async function assertVerificationAdmin(): Promise<{
  clerkId: string;
  dbUserId: string;
  role: ActionActorRole;
}> {
  const { userId: clerkId, sessionClaims } = await auth();

  if (!clerkId) {
    throw new Error("Unauthorized: User not authenticated");
  }

  await syncUserRole().catch((error) => {
    console.warn("Role sync warning", error);
  });

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, role: true },
  });

  if (!user) {
    throw new Error("Unauthorized: User not found in database");
  }

  const metadata = parseSessionMetadata(sessionClaims);
  const sessionRole = toAdminAccessRole(metadata?.role);
  const dbRole = toAdminAccessRole(String(user.role));
  const resolvedRole = sessionRole ?? dbRole;

  if (!resolvedRole || !VERIFICATION_ALLOWED_ROLES.includes(resolvedRole)) {
    throw new Error("Forbidden: Verification admin privileges required");
  }

  return {
    clerkId,
    dbUserId: user.id,
    role: resolvedRole,
  };
}

export async function assertAdmin(): Promise<{
  clerkId: string;
  dbUserId: string;
  role: "admin";
}> {
  const context = await assertVerificationAdmin();

  if (context.role !== "admin") {
    throw new Error("Forbidden: Admin privileges required");
  }

  return {
    clerkId: context.clerkId,
    dbUserId: context.dbUserId,
    role: "admin",
  };
}

export async function getAdminPermissions(): Promise<AdminPermissions> {
  const { userId: clerkId, sessionClaims } = await auth();

  if (!clerkId) {
    return {
      role: undefined,
      granularRole: null,
      canAccess: false,
    };
  }

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true,
      role: true,
      adminProfile: {
        select: {
          role: true,
          isActive: true,
        },
      },
    },
  });

  if (!user) {
    return {
      role: undefined,
      granularRole: null,
      canAccess: false,
      clerkId,
    };
  }

  const metadata = parseSessionMetadata(sessionClaims);
  const sessionRole = toAdminAccessRole(metadata?.role);
  const dbRole = toAdminAccessRole(String(user.role));
  const role = sessionRole ?? dbRole;
  const granularRole = user.adminProfile?.role
    ? String(user.adminProfile.role)
    : null;
  const canAccess = Boolean(
    role &&
    VERIFICATION_ALLOWED_ROLES.includes(role) &&
    (user.adminProfile ? user.adminProfile.isActive : true),
  );

  return {
    role,
    granularRole,
    canAccess,
    dbUserId: user.id,
    clerkId,
  };
}

export async function requireAdminGranularRole(
  allowedRoles: readonly string[],
  adminUserId: string,
): Promise<string> {
  const profile = await prisma.adminProfile.findUnique({
    where: { userId: adminUserId },
    select: {
      role: true,
      isActive: true,
    },
  });

  if (!profile) {
    throw new Error("Forbidden: Admin profile is not configured");
  }

  if (!profile.isActive) {
    throw new Error("Forbidden: Admin profile is inactive");
  }

  const granularRole = String(profile.role);

  if (
    ADMIN_SUPER_ROLES.includes(
      granularRole as (typeof ADMIN_SUPER_ROLES)[number],
    )
  ) {
    return granularRole;
  }

  if (!allowedRoles.includes(granularRole)) {
    throw new Error("Forbidden: Missing required admin permission");
  }

  return granularRole;
}

export async function safeAction<T>(
  actionName: string,
  fn: (context: { adminUserId: string; adminRole: "admin" }) => Promise<T>,
): Promise<ActionResponse<T>> {
  try {
    const { dbUserId, role } = await assertAdmin();
    const policy = getAdminActionPolicy(actionName);

    if (!policy.allowedRoles.includes(role)) {
      throw new Error("Forbidden: Action policy denied");
    }

    const data = await fn({ adminUserId: dbUserId, adminRole: role });

    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";

    return {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function safeVerificationAction<T>(
  actionName: string,
  fn: (context: {
    adminUserId: string;
    adminRole: ActionActorRole;
  }) => Promise<T>,
): Promise<ActionResponse<T>> {
  try {
    const { dbUserId, role } = await assertVerificationAdmin();
    const policy = getAdminActionPolicy(actionName);

    if (!policy.allowedRoles.includes(role)) {
      throw new Error("Forbidden: Action policy denied");
    }

    const data = await fn({ adminUserId: dbUserId, adminRole: role });

    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";

    return {
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    };
  }
}

export async function logAdminAction(data: {
  userId: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: unknown;
  reason?: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: data.userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      adminProfile: {
        select: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    return;
  }

  const immutableDetails = {
    ...(typeof data.details === "object" && data.details
      ? (data.details as Record<string, unknown>)
      : { value: data.details }),
    _audit: {
      immutable: true,
      schemaVersion: 1,
      loggedAt: new Date().toISOString(),
    },
  };

  await prisma.adminAuditLog.create({
    data: {
      adminId: user.id,
      adminName:
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        "System Admin",
      adminEmail: user.email,
      adminRole: user.adminProfile?.role
        ? String(user.adminProfile.role)
        : String(user.role),
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      details: immutableDetails,
      ...omitUndefined({ reason: data.reason }),
    },
  });
}

interface ClientApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  timeout?: number;
}

const DEFAULT_CLIENT_API_TIMEOUT_MS = 30_000;
const MIN_CLIENT_API_TIMEOUT_MS = 1_000;
const MAX_CLIENT_API_TIMEOUT_MS = 60_000;

function normalizeClientApiTimeout(timeout: number | undefined): number {
  if (typeof timeout !== "number" || !Number.isFinite(timeout)) {
    return DEFAULT_CLIENT_API_TIMEOUT_MS;
  }

  const normalizedTimeout = Math.trunc(timeout);

  if (normalizedTimeout < MIN_CLIENT_API_TIMEOUT_MS) {
    return MIN_CLIENT_API_TIMEOUT_MS;
  }

  if (normalizedTimeout > MAX_CLIENT_API_TIMEOUT_MS) {
    return MAX_CLIENT_API_TIMEOUT_MS;
  }

  return normalizedTimeout;
}

export async function callClientApi<T>(
  endpoint: string,
  options: ClientApiOptions = {},
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;
  const requestTimeoutMs = normalizeClientApiTimeout(options.timeout);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);

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
      const errorData = await response
        .json()
        .catch(() => ({ error: undefined, message: undefined }));
      throw new Error(
        (errorData as { error?: string; message?: string }).error ||
          (errorData as { error?: string; message?: string }).message ||
          `API request failed with status ${response.status}`,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Request to ${endpoint} timed out after ${requestTimeoutMs}ms`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
