/**
 * Idea Books Validation Schemas and Prisma Select Objects
 *
 * Aligned with schema models: IdeaBook, IdeaBookCollaborator,
 * IdeaBookAttachment, SavedProduct, SavedProject, SavedImage.
 * Enums: IdeaBookCategory, IdeaBookPrivacy.
 */
import { z } from "zod";
import { IdeaBookCategory, IdeaBookPrivacy } from "@prisma/client";

// =============================================================================
// Enum Schemas
// =============================================================================

export const IdeaBookCategorySchema = z.nativeEnum(IdeaBookCategory);
export const IdeaBookPrivacySchema = z.nativeEnum(IdeaBookPrivacy);

// =============================================================================
// Query Schemas
// =============================================================================

export const IdeaBookQuerySchema = z.object({
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1))
    .optional()
    .default(1),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(50))
    .optional()
    .default(20),
  search: z.string().max(200).optional(),
  category: IdeaBookCategorySchema.optional(),
});

export const AttachmentQuerySchema = z.object({
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1))
    .optional()
    .default(1),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional()
    .default(50),
});

// =============================================================================
// Mutation Schemas
// =============================================================================

export const CreateIdeaBookSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().max(2000).optional(),
  category: IdeaBookCategorySchema.optional().default("WHOLE_HOUSE"),
  privacy: IdeaBookPrivacySchema.optional().default("PUBLIC"),
});

export const UpdateIdeaBookSchema = z.object({
  title: z.string().min(3).max(100).optional(),
  description: z.string().max(2000).optional(),
  category: IdeaBookCategorySchema.optional(),
  privacy: IdeaBookPrivacySchema.optional(),
});

/**
 * Attachment creation schema.
 *
 * Supports two modes:
 * 1. Asset-based (preferred): pass `assetId` referencing a centralized Asset record.
 * 2. Legacy file fields: pass `fileUrl`, `fileKey`, `mimeType`, `size` directly.
 *
 * At least one of `assetId` or `fileUrl` must be provided.
 */
export const AddAttachmentSchema = z
  .object({
    assetId: z.string().uuid().optional(),
    sourceUrl: z.string().url().optional(),
    fileUrl: z.string().url().optional(),
    fileKey: z.string().optional(),
    mimeType: z.string().max(100).optional(),
    size: z.number().int().positive().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    caption: z.string().max(500).optional(),
  })
  .refine((data) => data.assetId || data.fileUrl, {
    message: "Either assetId or fileUrl is required",
  });

export const UpdateAttachmentSchema = z.object({
  caption: z.string().max(500).optional().nullable(),
});

export type IdeaBookQueryInput = z.infer<typeof IdeaBookQuerySchema>;
export type AttachmentQueryInput = z.infer<typeof AttachmentQuerySchema>;
export type CreateIdeaBookInput = z.infer<typeof CreateIdeaBookSchema>;
export type UpdateIdeaBookInput = z.infer<typeof UpdateIdeaBookSchema>;
export type AddAttachmentInput = z.infer<typeof AddAttachmentSchema>;
export type UpdateAttachmentInput = z.infer<typeof UpdateAttachmentSchema>;

// =============================================================================
// Prisma Select Objects
// =============================================================================

export const ideaBookListSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  category: true,
  privacy: true,
  viewCount: true,
  likes: true,
  createdAt: true,
  updatedAt: true,
  attachments: {
    orderBy: { createdAt: "desc" as const },
    take: 5,
    select: {
      id: true,
      fileUrl: true,
      sourceUrl: true,
      caption: true,
      mimeType: true,
      asset: {
        select: {
          id: true,
          cdnUrl: true,
          thumbnailUrl: true,
          originalName: true,
          mimeType: true,
        },
      },
    },
  },
  _count: {
    select: {
      collaborators: true,
      attachments: true,
      savedProducts: true,
      savedProjects: true,
      savedImages: true,
    },
  },
} as const;

export const ideaBookDetailSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  category: true,
  privacy: true,
  viewCount: true,
  likes: true,
  createdAt: true,
  updatedAt: true,
  attachments: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      sourceUrl: true,
      fileUrl: true,
      fileKey: true,
      mimeType: true,
      size: true,
      width: true,
      height: true,
      caption: true,
      createdAt: true,
      updatedAt: true,
      asset: {
        select: {
          id: true,
          cdnUrl: true,
          thumbnailUrl: true,
          originalName: true,
          mimeType: true,
          size: true,
        },
      },
    },
  },
  collaborators: {
    select: {
      id: true,
      userId: true,
      canEdit: true,
      addedAt: true,
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
        },
      },
    },
  },
  _count: {
    select: {
      collaborators: true,
      attachments: true,
      savedProducts: true,
      savedProjects: true,
      savedImages: true,
    },
  },
} as const;

export const attachmentListSelect = {
  id: true,
  sourceUrl: true,
  fileUrl: true,
  fileKey: true,
  mimeType: true,
  size: true,
  width: true,
  height: true,
  caption: true,
  createdAt: true,
  updatedAt: true,
  asset: {
    select: {
      id: true,
      cdnUrl: true,
      thumbnailUrl: true,
      originalName: true,
      mimeType: true,
      size: true,
    },
  },
} as const;

// =============================================================================
// Configuration
// =============================================================================

export const IDEA_BOOK_CONFIG = {
  MAX_BODY_SIZE: 32 * 1024, // 32KB
  MAX_ATTACHMENTS_PREVIEW: 5,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 50,
} as const;
