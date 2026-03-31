import {
  err,
  ok,
  type DomainError,
  type Result,
} from "@/app/lib/errors/result";
import { generateIdeaBookSlug } from "@/app/lib/utils/slug-generator";
import type {
  AddAttachmentInput,
  AttachmentQueryInput,
  CreateIdeaBookInput,
  IdeaBookAttachmentDeleteResultDto,
  IdeaBookAttachmentDto,
  IdeaBookAttachmentListResultDto,
  IdeaBookDeleteResultDto,
  IdeaBookDetailDto,
  IdeaBookListItemDto,
  IdeaBookQueryInput,
  IdeaBookListResultDto,
  IdeaBooksActor,
  IdeaBooksDomainErrorCode,
  UpdateAttachmentInput,
  UpdateIdeaBookInput,
} from "./contracts";
import { ideaBooksRepository } from "./repository";

type IdeaBooksResult<T> = Result<T, DomainError<IdeaBooksDomainErrorCode>>;

type OwnedIdeaBook = NonNullable<
  Awaited<ReturnType<typeof ideaBooksRepository.findOwnershipById>>
>;

type OwnedAttachment = NonNullable<
  Awaited<ReturnType<typeof ideaBooksRepository.findAttachmentWithOwner>>
>;

type ListRepoBook = Awaited<
  ReturnType<typeof ideaBooksRepository.listByClientId>
>["ideaBooks"][number];

type DetailRepoBook = NonNullable<
  Awaited<ReturnType<typeof ideaBooksRepository.findDetailById>>
>;

function mapListBook(book: ListRepoBook): IdeaBookListItemDto {
  const firstAttachment = book.attachments[0];
  const coverImage =
    firstAttachment?.asset?.cdnUrl ??
    firstAttachment?.fileUrl ??
    firstAttachment?.sourceUrl ??
    null;

  return {
    id: book.id,
    title: book.title,
    slug: book.slug,
    description: book.description,
    category: book.category,
    privacy: book.privacy,
    viewCount: book.viewCount,
    likes: book.likes,
    coverImage,
    attachments: book.attachments,
    collaboratorCount: book._count.collaborators,
    attachmentCount: book._count.attachments,
    savedProductCount: book._count.savedProducts,
    savedProjectCount: book._count.savedProjects,
    savedImageCount: book._count.savedImages,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
  };
}

function mapDetailBook(detail: DetailRepoBook): IdeaBookDetailDto {
  return {
    ...detail,
    collaboratorCount: detail._count.collaborators,
    attachmentCount: detail._count.attachments,
    savedProductCount: detail._count.savedProducts,
    savedProjectCount: detail._count.savedProjects,
    savedImageCount: detail._count.savedImages,
  };
}

async function ensureBookOwned(
  actor: IdeaBooksActor,
  bookId: string,
): Promise<IdeaBooksResult<OwnedIdeaBook>> {
  const ownership = await ideaBooksRepository.findOwnershipById(bookId);
  if (!ownership) {
    return err({
      error: "not_found",
      message: "Idea book not found",
      status: 404,
    });
  }

  if (ownership.clientId !== actor.userId) {
    return err({ error: "forbidden", message: "Forbidden", status: 403 });
  }

  return ok(ownership);
}

async function ensureAttachmentOwned(
  actor: IdeaBooksActor,
  attachmentId: string,
): Promise<IdeaBooksResult<OwnedAttachment>> {
  const attachment =
    await ideaBooksRepository.findAttachmentWithOwner(attachmentId);

  if (!attachment) {
    return err({
      error: "not_found",
      message: "Attachment not found",
      status: 404,
    });
  }

  if (attachment.ideaBook.clientId !== actor.userId) {
    return err({ error: "forbidden", message: "Forbidden", status: 403 });
  }

  return ok(attachment);
}

