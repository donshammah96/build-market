/**
 * Professional Portal Capability Guard
 *
 * Server-side authorization guard for professional portal domain endpoints.
 * Validates that an authenticated professional has the required capability
 * granted before executing mutations or returning restricted data.
 */

import {
  professionalReadinessService,
  type ProfessionalCapabilities,
} from "./readiness.service";
import {
  ok,
  err,
  type DomainError,
  type Result,
} from "@/app/lib/errors/result";

export type CapabilityGuardErrorCode = "forbidden" | "not_found" | "internal";

/**
 * Ensure a professional has a specific capability.
 * Returns `ok(true)` if allowed, or `err(...)` with HTTP status 403/404/500 if denied.
 */
export async function ensureProfessionalCapability(
  userId: string,
  requiredCapability: keyof ProfessionalCapabilities,
): Promise<Result<true, DomainError<CapabilityGuardErrorCode>>> {
  const readinessRes = await professionalReadinessService.getReadiness(userId);

  if (!readinessRes.ok) {
    if (readinessRes.error === "not_found") {
      return err({
        error: "not_found",
        message: "Professional profile not found",
        status: 404,
      });
    }
    return err({
      error: "internal",
      message: "Failed to verify capability",
      status: 500,
    });
  }

  const { capabilities, verificationStatus } = readinessRes.data;
  const isAllowed = capabilities[requiredCapability];

  if (!isAllowed) {
    return err({
      error: "forbidden",
      message: `Account ${verificationStatus.toLowerCase()}: capability '${requiredCapability}' is restricted until verification is complete`,
      status: 403,
    });
  }

  return ok(true);
}
