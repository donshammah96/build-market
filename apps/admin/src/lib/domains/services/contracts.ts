import { Profession } from "@build/db";
import type { AdminActor } from "@/lib/security/admin-actor";

export type ServicesActor = AdminActor;

export type ServicesDomainErrorCode =
  | "SERVICES_NOT_FOUND"
  | "SERVICES_POLICY_DENIED"
  | "SERVICES_DELETE_DENIED"
  | "SERVICES_VALIDATION_ERROR"
  | "SERVICES_PERSISTENCE_ERROR";

export interface ServicesDomainError {
  code: ServicesDomainErrorCode;
  message: string;
}

export interface ServiceFilterInput {
  page?: number | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  professionType?: string | undefined;
  isActive?: boolean | undefined;
  sortBy?: "name" | "createdAt" | "sortOrder" | undefined;
  sortOrder?: "asc" | "desc" | undefined;
}

export interface ServiceFilterQuery {
  page: number;
  limit: number;
  skip: number;
  search?: string | undefined;
  professionType?: Profession | undefined;
  isActive?: boolean | undefined;
  sortBy: "name" | "createdAt" | "sortOrder";
  sortOrder: "asc" | "desc";
}

export interface ServiceCategoryListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  professionType: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  _count: {
    professionals: number;
  };
}

export interface ServiceCategoryDetails {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  professionType: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  professionals: Array<{
    userId: string;
    companyName: string;
    verified: boolean;
  }>;
  _count: {
    professionals: number;
  };
}

export interface CreateServiceInput {
  name: string;
  description?: string | undefined;
  icon?: string | undefined;
  professionType?: string | undefined;
  isActive?: boolean | undefined;
  sortOrder?: number | undefined;
}

export interface UpdateServiceInput {
  name?: string | undefined;
  description?: string | undefined;
  icon?: string | undefined;
  professionType?: string | undefined;
  isActive?: boolean | undefined;
  sortOrder?: number | undefined;
}

export interface ServiceStatsResult {
  total: number;
  active: number;
  inactive: number;
  byProfessionType: { professionType: string; count: number }[];
  topCategories: { id: string; name: string; professionalCount: number }[];
}

export interface ServicePageResult {
  categories: ServiceCategoryListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filters: ServiceFilterQuery;
}
