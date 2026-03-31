import { err, ok } from "@/app/lib/errors/result";
import { normalizeRole } from "@/app/lib/security/roles";
import { certificatesRepository } from "./repository";
import type {
  CertificateActor,
  CertificateQueryInput,
  CreateCertificateInput,
  UpdateCertificateInput,
  CertificateResult,
  CertificateListResult,
  CertificateDetail,
  CertificateCreateResult,
  CertificateUpdateResult,
  CertificateDeleteResult,
} from "./contracts";

const CERTIFICATE_ROLES = new Set(["professional", "admin"]);

function forbidden(message = "Forbidden"): CertificateResult<never> {
  return err({ error: "forbidden", message, status: 403 });
}

function notFound(message = "Certificate not found"): CertificateResult<never> {
  return err({ error: "not_found", message, status: 404 });
}

function requireProfessionalCertificateActor(
  actor: CertificateActor,
): CertificateResult<{ userId: string }> {
  const role = normalizeRole(actor.role);
  if (!role || !CERTIFICATE_ROLES.has(role)) {
    return forbidden();
  }
  return ok({ userId: actor.userId });
}

export const certificatesService = {
  async getCertificates(
    actor: CertificateActor,
    query: CertificateQueryInput,
  ): Promise<CertificateResult<CertificateListResult>> {
    const actorResult = requireProfessionalCertificateActor(actor);
    if (!actorResult.ok) return actorResult;
    const data = await certificatesRepository.getCertificates(
      actorResult.data.userId,
      query,
    );
    return ok(data);
  },

  async getCertificateById(
    actor: CertificateActor,
    certificateId: string,
  ): Promise<CertificateResult<CertificateDetail>> {
    const actorResult = requireProfessionalCertificateActor(actor);
    if (!actorResult.ok) return actorResult;
    const result = await certificatesRepository.getCertificateById(
      actorResult.data.userId,
      certificateId,
    );
    if (result.success === false) {
      if (result.error === "not_found") return notFound();
      return forbidden();
    }
    return ok(result.data);
  },

  async createCertificate(
    actor: CertificateActor,
    data: CreateCertificateInput,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<CertificateResult<CertificateCreateResult>> {
    const actorResult = requireProfessionalCertificateActor(actor);
    if (!actorResult.ok) return actorResult;
    const result = await certificatesRepository.createCertificate(
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
      return err({
        error: "limit_exceeded",
        message: "Maximum certificates per professional exceeded",
        status: 400,
      });
    }
    return ok(result.data);
  },

  async updateCertificate(
    actor: CertificateActor,
    certificateId: string,
    updateData: UpdateCertificateInput,
  ): Promise<CertificateResult<CertificateUpdateResult>> {
    const actorResult = requireProfessionalCertificateActor(actor);
    if (!actorResult.ok) return actorResult;
    const result = await certificatesRepository.updateCertificate(
      actorResult.data.userId,
      certificateId,
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

  async deleteCertificate(
    actor: CertificateActor,
    certificateId: string,
  ): Promise<CertificateResult<CertificateDeleteResult>> {
    const actorResult = requireProfessionalCertificateActor(actor);
    if (!actorResult.ok) return actorResult;
    const result = await certificatesRepository.deleteCertificate(
      actorResult.data.userId,
      certificateId,
    );
    if ("error" in result) {
      if (result.error === "not_found") return notFound();
      return forbidden();
    }
    return ok(result.data);
  },
};
