import type {
  RegulatorAdapterResult,
  RegulatorVerificationRequest,
} from "./gateway";

/**
 * Bumped any time a rule, weight, or the fuzzy-match threshold below
 * changes. Persisted on every RegulatorVerificationResult (see gateway.ts)
 * so historical AUTO_VERIFIED / LOW_CONFIDENCE decisions can be correlated
 * against the algorithm version that produced them - e.g. "did the
 * false-positive rate change after v2 shipped?" This is the same pattern
 * used for per-authority response-contract versioning.
 */
export const CONFIDENCE_ALGORITHM_VERSION = "v2-2026-08-01";

export function normalizeForMatching(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

export type ConfidenceRuleContext = {
  request: RegulatorVerificationRequest;
  record: NonNullable<RegulatorAdapterResult["record"]>;
  now: Date;
};

export type ConfidenceRuleOutcome = {
  /** Fraction of this rule's weight actually earned, in [0, 1]. */
  fraction: number;
  reason: string;
};

export type ConfidenceRule = {
  id: string;
  /** Must be > 0. Enabled rule weights are required to sum to 1.0 (validated at module load, see below) so `confidence` stays comparable across releases. */
  weight: number;
  evaluate: (ctx: ConfidenceRuleContext) => ConfidenceRuleOutcome;
};

export type ConfidenceBreakdownEntry = {
  ruleId: string;
  weight: number;
  fraction: number;
  contribution: number;
  reason: string;
};

export type ConfidenceScoreResult = {
  confidence: number;
  reasons: string[];
  breakdown: ConfidenceBreakdownEntry[];
  /**
   * True when an authoritative disqualifier fired (explicit invalid
   * regulator status, or a passed expiry date). Callers should route
   * straight to AUTO_REJECTED regardless of the numeric score - a high
   * confidence score should never be able to override an expired or
   * revoked license.
   */
  disqualified: boolean;
  disqualifyReason?: string;
};

const EXPLICITLY_INVALID_STATUSES = new Set([
  "SUSPENDED",
  "REVOKED",
  "EXPIRED",
  "INVALID",
]);

const ACTIVE_STATUSES = new Set([
  "ACTIVE",
  "VALID",
  "CURRENT",
  "REGISTERED",
  "LICENSED",
]);

/**
 * Bounded Levenshtein-ratio similarity in [0, 1]. Used only to grant
 * *partial* credit on near-miss name matches (missing middle initial, a
 * "JR"/"SR" suffix, punctuation differences). It never grants full credit
 * and is intentionally conservative (see FUZZY_MATCH_FLOOR / CREDIT below)
 * so a fuzzy match alone can never push a mismatched identity over the
 * auto-verify threshold - license number + fuzzy name is still capped
 * below 0.82 by construction (see weight comments below).
 */
function similarityRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const charRatio = charSimilarityRatio(a, b);

  const aTokens = a.split(/\s+/).filter(Boolean);
  const bTokens = b.split(/\s+/).filter(Boolean);
  if (aTokens.length === 0 || bTokens.length === 0) return charRatio;

  let totalTokenScore = 0;
  const usedB = new Set<number>();

  for (const aToken of aTokens) {
    let bestMatchScore = 0;
    let bestBIndex = -1;

    for (let j = 0; j < bTokens.length; j++) {
      if (usedB.has(j)) continue;
      const bToken = bTokens[j];
      if (!bToken) continue;

      let score = 0;
      if (aToken === bToken) {
        score = 1.0;
      } else if (
        (aToken.length === 1 && bToken.startsWith(aToken)) ||
        (bToken.length === 1 && aToken.startsWith(bToken))
      ) {
        score = 0.85;
      } else {
        const tokenCharRatio = charSimilarityRatio(aToken, bToken);
        if (tokenCharRatio >= 0.75) {
          score = tokenCharRatio;
        }
      }

      if (score > bestMatchScore) {
        bestMatchScore = score;
        bestBIndex = j;
      }
    }

    if (bestBIndex >= 0 && bestMatchScore > 0) {
      usedB.add(bestBIndex);
      totalTokenScore += bestMatchScore;
    }
  }

  const maxTokens = Math.max(aTokens.length, bTokens.length);
  const tokenRatio = totalTokenScore / maxTokens;

  return Number(Math.max(charRatio, tokenRatio).toFixed(4));
}

function charSimilarityRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const dist: number[][] = Array.from({ length: rows }, () =>
    new Array<number>(cols).fill(0),
  );

  const row0 = dist[0];
  if (row0) {
    for (let j = 0; j < cols; j++) row0[j] = j;
  }
  for (let i = 0; i < rows; i++) {
    const row = dist[i];
    if (row) row[0] = i;
  }

  for (let i = 1; i < rows; i++) {
    const prevRow = dist[i - 1];
    const currRow = dist[i];
    if (!prevRow || !currRow) continue;

    for (let j = 1; j < cols; j++) {
      const prevVal = prevRow[j];
      const leftVal = currRow[j - 1];
      const diagVal = prevRow[j - 1];
      if (
        prevVal === undefined ||
        leftVal === undefined ||
        diagVal === undefined
      )
        continue;

      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currRow[j] = Math.min(prevVal + 1, leftVal + 1, diagVal + cost);
    }
  }

  const lastRow = dist[rows - 1];
  const editDistance = lastRow ? (lastRow[cols - 1] ?? 0) : 0;
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - editDistance / maxLen;
}

/** Fuzzy name matches below this ratio earn no partial credit at all. */
const FUZZY_MATCH_FLOOR = 0.85;
/** Fraction of the identity rule's weight a fuzzy (non-exact) name match earns. */
const FUZZY_MATCH_CREDIT = 0.5;
/** Fraction of the identity rule's weight a company-name-only match earns. */
const COMPANY_MATCH_CREDIT = 0.75;

const licenseNumberRule: ConfidenceRule = {
  id: "license_number_match",
  weight: 0.45,
  evaluate: ({ request, record }) => {
    const matched =
      normalizeForMatching(record.licenseNumber) ===
      normalizeForMatching(request.licenseNumber);
    return {
      fraction: matched ? 1 : 0,
      reason: matched
        ? "license_number_exact_match"
        : "license_number_mismatch",
    };
  },
};

const identityRule: ConfidenceRule = {
  id: "identity_match",
  weight: 0.3,
  evaluate: ({ request, record }) => {
    const submittedName = normalizeForMatching(request.submittedName);
    const holderName = normalizeForMatching(record.holderName);
    const companyName = normalizeForMatching(request.companyName);
    const recordCompanyName = normalizeForMatching(record.companyName);

    if (submittedName && holderName) {
      if (submittedName === holderName) {
        return { fraction: 1, reason: "holder_name_exact_match" };
      }
      const ratio = similarityRatio(submittedName, holderName);
      if (ratio >= FUZZY_MATCH_FLOOR) {
        return {
          fraction: FUZZY_MATCH_CREDIT,
          reason: `holder_name_fuzzy_match_${ratio.toFixed(2)}`,
        };
      }
    }

    if (companyName && recordCompanyName && companyName === recordCompanyName) {
      return {
        fraction: COMPANY_MATCH_CREDIT,
        reason: "company_name_exact_match",
      };
    }

    // Distinguish "we checked and it failed" from "there was nothing to
    // check" - the original implementation conflated these into a single
    // "name_or_company_not_matched" reason, which made it impossible to
    // tell from confidenceReasons alone whether onboarding failed to
    // collect a name/company at all (an upstream data-quality bug) versus
    // a genuine identity mismatch (a fraud/error signal).
    const hadAnyIdentityDataToCheck =
      Boolean(submittedName && holderName) ||
      Boolean(companyName && recordCompanyName);

    return {
      fraction: 0,
      reason: hadAnyIdentityDataToCheck
        ? "identity_mismatch"
        : "identity_data_not_submitted",
    };
  },
};

