/**
 * Validation schemas for professional-portal inquiries API.
 */
import { z } from "zod";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

export const InquiryStatusSchema = z.enum([
  "PENDING",
  "NEW",
  "CONTACTED",
  "VIEWING_SCHEDULED",
  "OFFER_MADE",
  "CLOSED",
]);

export type InquiryStatus = z.infer<typeof InquiryStatusSchema>;

export interface PropertyInquiry {
  id: string;
  propertyId: string;
  userId?: string | null;
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  message?: string | null;
  status: InquiryStatus;
  notes?: string | null;
  preferredViewingDate?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  property: {
    id: string;
    title: string;
    price: number | string;
    currency: string;
    type: string;
    category: string;
    location: string;
    status: string;
    agentId: string;
  };
  user?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
}

// Flat list representation
export interface PropertyInquiryList {
  id: string;
  propertyTitle: string;
  clientName: string;
  clientPhone: string;
  message: string;
  status: InquiryStatus;
  createdAt: string;
}

export const InquiriesQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/, "Limit must be a number")
    .optional()
    .default(String(DEFAULT_LIMIT))
    .transform((v) => Math.min(parseInt(v, 10), MAX_LIMIT)),
  page: z
    .string()
    .regex(/^\d+$/, "Page must be a number")
    .optional()
    .default("1")
    .transform((v) => Math.max(parseInt(v, 10), 1)),
  status: InquiryStatusSchema.optional(),
});

export type InquiriesQueryInput = z.infer<typeof InquiriesQuerySchema>;

export const UpdateInquirySchema = z.object({
  status: InquiryStatusSchema.optional(),
  notes: z.string().optional(),
  preferredViewingDate: z.string().optional().or(z.literal("")),
});

export type UpdateInquiryInput = z.infer<typeof UpdateInquirySchema>;

export const inquiryListSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  message: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  sender: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  },
  property: {
    select: {
      id: true,
      title: true,
      slug: true,
      location: true,
    },
  },
} as const;

export const inquiryDetailSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  message: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  sender: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
    },
  },
  property: {
    select: {
      id: true,
      title: true,
      slug: true,
      price: true,
      currency: true,
      type: true,
      category: true,
      location: true,
      status: true,
      agentId: true,
    },
  },
} as const;
