import { LicenseAuthority, Profession } from "@prisma/client";
import {
  CONFIDENCE_ALGORITHM_VERSION,
  DEFAULT_CONFIDENCE_RULES,
  normalizeForMatching,
  scoreVerification,
  type ConfidenceBreakdownEntry,
  type ConfidenceRule,
} from "./confidence-scoring";

export const REGULATOR_AUTHORITIES = [
  "EBK",
  "BORAQS",
  "NCA",
  "EARB",
  "VRB",
  "ISK",
  "EPRA",
] as const satisfies readonly LicenseAuthority[];

export type RegulatorAuthority = (typeof REGULATOR_AUTHORITIES)[number];

export type RegulatorVerificationStatus =
  | "AUTO_VERIFIED"
  | "AUTO_REJECTED"
  | "NEEDS_MANUAL_REVIEW"
  | "REGULATOR_UNAVAILABLE"
  | "LOW_CONFIDENCE";

export type RegulatorVerificationRequest = {
  professionalId: string;
  licenseId?: string | null;
  profession?: Profession | null;
  authority: LicenseAuthority;
  licenseNumber: string;
  submittedName?: string | null;
  companyName?: string | null;
  correlationId?: string | null;
  requestedAt?: Date;
};

export type RegulatorEvidenceSnapshot = {
  authority: LicenseAuthority;
  capturedAt: string;
  source: "regulator_api" | "manual_fallback" | "unsupported_authority";
  rawRecord?: unknown;
  normalizedRecord?: {
    licenseNumber?: string | null;
    holderName?: string | null;
    companyName?: string | null;
    status?: string | null;
    expiresAt?: string | null;
    contractVersion?: string | null;
  };
};

export type RegulatorVerificationResult = {
  authority: LicenseAuthority;
  licenseNumber: string;
  professionalId: string;
  licenseId?: string | null;
  status: RegulatorVerificationStatus;
  confidence: number;
  confidenceReasons: string[];
  /**
   * Per-rule scoring detail (weight, fraction earned, contribution, reason).
   * Populated only when a regulator record was actually scored (i.e. not
   * for unsupported_authority / regulator_unavailable / no_record cases).
   * Intended for the manual-review operator UI and for auditing individual
   * AUTO_VERIFIED decisions - see recordManualDecision / evidence-store.ts.
   */
  confidenceBreakdown?: ConfidenceBreakdownEntry[];
  /**
   * Which version of the confidence-scoring algorithm produced this
   * result. Persist alongside the case row so historical decisions remain
   * interpretable after the algorithm changes (see confidence-scoring.ts).
   * NOTE: requires a corresponding column on RegulatorVerificationCase /
   * migration - not included in this change set.
   */
  confidenceAlgorithmVersion: string;
  evidence: RegulatorEvidenceSnapshot;
  retryable: boolean;
  retryAfterSeconds?: number;
  manualFallbackReason?: string;
  correlationId?: string | null;
};

export type RegulatorAdapterResult = {
  supported: true;
  available: boolean;
  retryable?: boolean;
  retryAfterSeconds?: number;
  record?: {
    licenseNumber?: string | null;
    holderName?: string | null;
    companyName?: string | null;
    status?: string | null;
    expiresAt?: string | null;
    contractVersion?: string | null;
    raw?: unknown;
  } | null;
};

export interface RegulatorAdapter {
  readonly authority: LicenseAuthority;
  verify(
    request: RegulatorVerificationRequest,
  ): Promise<RegulatorAdapterResult>;
}

export type RegulatorGatewayOptions = {
  adapters: Partial<Record<LicenseAuthority, RegulatorAdapter>>;
  /** Default threshold applied to any authority without an override in confidenceThresholds. */
  confidenceThreshold?: number;
  /**
   * Per-authority threshold overrides. Authorities differ in data quality,
   * response-contract maturity, and volume - e.g. a newly-onboarded
   * authority whose mapper is still in its shadow-mode validation period
   * should ship with a stricter threshold than one with a multi-month
   * track record of agreement with operator decisions. Changing an entry
   * here is a compliance-reviewed change, not a routine config tweak.
   */
  confidenceThresholds?: Partial<Record<LicenseAuthority, number>>;
  /** Override the default rule set - primarily for tests; production should use DEFAULT_CONFIDENCE_RULES. */
  confidenceRules?: ConfidenceRule[];
  now?: () => Date;
};

const DEFAULT_CONFIDENCE_THRESHOLD = 0.82;

function normalize(value: string | null | undefined): string {
  return normalizeForMatching(value);
}

function buildEvidence(params: {
  request: RegulatorVerificationRequest;
  result?: RegulatorAdapterResult;
  source: RegulatorEvidenceSnapshot["source"];
  capturedAt: Date;
}): RegulatorEvidenceSnapshot {
  const record = params.result?.record ?? null;
  return {
    authority: params.request.authority,
    capturedAt: params.capturedAt.toISOString(),
    source: params.source,
    rawRecord: record?.raw,
    normalizedRecord: record
      ? {
          licenseNumber: record.licenseNumber,
          holderName: record.holderName,
          companyName: record.companyName,
          status: record.status,
          expiresAt: record.expiresAt,
          contractVersion: record.contractVersion,
        }
      : undefined,
  };
}