export const ideaBooksService = {
  async list(
    actor: IdeaBooksActor,
    query: IdeaBookQueryInput,
  ): Promise<IdeaBooksResult<IdeaBookListResultDto>> {
    const { ideaBooks, pagination } = await ideaBooksRepository.listByClientId(
      actor.userId,
      query,
    );

    const data = ideaBooks.map(mapListBook);

    return ok({ data, pagination });
  },

  async getById(
    actor: IdeaBooksActor,
    bookId: string,
  ): Promise<IdeaBooksResult<IdeaBookDetailDto>> {
    const ownership = await ideaBooksRepository.findOwnershipById(bookId);
    if (!ownership) {
      return err({
        error: "not_found",
        message: "Idea book not found",
        status: 404,
      });
    }

    const isOwner = ownership.clientId === actor.userId;
    if (!isOwner) {
      const collaborator =
        await ideaBooksRepository.findCollaboratorByBookAndUser(
          bookId,
          actor.userId,
        );
      if (!collaborator) {
        return err({ error: "forbidden", message: "Forbidden", status: 403 });
      }
    }

    const detail = await ideaBooksRepository.findDetailById(bookId);
    if (!detail) {
      return err({
        error: "not_found",
        message: "Idea book not found",
        status: 404,
      });
    }

    return ok(mapDetailBook(detail));
  },

  async create(
    actor: IdeaBooksActor,
    input: CreateIdeaBookInput,
  ): Promise<IdeaBooksResult<IdeaBookListItemDto>> {
    const slug = generateIdeaBookSlug(input.title);
    const created = await ideaBooksRepository.create(actor.userId, slug, input);
    return ok(mapListBook(created));
  },

  async update(
    actor: IdeaBooksActor,
    bookId: string,
    input: UpdateIdeaBookInput,
  ): Promise<IdeaBooksResult<IdeaBookDetailDto>> {
    const owned = await ensureBookOwned(actor, bookId);
    if (!owned.ok) {
      return owned;
    }

    const updated = await ideaBooksRepository.updateById(bookId, input);
    return ok(mapDetailBook(updated));
  },

  async delete(
    actor: IdeaBooksActor,
    bookId: string,
  ): Promise<IdeaBooksResult<IdeaBookDeleteResultDto>> {
    const metadata = await ideaBooksRepository.findDeleteMetadataById(bookId);
    if (!metadata) {
      return err({
        error: "not_found",
        message: "Idea book not found",
        status: 404,
      });
    }

    if (metadata.clientId !== actor.userId) {
      return err({ error: "forbidden", message: "Forbidden", status: 403 });
    }

    const deletedStorageKeys = metadata.attachments
      .map((attachment) => attachment.fileKey)
      .filter(Boolean) as string[];

    await ideaBooksRepository.deleteById(bookId);

    return ok({
      message: "Idea book deleted successfully",
      id: bookId,
      deletedStorageKeys,
      attachmentsDeleted: metadata._count.attachments,
    });
  },

  async addAttachment(
    actor: IdeaBooksActor,
    bookId: string,
    input: AddAttachmentInput,
  ): Promise<IdeaBooksResult<IdeaBookAttachmentDto>> {
    const owned = await ensureBookOwned(actor, bookId);
    if (!owned.ok) {
      return owned;
    }

    if (input.assetId) {
      const asset = await ideaBooksRepository.findAssetById(input.assetId);
      if (!asset) {
        return err({
          error: "asset_not_found",
          message: "Asset not found",
          status: 400,
        });
      }
    }

    const created = await ideaBooksRepository.createAttachment(
      actor.userId,
      bookId,
      input,
    );
    return ok(created);
  },

  async listAttachments(
    actor: IdeaBooksActor,
    bookId: string,
    query: AttachmentQueryInput,
  ): Promise<IdeaBooksResult<IdeaBookAttachmentListResultDto>> {
    const owned = await ensureBookOwned(actor, bookId);
    if (!owned.ok) {
      return owned;
    }

    const { attachments, pagination } =
      await ideaBooksRepository.listAttachmentsByBookId(bookId, query);
    return ok({ data: attachments, pagination });
  },

  async getAttachmentById(
    actor: IdeaBooksActor,
    attachmentId: string,
  ): Promise<IdeaBooksResult<IdeaBookAttachmentDto>> {
    const owned = await ensureAttachmentOwned(actor, attachmentId);
    if (!owned.ok) {
      return owned;
    }

    const { ideaBook, ...attachment } = owned.data;
    void ideaBook;
    return ok(attachment);
  },

  async updateAttachment(
    actor: IdeaBooksActor,
    attachmentId: string,
    input: UpdateAttachmentInput,
  ): Promise<IdeaBooksResult<IdeaBookAttachmentDto>> {
    const owned = await ensureAttachmentOwned(actor, attachmentId);
    if (!owned.ok) {
      return owned;
    }

    const updated = await ideaBooksRepository.updateAttachment(
      attachmentId,
      input,
    );
    return ok(updated);
  },

  async deleteAttachment(
    actor: IdeaBooksActor,
    attachmentId: string,
  ): Promise<IdeaBooksResult<IdeaBookAttachmentDeleteResultDto>> {
    const attachment =
      await ideaBooksRepository.findAttachmentDeleteMetadata(attachmentId);

    if (!attachment) {
      return err({
        error: "not_found",
        message: "Attachment not found",
        status: 404,
      });
    }

    if (attachment.ideaBook.clientId !== actor.userId) {
      return err({ error: "forbidden", message: "Forbidden", status: 403 });
    }

    const deletedKey = attachment.fileKey;

    await ideaBooksRepository.deleteAttachmentById(attachmentId);

    return ok({
      message: "Attachment deleted successfully",
      id: attachmentId,
      deletedKey,
    });
  },
};
