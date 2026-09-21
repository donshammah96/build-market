import { err, ok } from "@/app/lib/errors/result";
import { normalizeRole } from "@/app/lib/security/roles";
import { licensesRepository } from "./repository";
import { publishLicenseEvent } from "@/app/lib/integrations/license-events";
import type {
  CreateLicenseInput,
  UpdateLicenseInput,
  LicenseActor,
  LicenseResult,
  LicenseListResult,
  LicenseDetail,
  LicenseCreateResult,
  LicenseUpdateResult,
  LicenseDeleteResult,
} from "./contracts";

const PROFESSIONAL_LICENSE_ROLES = new Set(["PROFESSIONAL", "ADMIN"]);

function forbidden(message = "Forbidden"): LicenseResult<never> {
  return err({ error: "forbidden", message, status: 403 });
}

function notFound(message = "License not found"): LicenseResult<never> {
  return err({ error: "not_found", message, status: 404 });
}

function requireProfessionalLicenseActor(
  actor: LicenseActor,
): LicenseResult<{ userId: string }> {
  const role = normalizeRole(actor.role);
  if (!role || !PROFESSIONAL_LICENSE_ROLES.has(role)) {
    return forbidden();
  }
  return ok({ userId: actor.userId });
}

export const licensesService = {
  async getLicenses(
    actor: LicenseActor,
  ): Promise<LicenseResult<LicenseListResult>> {
    const actorResult = requireProfessionalLicenseActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }
    const licenses = await licensesRepository.getLicenses(
      actorResult.data.userId,
    );
    return ok(licenses);
  },

  async getLicenseById(
    actor: LicenseActor,
    licenseId: string,
  ): Promise<LicenseResult<LicenseDetail>> {
    const actorResult = requireProfessionalLicenseActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }
    const result = await licensesRepository.getLicenseById(
      actorResult.data.userId,
      licenseId,
    );
    if ("error" in result) {
      if (result.error === "not_found") return notFound();
      return forbidden();
    }
    return ok(result.data);
  },

  async createLicense(
    actor: LicenseActor,
    data: CreateLicenseInput,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<LicenseResult<LicenseCreateResult>> {
    const actorResult = requireProfessionalLicenseActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }
    const result = await licensesRepository.createLicense(
      actorResult.data.userId,
      data,
      metadata,
    );
    if ("error" in result) {
      if (result.error === "asset_not_found")
        return err({
          error: "asset_not_found",
          message: "Asset not found",
          status: 404,
        });
      if (result.error === "asset_forbidden")
        return err({
          error: "asset_forbidden",
          message: "Unauthorized access to asset",
          status: 403,
        });
      if (result.error === "limit_exceeded")
        return err({
          error: "limit_exceeded",
          message: "Maximum licenses per professional exceeded",
          status: 400,
        });
      return err({
        error: "duplicate",
        message: "A license with this authority and number already exists",
        status: 409,
      });
    }

    // Publish submitted event to NATS (fire-and-forget)
    publishLicenseEvent({
      licenseId: result.data.id,
      professionalId: actor.userId,
      authority: data.authority,
      licenseNumber: data.licenseNumber,
      previousStatus: "PENDING",
      newStatus: "PENDING",
      action: "submitted",
      correlationId: actor.correlationId ?? "",
      ...(result.data.validUntil ? { validUntil: result.data.validUntil } : {}),
    }).catch(() => {
      // Silently handled/logged inside the adapter
    });

    return ok(result.data);
  },

  async updateLicense(
    actor: LicenseActor,
    licenseId: string,
    updateData: UpdateLicenseInput,
  ): Promise<LicenseResult<LicenseUpdateResult>> {
    const actorResult = requireProfessionalLicenseActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }
    const result = await licensesRepository.updateLicense(
      actorResult.data.userId,
      licenseId,
      updateData,
    );
    if ("error" in result) {
      if (result.error === "not_found") return notFound();
      if (result.error === "forbidden") return forbidden();
      if (result.error === "asset_not_found")
        return err({
          error: "asset_not_found",
          message: "Asset not found",
          status: 404,
        });
      return err({
        error: "asset_forbidden",
        message: "Unauthorized access to asset",
        status: 403,
      });
    }
    return ok(result.data);
  },

  async deleteLicense(
    actor: LicenseActor,
    licenseId: string,
  ): Promise<LicenseResult<LicenseDeleteResult>> {
    const actorResult = requireProfessionalLicenseActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }
    const result = await licensesRepository.deleteLicense(
      actorResult.data.userId,
      licenseId,
    );
    if ("error" in result) {
      if (result.error === "not_found") return notFound();
      return forbidden();
    }
    return ok(result.data);
  },
};
