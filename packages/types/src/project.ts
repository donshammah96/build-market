import { z } from 'zod';
import { CountyEnum } from './auth';

// ========================================================
// ENUMS
// ========================================================

export const ProjectTypeEnum = z.enum([
  "RESIDENTIAL", "COMMERCIAL", "RENOVATION", "INTERIOR_DESIGN", "LANDSCAPING", "INFRASTRUCTURE", "OTHER"
]);
export type ProjectType = z.infer<typeof ProjectTypeEnum>;

export const ProjectStatusEnum = z.enum([
  "PLANNING", "IN_PROGRESS", "PAUSED", "COMPLETED", "ARCHIVED", "CANCELLED"
]);
export type ProjectStatus = z.infer<typeof ProjectStatusEnum>;

export const ContractTypeEnum = z.enum([
  "LABOR_ONLY", "FULL_CONTRACT", "DESIGN_ONLY", "CONSULTANCY"
]);
export type ContractType = z.infer<typeof ContractTypeEnum>;

export const MilestoneStatusEnum = z.enum([
  "PENDING", "IN_PROGRESS", "IN_REVIEW", "COMPLETED", "DELAYED"
]);
export type MilestoneStatus = z.infer<typeof MilestoneStatusEnum>;

export const ApprovalStatusEnum = z.enum([
  "PENDING", "APPROVED", "REJECTED", "REQUESTED_CHANGE"
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusEnum>;

export const ProjectDocumentTypeEnum = z.enum([
  "CONTRACT_AGREEMENT", "BOQ", "INVOICE", "RECEIPT", 
  "BLUEPRINT_ARCHITECTURAL", "BLUEPRINT_STRUCTURAL", 
  "NCA_PERMIT", "SITE_INSTRUCTION", "HANDOVER_CERTIFICATE", "OTHER"
]);
export type ProjectDocumentType = z.infer<typeof ProjectDocumentTypeEnum>;

export const ProjectImageCategoryEnum = z.enum([
  "SITE_PREPARATION", "FOUNDATION", "WALLING", "ROOFING", 
  "FINISHING", "SNAG_LIST", "MATERIAL_DELIVERY", "OTHER"
]);
export type ProjectImageCategory = z.infer<typeof ProjectImageCategoryEnum>;

export const IdeaBookCategoryEnum = z.enum([
  "LIVING_ROOM", "KITCHEN", "BATHROOM", "BEDROOM", 
  "OUTDOOR_LANDSCAPING", "COMMERCIAL_OFFICE", "RETAIL_SHOP", "WHOLE_HOUSE"
]);
export type IdeaBookCategory = z.infer<typeof IdeaBookCategoryEnum>;

export const IdeaBookPrivacyEnum = z.enum(["PUBLIC", "SHARED_LINK", "PRIVATE"]);
export type IdeaBookPrivacy = z.infer<typeof IdeaBookPrivacyEnum>;

// ========================================================
// MODELS
// ========================================================

export const ProjectDocumentSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  milestoneId: z.string().optional().nullable(),
  type: ProjectDocumentTypeEnum.default("OTHER"),
  fileUrl: z.string().url(),
  fileKey: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number().int(),
  isVerified: z.boolean().default(false),
  uploadedById: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type ProjectDocument = z.infer<typeof ProjectDocumentSchema>;

export const ProjectImageSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  milestoneId: z.string().optional().nullable(),
  fileUrl: z.string().url(),
  fileKey: z.string(),
  caption: z.string().optional().nullable(),
  mimeType: z.string(),
  size: z.number().int(),
  width: z.number().int().optional().nullable(),
  height: z.number().int().optional().nullable(),
  blurDataUrl: z.string().optional().nullable(),
  category: ProjectImageCategoryEnum.optional().nullable(),
  uploadedById: z.string(),
  createdAt: z.date(),
});
export type ProjectImage = z.infer<typeof ProjectImageSchema>;