export class RegulatorVerificationGateway {
  private readonly adapters: Partial<
    Record<LicenseAuthority, RegulatorAdapter>
  >;
  private readonly confidenceThreshold: number;
  private readonly confidenceThresholds: Partial<
    Record<LicenseAuthority, number>
  >;
  private readonly confidenceRules: ConfidenceRule[];
  private readonly now: () => Date;

  constructor(options: RegulatorGatewayOptions) {
    this.adapters = options.adapters;
    this.confidenceThreshold =
      options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
    this.confidenceThresholds = options.confidenceThresholds ?? {};
    this.confidenceRules = options.confidenceRules ?? DEFAULT_CONFIDENCE_RULES;
    this.now = options.now ?? (() => new Date());
  }

  private thresholdFor(authority: LicenseAuthority): number {
    return this.confidenceThresholds[authority] ?? this.confidenceThreshold;
  }

  async verify(
    request: RegulatorVerificationRequest,
  ): Promise<RegulatorVerificationResult> {
    const adapter = this.adapters[request.authority];
    const capturedAt = this.now();

    if (!adapter) {
      return {
        authority: request.authority,
        licenseNumber: request.licenseNumber,
        professionalId: request.professionalId,
        licenseId: request.licenseId,
        status: "NEEDS_MANUAL_REVIEW",
        confidence: 0,
        confidenceReasons: ["unsupported_authority"],
        confidenceAlgorithmVersion: CONFIDENCE_ALGORITHM_VERSION,
        evidence: buildEvidence({
          request,
          source: "unsupported_authority",
          capturedAt,
        }),
        retryable: false,
        manualFallbackReason: "unsupported_authority",
        correlationId: request.correlationId,
      };
    }

    const result = await adapter.verify(request);
    if (!result.available) {
      return {
        authority: request.authority,
        licenseNumber: request.licenseNumber,
        professionalId: request.professionalId,
        licenseId: request.licenseId,
        status: "REGULATOR_UNAVAILABLE",
        confidence: 0,
        confidenceReasons: ["regulator_unavailable"],
        confidenceAlgorithmVersion: CONFIDENCE_ALGORITHM_VERSION,
        evidence: buildEvidence({
          request,
          result,
          source: "manual_fallback",
          capturedAt,
        }),
        retryable: result.retryable ?? true,
        retryAfterSeconds: result.retryAfterSeconds,
        manualFallbackReason: "regulator_unavailable",
        correlationId: request.correlationId,
      };
    }

    if (!result.record) {
      return {
        authority: request.authority,
        licenseNumber: request.licenseNumber,
        professionalId: request.professionalId,
        licenseId: request.licenseId,
        status: "AUTO_REJECTED",
        confidence: 1,
        confidenceReasons: ["no_regulator_record"],
        confidenceAlgorithmVersion: CONFIDENCE_ALGORITHM_VERSION,
        evidence: buildEvidence({
          request,
          result,
          source: "regulator_api",
          capturedAt,
        }),
        retryable: false,
        manualFallbackReason: "no_regulator_record",
        correlationId: request.correlationId,
      };
    }

    const scoreResult = scoreVerification(
      { request, record: result.record, now: capturedAt },
      this.confidenceRules,
    );
    const threshold = this.thresholdFor(request.authority);

    const status: RegulatorVerificationStatus = scoreResult.disqualified
      ? "AUTO_REJECTED"
      : scoreResult.confidence >= threshold
        ? "AUTO_VERIFIED"
        : "LOW_CONFIDENCE";

    return {
      authority: request.authority,
      licenseNumber: request.licenseNumber,
      professionalId: request.professionalId,
      licenseId: request.licenseId,
      status,
      confidence: scoreResult.confidence,
      confidenceReasons: scoreResult.reasons,
      confidenceBreakdown: scoreResult.breakdown,
      confidenceAlgorithmVersion: CONFIDENCE_ALGORITHM_VERSION,
      evidence: buildEvidence({
        request,
        result,
        source: "regulator_api",
        capturedAt,
      }),
      retryable: false,
      manualFallbackReason:
        status === "AUTO_VERIFIED"
          ? undefined
          : scoreResult.disqualified
            ? scoreResult.disqualifyReason
            : "manual_review_required",
      correlationId: request.correlationId,
    };
  }
}

export function buildRegulatorVerificationJobId(
  request: RegulatorVerificationRequest,
): string {
  return [request.authority, request.licenseNumber, request.professionalId]
    .map((part) => normalize(part).replace(/[^A-Z0-9_-]/g, "-"))
    .join(":");
}
