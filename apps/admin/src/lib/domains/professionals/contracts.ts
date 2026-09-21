import {
  County,
  VerificationStatus,
  Portfolio,
  Review,
  Project,
  User,
} from "@build/db";
import type { AdminActor } from "@/lib/security/admin-actor";

export type ProfessionalsActor = AdminActor;

export type ProfessionalsDomainErrorCode =
  | "PROFESSIONALS_NOT_FOUND"
  | "PROFESSIONALS_POLICY_DENIED"
  | "PROFESSIONALS_VALIDATION_ERROR"
  | "PROFESSIONALS_PERSISTENCE_ERROR";

export interface ProfessionalsDomainError {
  code: ProfessionalsDomainErrorCode;
  message: string;
}

export interface ProfessionalListItem {
  userId: string;
  companyName: string;
  yearsExperience: number | null;
  city: string | null;
  county: County | null;
  verified: boolean;
  verificationStatus: VerificationStatus;
  createdAt: Date;
  user: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface ProfessionalDetails {
  userId: string;
  companyName: string;
  yearsExperience: number | null;
  bio: string | null;
  website: string | null;
  city: string | null;
  county: County | null;
  country: string | null;
  verified: boolean;
  verificationStatus: VerificationStatus;
  verifiedAt: Date | null;
  verifiedById: string | null;
  verificationNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
    phone: string | null;
  };
  services: Array<{
    id: string;
    name: string;
    slug: string;
    icon: string | null;
  }>;
  certificates: Array<{
    id: string;
    name: string;
    fileUrl: string;
    issuer: string | null;
    expiryDate: Date | null;
  }>;
  portfolios: Portfolio[];
  reviews: Review[];
  projects: Array<Project & { client: User }>;
}

export interface ProfessionalUpdateInput {
  companyName?: string;
  yearsExperience?: number;
  bio?: string;
  website?: string | null;
  city?: string;
  county?: string;
  country?: string;
}

export interface ProfessionalPageResult {
  professionals: ProfessionalListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
