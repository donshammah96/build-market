export {
  RegulatorVerificationGateway,
  buildRegulatorVerificationJobId,
  REGULATOR_AUTHORITIES,
  type RegulatorAuthority,
  type RegulatorAdapter,
  type RegulatorAdapterResult,
  type RegulatorGatewayOptions,
  type RegulatorVerificationRequest,
  type RegulatorVerificationResult,
  type RegulatorVerificationStatus,
  type RegulatorEvidenceSnapshot,
} from "./gateway";

export {
  ALL_REGULATOR_ADAPTERS,
  buildProductionAdapterMap,
  type SystemSettingsAutoVerifyFlags,
} from "./adapters";

export {
  dedupeKeyFor,
  recordVerificationAttempt,
  markDeadLettered,
  redactEvidenceForOperator,
  logEvidenceViewedAuditEvent,
  enforceEvidenceRetention,
} from "./evidence-store";

export {
  listVerificationCases,
  getVerificationCaseDetail,
  recordManualDecision,
  type VerificationCaseListFilters,
  type RecordManualDecisionParams,
} from "./operator-service";

export {
  getLicenseVerificationQueue,
  enqueueLicenseVerification,
  LICENSE_VERIFICATION_QUEUE_NAME,
  LICENSE_VERIFICATION_MAX_ATTEMPTS,
} from "./queue";

export {
  handleVerificationSuccess,
  handleVerificationFailure,
  type VerificationOutcomeParams,
} from "./outcomes";

export {
  scoreVerification,
  type ConfidenceBreakdownEntry,
  type ConfidenceRule,
  DEFAULT_CONFIDENCE_RULES,
} from "./confidence-scoring";

export {
  getRegulatorLookupLink,
  listRegulatorLookupLinks,
  type RegulatorLookupLink,
} from "./regulator-lookup-links";