export const ProjectMilestoneSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string(),
  title: z.string().min(1, "Milestone title is required"),
  description: z.string().optional().nullable(),
  amount: z.number().optional().nullable(),
  isPaid: z.boolean().default(false),
  dueDate: z.date().optional().nullable(),
  completedAt: z.date().optional().nullable(),
  status: MilestoneStatusEnum.default("PENDING"),
  approvalStatus: ApprovalStatusEnum.default("PENDING"),
  rejectionReason: z.string().optional().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  // Relations
  images: z.array(ProjectImageSchema).optional(),
  documents: z.array(ProjectDocumentSchema).optional(),
});
export type ProjectMilestone = z.infer<typeof ProjectMilestoneSchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string(),
  professionalId: z.string().optional().nullable(),

  title: z.string().min(1, "Project title is required"),
  description: z.string().optional().nullable(),
  type: ProjectTypeEnum.default("RESIDENTIAL"),
  status: ProjectStatusEnum.default("PLANNING"),
  contractType: ContractTypeEnum.optional().nullable(),

  location: z.string().optional().nullable(),
  siteAddress: z.string().optional().nullable(),
  county: CountyEnum.optional().nullable(),
  coordinates: z.unknown().optional().nullable(),

  budgetMin: z.number().optional().nullable(),
  budgetMax: z.number().optional().nullable(),
  agreedPrice: z.number().optional().nullable(),

  startDate: z.date().optional().nullable(),
  endDate: z.date().optional().nullable(),

  createdAt: z.date(),
  updatedAt: z.date(),
  deletedAt: z.date().optional().nullable(),

  // Relations
  milestones: z.array(ProjectMilestoneSchema).optional(),
  documents: z.array(ProjectDocumentSchema).optional(),
  images: z.array(ProjectImageSchema).optional(),
});
export type Project = z.infer<typeof ProjectSchema>;

// ========================================================
// IDEA BOOK
// ========================================================

export const SavedProductSchema = z.object({
  id: z.string().uuid(),
  ideaBookId: z.string(),
  productId: z.string(),
  note: z.string().optional().nullable(),
  savedAt: z.date(),
});

export const SavedProjectSchema = z.object({
  id: z.string().uuid(),
  ideaBookId: z.string(),
  projectId: z.string(),
  note: z.string().optional().nullable(),
  savedAt: z.date(),
});

export const SavedImageSchema = z.object({
  id: z.string().uuid(),
  ideaBookId: z.string(),
  portfolioImageId: z.string(),
  note: z.string().optional().nullable(),
  savedAt: z.date(),
});

export const IdeaBookAttachmentSchema = z.object({
  id: z.string().uuid(),
  ideaBookId: z.string(),
  fileUrl: z.string().url(),
  fileKey: z.string(),
  caption: z.string().optional().nullable(),
  createdAt: z.date(),
});

export const IdeaBookCollaboratorSchema = z.object({
  id: z.string().uuid(),
  ideaBookId: z.string(),
  userId: z.string(),
  canEdit: z.boolean().default(false),
  addedAt: z.date(),
});

export const IdeaBookSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string(),
  title: z.string().min(1, 'Idea book title is required'),
  slug: z.string(),
  description: z.string().optional().nullable(),
  category: IdeaBookCategoryEnum.default("WHOLE_HOUSE"),
  privacy: IdeaBookPrivacyEnum.default("PUBLIC"),
  
  viewCount: z.number().int().default(0),
  likes: z.number().int().default(0),
  
  createdAt: z.date(),
  updatedAt: z.date(),
  
  // Relations
  collaborators: z.array(IdeaBookCollaboratorSchema).optional(),
  savedProducts: z.array(SavedProductSchema).optional(),
  savedProjects: z.array(SavedProjectSchema).optional(),
  savedImages: z.array(SavedImageSchema).optional(),
  attachments: z.array(IdeaBookAttachmentSchema).optional(),
});
export type IdeaBook = z.infer<typeof IdeaBookSchema>;
