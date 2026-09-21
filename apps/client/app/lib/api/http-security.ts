import { headers as getRequestHeaders } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/app/lib/infrastructure/env";

const UNSAFE_MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type MutationOriginFailureReason =
  "missing_origin" | "invalid_origin" | "untrusted_origin";

export type MutationOriginCheckResult =
  | { ok: true; trustedOrigin?: string }
  | { ok: false; reason: MutationOriginFailureReason };

export type CsrfExemptionReason =
  | "webhook_signature"
  | "stripe_callback"
  | "mpesa_callback"
  | "clerk_webhook"
  | "internal_service";

export type CsrfExemption = {
  reason: CsrfExemptionReason;
  validatedBy: string;
  addedOn: string;
};

type MutationOriginCheckInput = {
  method: string;
  originHeader: string | null;
  cookieHeader: string | null;
  exempt?: CsrfExemption;
  extraTrustedOrigins?: string[];
};

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getTrustedMutationOrigins(
  extraTrustedOrigins: string[] = [],
): Set<string> {
  const trusted = new Set<string>();

  for (const value of [
    env.appUrl,
    env.apiUrl,
    ...env.csrf.trustedOrigins,
    ...extraTrustedOrigins,
  ]) {
    if (!value) {
      continue;
    }

    const normalized = normalizeOrigin(value);
    if (normalized) {
      trusted.add(normalized);
    }
  }

  return trusted;
}

export function isUnsafeMutationMethod(method: string): boolean {
  return UNSAFE_MUTATION_METHODS.has(method.toUpperCase());
}

export function validateTrustedMutationOrigin(
  input: MutationOriginCheckInput,
): MutationOriginCheckResult {
  if (input.exempt || !isUnsafeMutationMethod(input.method)) {
    return { ok: true };
  }

  const trustedOrigins = getTrustedMutationOrigins(input.extraTrustedOrigins);
  const originHeader = input.originHeader?.trim();

  if (!originHeader) {
    if (input.cookieHeader) {
      return { ok: false, reason: "missing_origin" };
    }

    return { ok: true };
  }

  const normalizedOrigin = normalizeOrigin(originHeader);
  if (!normalizedOrigin) {
    return { ok: false, reason: "invalid_origin" };
  }

  if (!trustedOrigins.has(normalizedOrigin)) {
    return { ok: false, reason: "untrusted_origin" };
  }

  return { ok: true, trustedOrigin: normalizedOrigin };
}

export function validateTrustedMutationOriginForRequest(
  request: NextRequest,
  options: {
    exempt?: CsrfExemption;
    extraTrustedOrigins?: string[];
  } = {},
): MutationOriginCheckResult {
  return validateTrustedMutationOrigin({
    method: request.method,
    originHeader: request.headers.get("origin"),
    cookieHeader: request.headers.get("cookie"),
    ...options,
  });
}

export async function validateTrustedMutationOriginForServerAction(
  options: {
    exempt?: CsrfExemption;
    extraTrustedOrigins?: string[];
  } = {},
): Promise<MutationOriginCheckResult> {
  const requestHeaders = await getRequestHeaders();

  return validateTrustedMutationOrigin({
    method: "POST",
    originHeader: requestHeaders.get("origin"),
    cookieHeader: requestHeaders.get("cookie"),
    ...options,
  });
}

export function mutationOriginFailureMessage(
  reason: MutationOriginFailureReason,
): string {
  switch (reason) {
    case "missing_origin":
      return "Origin header required for authenticated mutation requests.";
    case "invalid_origin":
    case "untrusted_origin":
      return "Cross-site authenticated mutation blocked.";
    default:
      return "Authenticated mutation blocked.";
  }
}

export function applyPrivateNoStoreHeaders<T extends NextResponse>(
  response: T,
): T {
  response.headers.set("Cache-Control", "no-store, private");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
