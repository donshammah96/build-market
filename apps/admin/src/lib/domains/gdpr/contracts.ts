import type { AdminRole } from "@build/db";
import type { AuditAction, LegalBasis } from "@prisma/client";

// ============================================================================
// Actor
// ============================================================================

export type GdprActor = {
  dbUserId: string;
  clerkId: string;
  adminRole: AdminRole;
};

// ============================================================================
// Input DTOs
// ============================================================================

export type ComplianceQueueFilters = {
  actorId?: string;
  action?: AuditAction;
  legalBasis?: LegalBasis;
  startDate?: Date;
  endDate?: Date;
};

export type LogAdminActionInput = {
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
};

// ============================================================================
// Output DTOs
// ============================================================================

export type AuditLogEntry = {
  id: string;
  actorId: string;
  actorType: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: unknown;
  createdAt: Date;
  actor?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

export type ComplianceQueueResult = AuditLogEntry[];

// ============================================================================
// Domain Errors
// ============================================================================

export type GdprDomainError = {
  code: "GDPR_POLICY_DENIED" | "GDPR_FETCH_FAILED" | "GDPR_AUDIT_WRITE_FAILED";
  message: string;
};