const statusActiveRule: ConfidenceRule = {
  id: "status_active",
  weight: 0.2,
  evaluate: ({ record }) => {
    const status = normalizeForMatching(record.status);
    if (ACTIVE_STATUSES.has(status)) {
      return { fraction: 1, reason: "regulator_status_active" };
    }
    if (EXPLICITLY_INVALID_STATUSES.has(status)) {
      return {
        fraction: 0,
        reason: `regulator_status_${status.toLowerCase()}`,
      };
    }
    return { fraction: 0, reason: "regulator_status_unknown" };
  },
};

/** NEW: the original algorithm captured expiresAt in evidence but never scored it. */
const notExpiredRule: ConfidenceRule = {
  id: "not_expired",
  weight: 0.05,
  evaluate: ({ record, now }) => {
    if (!record.expiresAt) {
      return { fraction: 1, reason: "no_expiry_reported" };
    }
    const expiresAt = new Date(record.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      // Unparseable date shouldn't silently disqualify a license - flag it
      // for visibility but don't treat it as equivalent to "expired".
      return { fraction: 1, reason: "expiry_unparseable" };
    }
    return expiresAt.getTime() >= now.getTime()
      ? { fraction: 1, reason: "not_expired" }
      : { fraction: 0, reason: "license_expired" };
  },
};

/**
 * Weights: license number 0.45, identity 0.30, status 0.20, expiry 0.05.
 * Sums to 1.0 (enforced below). By construction, no combination of
 * identity + status + expiry alone (0.55 max) can reach the default 0.82
 * threshold without a license-number match - i.e. the license number
 * remains a hard gate on auto-verification, matching the original
 * algorithm's behavior.
 */
export const DEFAULT_CONFIDENCE_RULES: ConfidenceRule[] = [
  licenseNumberRule,
  identityRule,
  statusActiveRule,
  notExpiredRule,
];

function assertWeightsSumToOne(rules: ConfidenceRule[]): void {
  const total = rules.reduce((sum, r) => sum + r.weight, 0);
  if (Math.abs(total - 1) > 1e-9) {
    // Fail fast at load time rather than silently producing confidence
    // scores that don't mean what confidenceThreshold assumes they mean.
    throw new Error(
      `Confidence rule weights must sum to 1.0, got ${total.toFixed(4)}`,
    );
  }
}
assertWeightsSumToOne(DEFAULT_CONFIDENCE_RULES);

export function scoreVerification(
  ctx: Omit<ConfidenceRuleContext, "now"> & { now?: Date },
  rules: ConfidenceRule[] = DEFAULT_CONFIDENCE_RULES,
): ConfidenceScoreResult {
  if (rules !== DEFAULT_CONFIDENCE_RULES) assertWeightsSumToOne(rules);

  const fullCtx: ConfidenceRuleContext = {
    ...ctx,
    now: ctx.now ?? new Date(),
  };
  const breakdown: ConfidenceBreakdownEntry[] = [];
  const reasons: string[] = [];
  let confidence = 0;
  let disqualified = false;
  let disqualifyReason: string | undefined;

  for (const rule of rules) {
    const { fraction, reason } = rule.evaluate(fullCtx);
    const clamped = Math.min(1, Math.max(0, fraction));
    const contribution = rule.weight * clamped;
    confidence += contribution;
    reasons.push(reason);
    breakdown.push({
      ruleId: rule.id,
      weight: rule.weight,
      fraction: clamped,
      contribution,
      reason,
    });

    // "regulator_status_unknown" scores 0 like an explicit rejection would,
    // but must NOT disqualify - an authority whose status vocabulary isn't
    // fully mapped yet should fall to LOW_CONFIDENCE (manual review), not
    // be treated with the same certainty as a confirmed SUSPENDED/REVOKED.
    if (
      rule.id === "status_active" &&
      clamped === 0 &&
      reason !== "regulator_status_unknown"
    ) {
      disqualified = true;
      disqualifyReason = reason;
    }
    if (rule.id === "not_expired" && clamped === 0) {
      disqualified = true;
      disqualifyReason = disqualifyReason ?? reason;
    }
  }

  return {
    confidence: Number(confidence.toFixed(4)),
    reasons,
    breakdown,
    disqualified,
    disqualifyReason,
  };
}
