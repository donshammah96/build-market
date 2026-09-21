/**
 * @build/verification-domain
 *
 * Canonical Domain Model for Statutory Regulator License Verification,
 * Operations Center Workflows, Confidence Scoring, and Audit Events.
 */

export type VerificationCaseStatus =
  | "QUEUED"
  | "PROCESSING"
  | "NEEDS_MANUAL_REVIEW"
  | "LOW_CONFIDENCE"
  | "REGULATOR_UNAVAILABLE"
  | "AUTO_VERIFIED"
  | "MANUALLY_VERIFIED"
  | "AUTO_REJECTED"
  | "MANUALLY_REJECTED"
  | "DEAD_LETTER";

export type VerificationRolePermission =
  | "VERIFICATION_READ_ONLY"
  | "VERIFICATION_REVIEWER"
  | "VERIFICATION_SENIOR_REVIEWER"
  | "VERIFICATION_COMPLIANCE_OFFICER"
  | "VERIFICATION_AUDITOR";

export type VerificationStatutoryAuthority =
  "EBK" | "BORAQS" | "NCA" | "EARB" | "VRB" | "ISK" | "EPRA";

export type CompoundQueueType =
  | "PENDING"
  | "AUTOMATED_REVIEW"
  | "NEEDS_CHANGES"
  | "ESCALATED"
  | "SLA_BREACHED"
  | "VERIFIED"
  | "REJECTED";

export interface ConfidenceBreakdown {
  nameMatchScore: number;
  registrationNumberMatch: boolean;
  statusMatch: boolean;
  expiryCheckPassed: boolean;
  overallScore: number;
  algorithmVersion: string;
}

export interface RegulatorEvidenceSnapshot {
  rawResponse?: Record<string, unknown>;
  screenshotUrl?: string;
  verifiedAt?: string;
  regulatorNotes?: string;
}

export interface VerificationOpsCaseDTO {
  caseId: string;
  professionalId: string;
  professionalName: string;
  licenseId: string;
  authority: VerificationStatutoryAuthority;
  licenseNumber: string;
  status: VerificationCaseStatus;
  confidenceScore: number;
  confidenceAlgorithmVersion: string;
  confidenceReasons: string[];
  confidenceBreakdown?: ConfidenceBreakdown;
  evidenceSnapshot?: RegulatorEvidenceSnapshot;
  attempts: number;
  maxAttempts: number;
  submittedAt: string;
  completedAt?: string;
  slaDueDate: string;
  isSlaBreached: boolean;
}

export type ManualDecisionOutcome = "APPROVE" | "REJECT" | "REQUEST_MORE_INFO";

export interface RecordManualDecisionCommand {
  caseId: string;
  reviewerId: string;
  outcome: ManualDecisionOutcome;
  rationale: string;
  requiresSeniorApproval?: boolean;
}

export interface ManualDecisionRecordedEvent {
  caseId: string;
  reviewerId: string;
  outcome: ManualDecisionOutcome;
  resultingCaseStatus: VerificationCaseStatus;
  timestamp: string;
}

export interface EvidenceViewedAuditEvent {
  caseId: string;
  viewerId: string;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}
