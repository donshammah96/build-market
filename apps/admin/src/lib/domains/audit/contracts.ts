import type { AdminRole } from "@build/db";

export type AuditActor = {
  dbUserId: string;
  clerkId: string;
  adminRole: AdminRole;
};

export type AuditLogSortOrder = "asc" | "desc";

export type AuditLogInput = Partial<{
  page: number;
  limit: number;
  search: string;
  action: string;
  targetType: string;
  adminId: string;
  dateFrom: string;
  dateTo: string;
  sortOrder: AuditLogSortOrder;
}>;

export type AuditLogQuery = {
  page: number;
  limit: number;
  skip: number;
  sortOrder: AuditLogSortOrder;
  search?: string;
  action?: string;
  targetType?: string;
  adminId?: string;
  dateFrom?: Date;
  dateTo?: Date;
};

export type AuditLogEntry = {
  id: string;
  adminId: string | null;
  adminEmail: string;
  adminName: string;
  adminRole: string;
  action: string;
  targetType: string;
  targetId: string;
  severity: string;
  status: string;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: Date;
};

export type AuditLogPage = {
  logs: AuditLogEntry[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  filters: AuditLogQuery;
};

export type AuditLogStats = {
  totalLogs: number;
  todayLogs: number;
  byAction: Array<{ action: string; count: number }>;
  byTargetType: Array<{ targetType: string; count: number }>;
  recentActivity: AuditLogEntry[];
};

/**
 * CSV-friendly export row. adminName is a display alias already stored in
 * the audit record — it is not a live PII lookup.
 */
export type AuditExportEntry = {
  id: string;
  adminName: string;
  adminRole: string;
  action: string;
  targetType: string;
  targetId: string;
  severity: string;
  status: string;
  reason: string;
  ipAddress: string;
  createdAt: string; // ISO-8601 for CSV serialisation
};

export type AuditExportPage = {
  data: AuditExportEntry[];
  count: number;
};

/** Maximum rows returnable in a single export call. */
export const AUDIT_EXPORT_MAX_ROWS = 5_000;

export type AuditDomainErrorCode =
  | "AUDIT_INVALID_FILTER"
  | "AUDIT_POLICY_DENIED"
  | "AUDIT_EXPORT_LIMIT_EXCEEDED";

export type AuditDomainError = {
  code: AuditDomainErrorCode;
  message: string;
};
