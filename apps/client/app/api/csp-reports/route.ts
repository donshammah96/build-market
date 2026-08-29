// Destination: app/api/csp-reports/route.ts
//
// NAMING NOTE — read before wiring this into route-matcher.ts:
// You asked for `/api/internal/csp-reports`, but `internal` in this
// codebase's route-matcher.ts means "requires x-internal-secret,
// service-to-service only" (see isInternalApiRoute / ensureValidInternalSecret
// in middleware.ts). CSP violation reports are sent directly BY THE BROWSER
// as a side effect of a page load — there is no way for a browser to attach
// your internal secret to them, and there shouldn't be; report-uri/report-to
// requests are unauthenticated by spec. Putting this under /api/internal/
// would mean ensureValidInternalSecret rejects every real report with 401,
// which defeats the entire point (and you'd only discover that via an
// absence of reports, not an error — exactly the kind of silent gap this
// endpoint exists to prevent elsewhere).
//
// This file is written for `/api/csp-reports` and must be added to
// `isPublicApiRoute` (not `isInternalApiRoute`) in route-matcher.ts. If you
// specifically need it under an /internal/ path for infra/routing reasons,
// keep the path but make sure route-matcher.ts classifies it as public —
// just don't let the URL segment imply a guarantee the code doesn't enforce.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getClientLogger } from "@/app/lib/api/resilient-api";

// =============================================================================
// Config
// =============================================================================

// Hard caps so a misbehaving or malicious client can't use this endpoint as
// an amplification / storage-exhaustion vector. CSP reports are small
// (typically <1KB); anything wildly over that is either a bug or abuse.
const MAX_BODY_BYTES = 16 * 1024; // 16KB
const MAX_REPORTS_PER_BATCH = 20; // Reporting API can batch multiple reports per POST

// Recognized tiers — see STRICT_CSP_IMPLEMENTATION_PLAN.md. tier=2 reports
// mean the static fallback CSP (next-config-csp.ts) fired in production,
// which means this request skipped middleware.ts entirely — treat as a
// higher-severity signal than a routine tier=1 violation.
const KNOWN_TIERS = new Set(["1", "2"]);

// =============================================================================
// Types (loose — CSP report shapes vary by browser and by report-uri vs.
// the newer Reporting API, and we deliberately don't want a malformed or
// unexpected field to 500 this endpoint)
// =============================================================================

type LegacyCspReportBody = {
  "csp-report"?: Record<string, unknown>;
};

type ReportingApiEntry = {
  type?: string;
  url?: string;
  body?: Record<string, unknown>;
};

// =============================================================================
// Handler
// =============================================================================

export async function POST(req: NextRequest): Promise<NextResponse> {
  const tierParam = req.nextUrl.searchParams.get("tier") ?? "unknown";
  const tier = KNOWN_TIERS.has(tierParam) ? tierParam : "unknown";

  // --- Size guard before touching the body ---
  const contentLengthHeader = req.headers.get("content-length");
  if (contentLengthHeader && Number(contentLengthHeader) > MAX_BODY_BYTES) {
    // 413 is the correct status; still return quickly rather than reading
    // the stream, so an oversized payload can't tie up the handler.
    return new NextResponse(null, { status: 413 });
  }

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (rawBody.length > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  if (rawBody.length === 0) {
    // Some browsers send a genuinely empty body for report-to in edge cases.
    // Not an error — nothing to log, acknowledge and move on.
    return new NextResponse(null, { status: 204 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    logViolation({
      tier,
      malformed: true,
      raw: rawBody.slice(0, 500), // cap what we log even for malformed input
    });
    // Still 204: the browser doesn't retry on non-2xx for reporting
    // endpoints in a useful way, and a malformed report from a real
    // browser is itself a signal worth keeping, not worth erroring on.
    return new NextResponse(null, { status: 204 });
  }

  // --- Reporting API format: application/reports+json, body is an array ---
  if (
    contentType.includes("application/reports+json") ||
    Array.isArray(parsed)
  ) {
    const entries = (
      Array.isArray(parsed) ? parsed : [parsed]
    ) as ReportingApiEntry[];
    const cspEntries = entries
      .filter((e) => e?.type === "csp-violation")
      .slice(0, MAX_REPORTS_PER_BATCH);

    for (const entry of cspEntries) {
      logViolation({
        tier,
        format: "reporting-api",
        report: entry.body ?? entry,
      });
    }

    return new NextResponse(null, { status: 204 });
  }

  // --- Legacy report-uri format: application/csp-report, single object ---
  const legacy = parsed as LegacyCspReportBody;
  if (legacy && typeof legacy === "object" && "csp-report" in legacy) {
    logViolation({ tier, format: "report-uri", report: legacy["csp-report"] });
    return new NextResponse(null, { status: 204 });
  }

  // Unrecognized shape — log what we got (truncated) rather than silently
  // dropping it. A CSP report in a shape we don't recognize is more likely
  // a new browser format we haven't accounted for than junk traffic.
  logViolation({
    tier,
    format: "unrecognized",
    report:
      typeof parsed === "object"
        ? parsed
        : { value: String(parsed).slice(0, 500) },
  });

  return new NextResponse(null, { status: 204 });
}

// Reject other methods explicitly rather than falling through to a 404,
// so misconfiguration (e.g. a browser sending GET, which never happens per
// spec but worth being explicit about) is visible as 405 not silent 404.
export async function GET(): Promise<NextResponse> {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}

// =============================================================================
// Logging
// =============================================================================

function logViolation(entry: {
  tier: string;
  report?: unknown;
  format?: string;
  malformed?: boolean;
  raw?: string;
}): void {
  const logger = getClientLogger();

  const sanitizeUrl = (value: unknown): unknown => {
    if (typeof value !== "string") return value;
    try {
      const url = new URL(value);
      return `${url.origin}${url.pathname}`;
    } catch {
      return value.slice(0, 200);
    }
  };

  const sanitizeReport = (report: unknown): unknown => {
    if (!report || typeof report !== "object") return report;
    const r = report as Record<string, unknown>;
    const copy: Record<string, unknown> = { ...r };
    for (const key of [
      "document-uri",
      "blocked-uri",
      "documentURL",
      "blockedURL",
      "sourceFile",
      "url",
    ]) {
      if (key in copy) copy[key] = sanitizeUrl(copy[key]);
    }
    return copy;
  };

  const payload = {
    event: "csp_violation_report",
    tier: entry.tier,
    matcherGapSuspected: entry.tier === "2",
    format: entry.format,
    malformed: entry.malformed ?? false,
    report: sanitizeReport(entry.report),
  };

  if (payload.matcherGapSuspected) {
    logger.warn("CSP violation report received for Tier 2 fallback", payload);
  } else {
    logger.info("CSP violation report received for Tier 1 policy", payload);
  }
}
