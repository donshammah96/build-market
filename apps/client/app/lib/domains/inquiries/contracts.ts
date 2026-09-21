import { z } from "zod";
import type { AppRole } from "@/app/lib/security/roles";
import type { DomainError, Result } from "@/app/lib/errors/result";
import {
  InquiriesQuerySchema as InquiriesQuerySchemaValue,
  UpdateInquirySchema as UpdateInquirySchemaValue,
} from "@/app/lib/validation/inquiries-validation";

export {
  InquiriesQuerySchemaValue as InquiriesQuerySchema,
  UpdateInquirySchemaValue as UpdateInquirySchema,
};

export type InquiriesQueryInput = z.infer<typeof InquiriesQuerySchemaValue>;
export type UpdateInquiryInput = z.infer<typeof UpdateInquirySchemaValue>;

export type InquiryActor = {
  userId: string;
  role?: AppRole | string | null;
};

export type InquiryDomainErrorCode =
  "not_found" | "forbidden" | "conflict" | "invalid_input" | "internal";

export type InquiryDomainError = DomainError<InquiryDomainErrorCode>;
export type InquiryResult<T> = Result<T, InquiryDomainError>;

export type InquiryListItem = {
  id: string;
  property: {
    id: string;
    title: string;
    slug: string;
    location: string;
  };
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  message: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type InquiryListResult = {
  data: InquiryListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type InquiryDetailResult = {
  id: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  message: string | null;
  status: string;
  notes: string | null;
  preferredViewingDate: string | null;
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  property: {
    id: string;
    title: string;
    slug: string;
    price: number;
    currency: string;
    type: string;
    category: string;
    location: string;
    status: string;
  };
};

export type InquiryDeleteResult = {
  message: string;
};
