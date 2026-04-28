import { prisma } from "@build/db";
import {
  attachmentListSelect,
  ideaBookDetailSelect,
  ideaBookListSelect,
  type AttachmentQueryInput,
  type CreateIdeaBookInput,
  type IdeaBookQueryInput,
  type UpdateAttachmentInput,
  type UpdateIdeaBookInput,
} from "@/app/lib/validation/idea-books-validation";

export const ideaBooksRepository = {
  async listByClientId(clientId: string, query: IdeaBookQueryInput) {
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

    return {
      ideaBooks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findOwnershipById(bookId: string) {
    return prisma.ideaBook.findUnique({
      where: { id: bookId },
      select: { id: true, clientId: true },
    });
  },

  async findCollaboratorByBookAndUser(bookId: string, userId: string) {
    return prisma.ideaBookCollaborator.findFirst({
      where: { ideaBookId: bookId, userId },
      select: { id: true },
    });
  },

  async findDetailById(bookId: string) {
    return prisma.ideaBook.findUnique({
      where: { id: bookId },
      select: ideaBookDetailSelect,
    });
  },

  async create(clientId: string, slug: string, input: CreateIdeaBookInput) {
    return prisma.ideaBook.create({
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
  },

  async updateById(bookId: string, input: UpdateIdeaBookInput) {
    return prisma.ideaBook.update({
      where: { id: bookId },
      data: input,
      select: ideaBookDetailSelect,
    });
  },

  async deleteById(bookId: string) {
    return prisma.ideaBook.delete({ where: { id: bookId } });
  },

  async findDeleteMetadataById(bookId: string) {
    return prisma.ideaBook.findUnique({
      where: { id: bookId },
      select: {
        clientId: true,
        attachments: { select: { fileKey: true } },
        _count: { select: { attachments: true } },
      },
    });
  },

  async findAssetById(assetId: string) {
    return prisma.asset.findUnique({
      where: { id: assetId },
      select: { id: true },
    });
  },

  async createAttachment(
    clientId: string,
    bookId: string,
    input: {
      assetId?: string;
      sourceUrl?: string;
      fileUrl?: string;
      fileKey?: string;
      mimeType?: string;
      size?: number;
      width?: number;
      height?: number;
      caption?: string;
    },
  ) {
    return prisma.ideaBookAttachment.create({
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
  },

  async listAttachmentsByBookId(bookId: string, query: AttachmentQueryInput) {
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
      attachments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findAttachmentWithOwner(attachmentId: string) {
    return prisma.ideaBookAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        ...attachmentListSelect,
        ideaBook: { select: { clientId: true } },
      },
    });
  },

  async updateAttachment(attachmentId: string, input: UpdateAttachmentInput) {
    return prisma.ideaBookAttachment.update({
      where: { id: attachmentId },
      data: { caption: input.caption },
      select: attachmentListSelect,
    });
  },

  async findAttachmentDeleteMetadata(attachmentId: string) {
    return prisma.ideaBookAttachment.findUnique({
      where: { id: attachmentId },
      select: {
        id: true,
        fileKey: true,
        ideaBook: { select: { clientId: true } },
      },
    });
  },

  async deleteAttachmentById(attachmentId: string) {
    return prisma.ideaBookAttachment.delete({
      where: { id: attachmentId },
    });
  },
};
