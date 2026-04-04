import { err, ok } from "@/app/lib/errors/result";
import { normalizeRole } from "@/app/lib/security/roles";
import { documentsRepository } from "./repository";
import type {
  DocumentQueryInput,
  CreateDocumentInput,
  UpdateDocumentInput,
  DocumentActor,
  DocumentResult,
  DocumentListResult,
  DocumentDetail,
  DocumentCreateResult,
  DocumentUpdateResult,
  DocumentDeleteResult,
} from "./contracts";

const PROFESSIONAL_DOCUMENT_ROLES = new Set(["PROFESSIONAL", "ADMIN"]);

function forbidden(message = "Forbidden"): DocumentResult<never> {
  return err({ error: "forbidden", message, status: 403 });
}

function notFound(message = "Document not found"): DocumentResult<never> {
  return err({ error: "not_found", message, status: 404 });
}

function requireProfessionalDocumentActor(
  actor: DocumentActor,
): DocumentResult<{ userId: string }> {
  const role = normalizeRole(actor.role);
  if (!role || !PROFESSIONAL_DOCUMENT_ROLES.has(role)) {
    return forbidden();
  }
  return ok({ userId: actor.userId });
}

export const documentsService = {
  async getDocuments(
    actor: DocumentActor,
    query: DocumentQueryInput,
  ): Promise<DocumentResult<DocumentListResult>> {
    const actorResult = requireProfessionalDocumentActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }
    const documents = await documentsRepository.getDocuments(
      actorResult.data.userId,
      query,
    );
    return ok(documents);
  },

  async getDocumentById(
    actor: DocumentActor,
    documentId: string,
  ): Promise<DocumentResult<DocumentDetail>> {
    const actorResult = requireProfessionalDocumentActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }
    const result = await documentsRepository.getDocumentById(
      actorResult.data.userId,
      documentId,
    );
    if ("error" in result) {
      if (result.error === "not_found") return notFound();
      return forbidden();
    }
    return ok(result.data);
  },

  async createDocument(
    actor: DocumentActor,
    data: CreateDocumentInput,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<DocumentResult<DocumentCreateResult>> {
    const actorResult = requireProfessionalDocumentActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }
    const result = await documentsRepository.createDocument(
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
        message: "Maximum documents per professional exceeded",
        status: 400,
      });
    }
    return ok(result.data);
  },

  async updateDocument(
    actor: DocumentActor,
    documentId: string,
    updateData: UpdateDocumentInput,
  ): Promise<DocumentResult<DocumentUpdateResult>> {
    const actorResult = requireProfessionalDocumentActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }
    const result = await documentsRepository.updateDocument(
      actorResult.data.userId,
      documentId,
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

  async deleteDocument(
    actor: DocumentActor,
    documentId: string,
  ): Promise<DocumentResult<DocumentDeleteResult>> {
    const actorResult = requireProfessionalDocumentActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }
    const result = await documentsRepository.deleteDocument(
      actorResult.data.userId,
      documentId,
    );
    if ("error" in result) {
      if (result.error === "not_found") return notFound();
      return forbidden();
    }
    return ok(result.data);
  },
};
