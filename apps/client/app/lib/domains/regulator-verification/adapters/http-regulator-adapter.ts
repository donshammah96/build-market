import { createHmac } from "node:crypto";
import type { LicenseAuthority } from "@prisma/client";
import type {
  RegulatorAdapter,
  RegulatorAdapterResult,
  RegulatorVerificationRequest,
} from "../gateway";

/**
 * Error taxonomy every per-authority adapter maps its transport/response
 * failures onto. This is what decides `retryable` and `available` on the
 * RegulatorAdapterResult the gateway consumes - getting this classification
 * wrong either hides an outage as "no record" (AUTO_REJECTED, wrong) or
 * retries a permanent auth misconfiguration forever (wastes the attempt
 * budget, delays every case behind it to DEAD_LETTER).
 */
export type RegulatorAdapterErrorKind =
  | "TIMEOUT" // request exceeded its timeout budget - transient, retryable
  | "NETWORK" // DNS/connection failure - transient, retryable
  | "RATE_LIMITED" // 429 - transient, retryable with the provided backoff
  | "SERVER_ERROR" // 5xx from the regulator - transient, retryable
  | "AUTH" // 401/403 - our credentials/signing are wrong, NOT retryable, page on-call
  | "NOT_FOUND" // regulator confirms no such license exists - not a failure, no record
  | "MALFORMED_RESPONSE"; // 2xx but the payload doesn't match the expected shape - not retryable, needs adapter fix

export class RegulatorAdapterError extends Error {
  constructor(
    public readonly kind: RegulatorAdapterErrorKind,
    public readonly authority: LicenseAuthority,
    message: string,
    public readonly retryAfterSeconds?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RegulatorAdapterError";
  }
}

export type RegulatorAdapterCredentials = {
  baseUrl: string;
  apiKey: string;
  signingSecret?: string;
};

export type NormalizedRegulatorRecord = NonNullable<
  RegulatorAdapterResult["record"]
>;

export type HttpRegulatorAdapterLogger = {
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ) => void;
};

export type HttpRegulatorAdapterConfig = {
  authority: LicenseAuthority;
  /** Reads credentials lazily so a missing env var only breaks the one authority, not the whole gateway. */
  loadCredentials: () => RegulatorAdapterCredentials | null;
  /** Builds the regulator-specific request path/query for a license lookup. */
  buildRequestPath: (request: RegulatorVerificationRequest) => string;
  /**
   * Maps the regulator's raw JSON response onto our normalized record shape.
   * TODO: each authority's real response contract must be confirmed against
   * that regulator's actual API/portal before `enableAutoVerify<AUTHORITY>`
   * is flipped on in SystemSettings - this default mapping assumes a
   * reasonably common { license_number, holder_name, company_name, status,
   * expires_at } shape as a starting seam, not a verified contract.
   */
  mapResponse: (raw: unknown) => NormalizedRegulatorRecord | null;
  timeoutMs?: number;
  logger?: HttpRegulatorAdapterLogger;
};

const DEFAULT_TIMEOUT_MS = 8_000;

