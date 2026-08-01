import "server-only";

import {
  type ActionErrorCode,
  type ActionFailure,
} from "@/app/lib/actions/secure-action";

const RESTRICTED_KEYS = new Set([
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "session",
  "accountNumber",
  "bankAccount",
  "iban",
  "cvv",
  "otp",
  "ssn",
  "email",
  "phone",
  "mobile",
  "address",
  "nationalId",
  "idNumber",
  "licenseNumber",
  "kraPin",
]);

export function sanitizeDetailsForUserFacingError(
  details: unknown,
): Record<string, unknown> | undefined {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(
    details as Record<string, unknown>,
  )) {
    if (!RESTRICTED_KEYS.has(key) && value !== undefined) {
      sanitized[key] = value;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function formatRetryAfterMessage(seconds: number): string {
  const roundedSeconds = Math.max(1, Math.ceil(seconds));

  if (roundedSeconds < 60) {
    return `Too many attempts. Please try again in ${roundedSeconds} second${roundedSeconds === 1 ? "" : "s"}.`;
  }

  const minutes = Math.floor(roundedSeconds / 60);
  const remSeconds = roundedSeconds % 60;

  if (remSeconds === 0) {
    return `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
  }

  return `Too many attempts. Please try again in ${minutes}m ${remSeconds}s.`;
}

export function formatRecentAuthRequiredNotice(maxAgeSeconds = 300): {
  message: string;
  maxAgeSeconds: number;
  requiresReauth: true;
} {
  const minutes = Math.ceil(maxAgeSeconds / 60);
  return {
    message: `For your security, this action requires a recent sign-in (within the last ${minutes} minute${minutes === 1 ? "" : "s"}). Please re-authenticate to continue.`,
    maxAgeSeconds,
    requiresReauth: true,
  };
}

export function mapActionErrorCodeToUserMessage(
  code: ActionErrorCode,
  details?: unknown,
): string {
  switch (code) {
    case "limit_exceeded": {
      const retryAfter =
        details &&
        typeof details === "object" &&
        "retryAfterSeconds" in details &&
        typeof (details as { retryAfterSeconds?: unknown })
          .retryAfterSeconds === "number"
          ? (details as { retryAfterSeconds: number }).retryAfterSeconds
          : undefined;

      return retryAfter !== undefined
        ? formatRetryAfterMessage(retryAfter)
        : "Too many attempts. Please wait a moment and try again.";
    }

    case "unauthorized":
      return "Your session has expired or is invalid. Please sign in to continue.";

    case "forbidden":
      return "You do not have permission to perform this operation.";

    case "conflict":
    case "invalid_state":
      return "This action cannot be completed because the request or account state has already changed.";

    case "not_found":
      return "The requested resource could not be found.";

    case "validation_error":
    case "invalid_input":
      return "The submitted data is invalid. Please check your entries and try again.";

    case "internal":
    default:
      return "An unexpected server error occurred. Please try again shortly.";
  }
}
