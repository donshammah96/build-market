"use server";

import { adminEnvConfig } from "@/lib/infrastructure/env";
import { safeAction } from "@/_core/safe-action";
import { type ActionResponse } from "./types";
import { callClientApi } from "@/_core/client-api";

import type {
  AdminOnboardingReconciliationResult,
  AdminOnboardingClerkSyncResult,
  AdminOnboardingIdempotencyReconcileResult,
} from "./types";

type RemediationActorPayload = {
  userId: string;
  adminRole: string;
};

function getInternalRemediationSecret(): string {
  const secret = adminEnvConfig.INTERNAL_API_SECRET;
  if (!secret) {
    throw new Error("Internal onboarding remediation secret is not configured");
  }

  return secret;
}

function buildRemediationActorPayload(
  adminUserId: string,
  adminRole: string,
): RemediationActorPayload {
  return {
    userId: adminUserId,
    adminRole,
  };
}

function requireNonEmptyInput(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required`);
  }

  return normalized;
}

export async function onboardingReconcile(
  userId: string,
): Promise<ActionResponse<AdminOnboardingReconciliationResult>> {
  return safeAction(
    "onboardingReconcile",
    async ({ adminRole, adminUserId }) => {
      const normalizedUserId = requireNonEmptyInput(userId, "userId");

      const response = await callClientApi<{
        success: true;
        data: AdminOnboardingReconciliationResult;
      }>("/api/internal/onboarding-remediation/reconcile", {
        method: "POST",
        headers: {
          "x-internal-secret": getInternalRemediationSecret(),
        },
        body: {
          userId: normalizedUserId,
          actor: buildRemediationActorPayload(adminUserId, String(adminRole)),
        },
      });

      return response.data;
    },
  );
}

export async function onboardingClerkSync(
  userId: string,
): Promise<ActionResponse<AdminOnboardingClerkSyncResult>> {
  return safeAction(
    "onboardingClerkSync",
    async ({ adminRole, adminUserId }) => {
      const normalizedUserId = requireNonEmptyInput(userId, "userId");

      const response = await callClientApi<{
        success: true;
        data: AdminOnboardingClerkSyncResult;
      }>("/api/internal/onboarding-remediation/clerk-sync", {
        method: "POST",
        headers: {
          "x-internal-secret": getInternalRemediationSecret(),
        },
        body: {
          userId: normalizedUserId,
          actor: buildRemediationActorPayload(adminUserId, String(adminRole)),
        },
      });

      return response.data;
    },
  );
}

export async function onboardingIdempotencyReconcile(
  key: string,
): Promise<ActionResponse<AdminOnboardingIdempotencyReconcileResult>> {
  return safeAction(
    "onboardingIdempotencyReconcile",
    async ({ adminRole, adminUserId }) => {
      const normalizedKey = requireNonEmptyInput(key, "key");

      const response = await callClientApi<{
        success: true;
        data: AdminOnboardingIdempotencyReconcileResult;
      }>("/api/internal/onboarding-remediation/idempotency-reconcile", {
        method: "POST",
        headers: {
          "x-internal-secret": getInternalRemediationSecret(),
        },
        body: {
          key: normalizedKey,
          actor: buildRemediationActorPayload(adminUserId, String(adminRole)),
        },
      });

      return response.data;
    },
  );
}