function signRequest(params: {
  method: string;
  path: string;
  apiKey: string;
  signingSecret?: string;
  timestamp: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${params.apiKey}`,
    "X-Request-Timestamp": params.timestamp,
    Accept: "application/json",
  };

  if (params.signingSecret) {
    const payload = `${params.method}\n${params.path}\n${params.timestamp}`;
    headers["X-Signature"] = createHmac("sha256", params.signingSecret)
      .update(payload)
      .digest("hex");
  }

  return headers;
}

/**
 * Shared per-authority HTTP adapter. Owns the concerns TODO 1 called out:
 * timeout budget, credential loading, request signing, response mapping,
 * and a regulator-specific error taxonomy - each concrete authority adapter
 * only needs to supply credentials, the request path, and a response mapper.
 */
export class HttpRegulatorAdapter implements RegulatorAdapter {
  readonly authority: LicenseAuthority;
  private readonly config: HttpRegulatorAdapterConfig;

  constructor(config: HttpRegulatorAdapterConfig) {
    this.authority = config.authority;
    this.config = config;
  }

  private logWarn(message: string, context?: Record<string, unknown>): void {
    if (this.config.logger) {
      this.config.logger.warn(message, context);
    } else {
      console.warn(`[HttpRegulatorAdapter] ${message}`, context);
    }
  }

  private logError(
    message: string,
    error?: unknown,
    context?: Record<string, unknown>,
  ): void {
    if (this.config.logger) {
      this.config.logger.error(message, error, context);
    } else {
      console.error(`[HttpRegulatorAdapter] ${message}`, error, context);
    }
  }

  async verify(
    request: RegulatorVerificationRequest,
  ): Promise<RegulatorAdapterResult> {
    const credentials = this.config.loadCredentials();
    if (!credentials) {
      // Not a regulator outage - we're simply not configured for this
      // authority yet. Surface as unavailable/non-retryable so the case
      // routes straight to manual review instead of burning retry budget.
      this.logWarn("Regulator adapter missing credentials", {
        authority: this.authority,
      });
      return { supported: true, available: false, retryable: false };
    }

    const path = this.config.buildRequestPath(request);
    const timestamp = new Date().toISOString();
    const headers = signRequest({
      method: "GET",
      path,
      apiKey: credentials.apiKey,
      signingSecret: credentials.signingSecret,
      timestamp,
    });

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    try {
      const response = await fetch(`${credentials.baseUrl}${path}`, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      if (response.status === 404) {
        return { supported: true, available: true, record: null };
      }

      if (response.status === 401 || response.status === 403) {
        throw new RegulatorAdapterError(
          "AUTH",
          this.authority,
          `Regulator ${this.authority} rejected credentials (${response.status})`,
        );
      }

      if (response.status === 429) {
        const retryAfterSeconds = Number(
          response.headers.get("retry-after") ?? 60,
        );
        throw new RegulatorAdapterError(
          "RATE_LIMITED",
          this.authority,
          `Regulator ${this.authority} rate limited the request`,
          retryAfterSeconds,
        );
      }

      if (response.status >= 500) {
        throw new RegulatorAdapterError(
          "SERVER_ERROR",
          this.authority,
          `Regulator ${this.authority} returned ${response.status}`,
        );
      }

      if (!response.ok) {
        throw new RegulatorAdapterError(
          "MALFORMED_RESPONSE",
          this.authority,
          `Regulator ${this.authority} returned unexpected status ${response.status}`,
        );
      }

      const raw = await response.json();
      let record: NormalizedRegulatorRecord | null;
      try {
        record = this.config.mapResponse(raw);
      } catch (mappingErr) {
        throw new RegulatorAdapterError(
          "MALFORMED_RESPONSE",
          this.authority,
          `Regulator ${this.authority} response did not match expected shape`,
          undefined,
          mappingErr,
        );
      }

      return {
        supported: true,
        available: true,
        record: record ? { ...record, raw } : null,
      };
    } catch (err) {
      return this.toAdapterResult(err);
    } finally {
      clearTimeout(timeout);
    }
  }

  private toAdapterResult(err: unknown): RegulatorAdapterResult {
    if (err instanceof RegulatorAdapterError) {
      this.logError(`Regulator adapter error (${err.kind})`, err, {
        authority: this.authority,
      });

      switch (err.kind) {
        case "AUTH":
        case "MALFORMED_RESPONSE":
          // Not the regulator's fault (or not something a retry fixes) -
          // page engineering rather than quietly retrying forever.
          return { supported: true, available: false, retryable: false };
        case "RATE_LIMITED":
        case "SERVER_ERROR":
          return {
            supported: true,
            available: false,
            retryable: true,
            retryAfterSeconds: err.retryAfterSeconds ?? 60,
          };
        default:
          return { supported: true, available: false, retryable: true };
      }
    }

    if (err instanceof DOMException && err.name === "AbortError") {
      this.logWarn(`Regulator adapter timed out`, {
        authority: this.authority,
      });
      return {
        supported: true,
        available: false,
        retryable: true,
        retryAfterSeconds: 30,
      };
    }

    this.logError("Unclassified regulator adapter failure", err as Error, {
      authority: this.authority,
    });
    return { supported: true, available: false, retryable: true };
  }
}
