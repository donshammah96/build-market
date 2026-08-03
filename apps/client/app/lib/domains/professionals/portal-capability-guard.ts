/**
 * Professional Portal Capability Guard
 *
 * Server-side authorization guard for professional portal domain endpoints.
 * Validates that an authenticated professional has the required capability
 * granted before executing mutations or returning restricted data.
 */

import {
  professionalPortalCapabilityService,
  type ExtendedProfessionalCapabilities,
} from "./capability.service";
import {
  ok,
  err,
  type DomainError,
  type Result,
} from "@/app/lib/errors/result";

export type CapabilityGuardErrorCode =
  | "forbidden"
  | "not_found"
  | "account_suspended"
  | "account_rejected"
  | "internal";

/**
 * Ensure a professional has a specific capability.
 * Returns `ok(true)` if allowed, or `err(...)` with HTTP status 403/404/500 if denied.
 */
export async function ensureProfessionalCapability(
  userId: string,
  requiredCapability: keyof ExtendedProfessionalCapabilities,
): Promise<Result<true, DomainError<CapabilityGuardErrorCode>>> {
  const checkRes =
    await professionalPortalCapabilityService.assertCapabilityAccess(
      userId,
      requiredCapability,
    );

  if (!checkRes.ok) {
    return checkRes;
  }

  return ok(true);
}
