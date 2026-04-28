import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  getDocuments: vi.fn(),
  getDocumentById: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
}));

vi.mock("@/app/lib/domains/documents/repository", () => ({
  documentsRepository: repositoryMocks,
}));

import { documentsService } from "@/app/lib/domains/documents/service";

describe("documentsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects document reads for actors without a professional-capable role", async () => {
    const result = await documentsService.getDocuments(
      { userId: "user_1", role: "client" },
      {},
    );

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });
    expect(repositoryMocks.getDocuments).not.toHaveBeenCalled();
  });

  it("returns document list for professional actor", async () => {
    const mockDocs = [
      {
        id: "doc_1",
        category: "ID_OR_PASSPORT",
        title: "Passport",
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
        asset: {
          id: "a1",
          cdnUrl: "/url",
          originalName: "p.pdf",
          mimeType: "application/pdf",
          size: 1024,
        },
      },
    ];
    repositoryMocks.getDocuments.mockResolvedValue(mockDocs);

    const result = await documentsService.getDocuments(
      { userId: "pro_1", role: "professional" },
      { category: "ID_OR_PASSPORT" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockDocs);
    }
    expect(repositoryMocks.getDocuments).toHaveBeenCalledWith("pro_1", {
      category: "ID_OR_PASSPORT",
    });
  });

  it("maps not_found from repository to Result err", async () => {
    repositoryMocks.getDocumentById.mockResolvedValue({ error: "not_found" });

    const result = await documentsService.getDocumentById(
      { userId: "pro_1", role: "professional" },
      "doc_missing",
    );

    expect(result).toEqual({
      ok: false,
      error: "not_found",
      message: "Document not found",
      status: 404,
    });
  });

  it("maps forbidden from repository to Result err", async () => {
    repositoryMocks.getDocumentById.mockResolvedValue({ error: "forbidden" });

    const result = await documentsService.getDocumentById(
      { userId: "pro_1", role: "professional" },
      "doc_other",
    );

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });
  });

  it("returns document detail for owner", async () => {
    const mockDoc = {
      id: "doc_1",
      category: "ID_OR_PASSPORT",
      title: "Passport",
      status: "PENDING",
      asset: {
        id: "a1",
        cdnUrl: "/url",
        originalName: "p.pdf",
        mimeType: "application/pdf",
        size: 1024,
      },
      verifiedBy: null,
      deletedAt: null,
    };
    repositoryMocks.getDocumentById.mockResolvedValue({ data: mockDoc });

    const result = await documentsService.getDocumentById(
      { userId: "pro_1", role: "professional" },
      "doc_1",
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockDoc);
    }
  });

  it("maps asset_not_found from create to Result err", async () => {
    repositoryMocks.createDocument.mockResolvedValue({
      error: "asset_not_found",
    });

    const result = await documentsService.createDocument(
      { userId: "pro_1", role: "professional" },
      {
        title: "Doc",
        category: "ID_OR_PASSPORT",
        assetId: "550e8400-e29b-41d4-a716-446655440000",
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("asset_not_found");
      expect(result.status).toBe(404);
    }
  });

  it("maps limit_exceeded from create to Result err", async () => {
    repositoryMocks.createDocument.mockResolvedValue({
      error: "limit_exceeded",
    });

    const result = await documentsService.createDocument(
      { userId: "pro_1", role: "professional" },
      {
        title: "Doc",
        category: "ID_OR_PASSPORT",
        assetId: "550e8400-e29b-41d4-a716-446655440000",
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("limit_exceeded");
      expect(result.status).toBe(400);
    }
  });
});
