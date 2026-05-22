import { beforeEach, describe, expect, it, vi } from "vitest";

const repositoryMocks = vi.hoisted(() => ({
  listByClientId: vi.fn(),
  findOwnershipById: vi.fn(),
  findCollaboratorByBookAndUser: vi.fn(),
  findDetailById: vi.fn(),
  create: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  findDeleteMetadataById: vi.fn(),
  findAssetById: vi.fn(),
  createAttachment: vi.fn(),
  listAttachmentsByBookId: vi.fn(),
  findAttachmentWithOwner: vi.fn(),
  updateAttachment: vi.fn(),
  findAttachmentDeleteMetadata: vi.fn(),
  deleteAttachmentById: vi.fn(),
}));

vi.mock("@/app/lib/domains/idea-books/repository", () => ({
  ideaBooksRepository: repositoryMocks,
}));

import { ideaBooksService } from "@/app/lib/domains/idea-books/service";

describe("ideaBooksService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks attachment listing when actor does not own the idea book", async () => {
    repositoryMocks.findOwnershipById.mockResolvedValue({
      id: "book_1",
      clientId: "owner_2",
    });

    const result = await ideaBooksService.listAttachments(
      { userId: "owner_1", role: "client" },
      "book_1",
      { page: 1, limit: 20 },
    );

    expect(result).toEqual({
      ok: false,
      error: "forbidden",
      message: "Forbidden",
      status: 403,
    });
    expect(repositoryMocks.listAttachmentsByBookId).not.toHaveBeenCalled();
  });

  it("returns attachment detail without leaking parent ownership shape", async () => {
    repositoryMocks.findAttachmentWithOwner.mockResolvedValue({
      id: "att_1",
      sourceUrl: null,
      fileUrl: "https://cdn.example.com/file.jpg",
      fileKey: "file-key",
      mimeType: "image/jpeg",
      size: 100,
      width: 1200,
      height: 800,
      caption: "cover",
      uploadedById: "owner_1",
      createdAt: new Date("2026-03-13T10:00:00.000Z"),
      updatedAt: new Date("2026-03-13T10:00:00.000Z"),
      asset: { cdnUrl: "https://cdn.example.com/file.jpg" },
      ideaBook: { clientId: "owner_1" },
    });

    const result = await ideaBooksService.getAttachmentById(
      { userId: "owner_1", role: "client" },
      "att_1",
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data).toMatchObject({
      id: "att_1",
      fileUrl: "https://cdn.example.com/file.jpg",
    });
    expect(result.data).not.toHaveProperty("ideaBook");
  });
});
