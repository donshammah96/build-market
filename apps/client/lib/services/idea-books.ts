/**
 * Idea Books Service Layer
 *
 * Business logic for idea books and attachments.
 */
import { prisma } from "../db";
import { generateIdeaBookSlug } from "@/app/lib/utils/slug-generator";
import {
  ideaBookListSelect,
  ideaBookDetailSelect,
  attachmentListSelect,
} from "@/app/lib/validation/idea-books-validation";
import type {
  IdeaBookQueryInput,
  AttachmentQueryInput,
  CreateIdeaBookInput,
  UpdateIdeaBookInput,
  AddAttachmentInput,
  UpdateAttachmentInput,
} from "@/app/lib/validation/idea-books-validation";

export type {
  IdeaBookQueryInput,
  AttachmentQueryInput,
  CreateIdeaBookInput,
  UpdateIdeaBookInput,
  AddAttachmentInput,
  UpdateAttachmentInput,
};

// ─── Idea Books ─────────────────────────────────────────────────────────────

export async function listIdeaBooks(
  clientId: string,
  query: IdeaBookQueryInput,
) {
  const { page, limit, search, category } = query;
  const where = {
    clientId,
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" as const } },
            {
              description: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
    ...(category ? { category } : {}),
  };

  const skip = (page - 1) * limit;

  const [ideaBooks, total] = await Promise.all([
    prisma.ideaBook.findMany({
      where,
      select: ideaBookListSelect,
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.ideaBook.count({ where }),
  ]);

  const data = ideaBooks.map((book) => {
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
  });

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getIdeaBookById(clientId: string, bookId: string) {
  const ideaBook = await prisma.ideaBook.findUnique({
    where: { id: bookId },
    select: ideaBookDetailSelect,
  });

  if (!ideaBook) return { error: "not_found" as const };

  const isCollaborator = ideaBook.collaborators.some(
    (c) => c.userId === clientId,
  );
  const owner = await prisma.ideaBook.findUnique({
    where: { id: bookId },
    select: { clientId: true },
  });
  const hasAccess = owner?.clientId === clientId || isCollaborator;

  if (!hasAccess) return { error: "forbidden" as const };

  return {
    data: {
      ...ideaBook,
      collaboratorCount: ideaBook._count.collaborators,
      attachmentCount: ideaBook._count.attachments,
      savedProductCount: ideaBook._count.savedProducts,
      savedProjectCount: ideaBook._count.savedProjects,
      savedImageCount: ideaBook._count.savedImages,
    },
  };
}

export async function createIdeaBook(
  clientId: string,
  input: CreateIdeaBookInput,
) {
  const slug = generateIdeaBookSlug(input.title);
  const ideaBook = await prisma.ideaBook.create({
    data: {
      title: input.title,
      description: input.description,
      category: input.category,
      privacy: input.privacy,
      clientId,
      slug,
    },
    select: ideaBookListSelect,
  });
  return { data: ideaBook };
}

export async function updateIdeaBook(
  clientId: string,
  bookId: string,
  input: UpdateIdeaBookInput,
) {
  const ideaBook = await prisma.ideaBook.findUnique({
    where: { id: bookId },
    select: { clientId: true },
  });

  if (!ideaBook) return { error: "not_found" as const };
  if (ideaBook.clientId !== clientId) return { error: "forbidden" as const };

  const updated = await prisma.ideaBook.update({
    where: { id: bookId },
    data: input,
    select: ideaBookDetailSelect,
  });
  return { data: updated };
}

export async function deleteIdeaBook(clientId: string, bookId: string) {
  const ideaBook = await prisma.ideaBook.findUnique({
    where: { id: bookId },
    select: {
      clientId: true,
      attachments: { select: { fileKey: true } },
      _count: { select: { attachments: true } },
    },
  });

  if (!ideaBook) return { error: "not_found" as const };
  if (ideaBook.clientId !== clientId) return { error: "forbidden" as const };

  const deletedStorageKeys = ideaBook.attachments
    .map((a) => a.fileKey)
    .filter(Boolean) as string[];

  await prisma.ideaBook.delete({ where: { id: bookId } });

  return {
    data: {
      message: "Idea book deleted successfully",
      id: bookId,
      deletedStorageKeys,
      attachmentsDeleted: ideaBook._count.attachments,
    },
  };
}

export async function addAttachment(
  clientId: string,
  bookId: string,
  input: AddAttachmentInput,
) {
  const ideaBook = await prisma.ideaBook.findUnique({
    where: { id: bookId },
    select: { clientId: true },
  });

  if (!ideaBook) return { error: "not_found" as const };
  if (ideaBook.clientId !== clientId) return { error: "forbidden" as const };

  if (input.assetId) {
    const asset = await prisma.asset.findUnique({
      where: { id: input.assetId },
      select: { id: true },
    });
    if (!asset) return { error: "asset_not_found" as const };
  }

  const attachment = await prisma.ideaBookAttachment.create({
    data: {
      ideaBookId: bookId,
      assetId: input.assetId,
      sourceUrl: input.sourceUrl,
      fileUrl: input.fileUrl,
      fileKey: input.fileKey,
      mimeType: input.mimeType,
      size: input.size,
      width: input.width,
      height: input.height,
      caption: input.caption,
      uploadedById: clientId,
    },
    select: attachmentListSelect,
  });
  return { data: attachment };
}

// ─── Attachments ────────────────────────────────────────────────────────────

export async function listAttachments(
  clientId: string,
  bookId: string,
  query: AttachmentQueryInput,
) {
  const ideaBook = await prisma.ideaBook.findUnique({
    where: { id: bookId },
    select: { clientId: true },
  });

  if (!ideaBook) return { error: "not_found" as const };
  if (ideaBook.clientId !== clientId) return { error: "forbidden" as const };

  const { page, limit } = query;
  const skip = (page - 1) * limit;

  const [attachments, total] = await Promise.all([
    prisma.ideaBookAttachment.findMany({
      where: { ideaBookId: bookId },
      select: attachmentListSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.ideaBookAttachment.count({ where: { ideaBookId: bookId } }),
  ]);

  return {
    data: {
      data: attachments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
  };
}

export async function getAttachmentById(
  clientId: string,
  attachmentId: string,
) {
  const attachment = await prisma.ideaBookAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      ...attachmentListSelect,
      ideaBook: { select: { clientId: true } },
    },
  });

  if (!attachment) return { error: "not_found" as const };
  if (attachment.ideaBook.clientId !== clientId)
    return { error: "forbidden" as const };

  const { ideaBook: _ib, ...rest } = attachment;
  return { data: rest };
}

export async function updateAttachment(
  clientId: string,
  attachmentId: string,
  input: UpdateAttachmentInput,
) {
  const attachment = await prisma.ideaBookAttachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, ideaBook: { select: { clientId: true } } },
  });

  if (!attachment) return { error: "not_found" as const };
  if (attachment.ideaBook.clientId !== clientId)
    return { error: "forbidden" as const };

  const updated = await prisma.ideaBookAttachment.update({
    where: { id: attachmentId },
    data: { caption: input.caption },
    select: attachmentListSelect,
  });
  return { data: updated };
}

export async function deleteAttachment(clientId: string, attachmentId: string) {
  const attachment = await prisma.ideaBookAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      id: true,
      fileKey: true,
      ideaBook: { select: { clientId: true } },
    },
  });

  if (!attachment) return { error: "not_found" as const };
  if (attachment.ideaBook.clientId !== clientId)
    return { error: "forbidden" as const };

  const deletedKey = attachment.fileKey;

  await prisma.ideaBookAttachment.delete({
    where: { id: attachmentId },
  });

  return {
    data: {
      message: "Attachment deleted successfully",
      id: attachmentId,
      deletedKey,
    },
  };
}
