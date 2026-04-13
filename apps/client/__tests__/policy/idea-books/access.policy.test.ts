import { beforeEach, describe, expect, it, vi } from "vitest";
import { ideaBooksService } from "@/app/lib/domains/idea-books/service";

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

const OWNER_ACTOR = { userId: "owner-user-1", role: "client" as const };
const COLLABORATOR_ACTOR = {
  userId: "collaborator-user-1",
  role: "client" as const,
};
const OUTSIDER_ACTOR = { userId: "outsider-user-1", role: "client" as const };

function buildDetailRecord(privacy: "PRIVATE" | "PUBLIC") {
  return {
    id: "book-1",
    title: "Renovation Board",
    slug: "renovation-board",
    description: "Inspiration",
    category: "KITCHEN",
    privacy,
    viewCount: 10,
    likes: 2,
    attachments: [],
    collaborators: [],
    createdAt: new Date("2026-04-13T08:00:00.000Z"),
    updatedAt: new Date("2026-04-13T08:10:00.000Z"),
    _count: {
      collaborators: 1,
      attachments: 0,
      savedProducts: 0,
      savedProjects: 0,
      savedImages: 0,
    },
  };
}

describe("Idea books collaborator/privacy policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows collaborator to read private idea book detail", async () => {
    repositoryMocks.findOwnershipById.mockResolvedValue({
      id: "book-1",
      clientId: OWNER_ACTOR.userId,
    });
    repositoryMocks.findCollaboratorByBookAndUser.mockResolvedValue({
      id: "collab-row-1",
    });
    repositoryMocks.findDetailById.mockResolvedValue(
      buildDetailRecord("PRIVATE"),
    );

    const result = await ideaBooksService.getById(COLLABORATOR_ACTOR, "book-1");

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.privacy).toBe("PRIVATE");
    expect(repositoryMocks.findCollaboratorByBookAndUser).toHaveBeenCalledWith(
      "book-1",
      COLLABORATOR_ACTOR.userId,
    );
  });

  it("denies non-collaborator read access to a private idea book", async () => {
    repositoryMocks.findOwnershipById.mockResolvedValue({
      id: "book-1",
      clientId: OWNER_ACTOR.userId,
    });
    repositoryMocks.findCollaboratorByBookAndUser.mockResolvedValue(null);

    const result = await ideaBooksService.getById(OUTSIDER_ACTOR, "book-1");

    expect(result).toMatchObject({
      ok: false,
      error: "forbidden",
      status: 403,
    });
    expect(repositoryMocks.findDetailById).not.toHaveBeenCalled();
  });

  it("denies collaborator privacy mutation (owner-only)", async () => {
    repositoryMocks.findOwnershipById.mockResolvedValue({
      id: "book-1",
      clientId: OWNER_ACTOR.userId,
    });

    const result = await ideaBooksService.update(COLLABORATOR_ACTOR, "book-1", {
      privacy: "PUBLIC",
    });

    expect(result).toMatchObject({
      ok: false,
      error: "forbidden",
      status: 403,
    });
    expect(repositoryMocks.updateById).not.toHaveBeenCalled();
  });

  it("denies collaborator delete on private idea book (owner-only)", async () => {
    repositoryMocks.findDeleteMetadataById.mockResolvedValue({
      clientId: OWNER_ACTOR.userId,
      attachments: [],
      _count: { attachments: 0 },
    });

    const result = await ideaBooksService.delete(COLLABORATOR_ACTOR, "book-1");

    expect(result).toMatchObject({
      ok: false,
      error: "forbidden",
      status: 403,
    });
    expect(repositoryMocks.deleteById).not.toHaveBeenCalled();
  });

  it("permits owner to update privacy", async () => {
    repositoryMocks.findOwnershipById.mockResolvedValue({
      id: "book-1",
      clientId: OWNER_ACTOR.userId,
    });
    repositoryMocks.updateById.mockResolvedValue(buildDetailRecord("PUBLIC"));

    const result = await ideaBooksService.update(OWNER_ACTOR, "book-1", {
      privacy: "PUBLIC",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.privacy).toBe("PUBLIC");
  });
});
