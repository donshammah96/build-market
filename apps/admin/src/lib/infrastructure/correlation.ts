/**
 * Admin correlation ID threading — ADR-ADMIN-003 §7.2
 *
 * Provides an AsyncLocalStorage-backed correlation ID that is threaded
 * through every structured log event in the action and service layers.
 *
 * Usage:
 *   const correlationId = initializeAdminCorrelationId(request);
 *   await withAdminCorrelation(correlationId, async () => {
 *     // All calls within this scope share the same correlationId
 *     const id = getAdminCorrelationId(); // returns correlationId
 *   });
 *
 * In server actions, safeAction initialises the correlation ID from the
 * context it already owns (AdminActionContext.correlationId) and stores it
 * in the AsyncLocalStorage for downstream code to read without prop-drilling.
 */

import { AsyncLocalStorage } from "async_hooks";

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const correlationStorage = new AsyncLocalStorage<string>();

// ---------------------------------------------------------------------------
// Header key — must match any upstream gateway or load-balancer convention
// ---------------------------------------------------------------------------

const CORRELATION_HEADER = "x-correlation-id" as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extracts the correlation ID from an incoming request header, or generates
 * a fresh UUID v4 if none is present.
 *
 * Call once at the adapter boundary (route handler or server action entry).
 */
export function initializeAdminCorrelationId(request?: Request): string {
  if (request) {
    const fromHeader = request.headers.get(CORRELATION_HEADER);
    if (fromHeader && fromHeader.trim().length > 0) {
      return fromHeader.trim();
    }
  }
  return crypto.randomUUID();
}

/**
 * Runs `fn` inside an AsyncLocalStorage context that carries `correlationId`.
 * Any code that calls `getAdminCorrelationId()` inside `fn` — including
 * async continuations — will receive the same ID.
 */
export async function withAdminCorrelation<T>(
  correlationId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return correlationStorage.run(correlationId, fn);
}

/**
 * Reads the correlation ID from the current AsyncLocalStorage context.
 * Returns `undefined` if called outside a `withAdminCorrelation` scope.
 *
 * Prefer passing the `correlationId` from `AdminActionContext` directly;
 * use this only when the context is unavailable (e.g. repository helpers).
 */
export function getAdminCorrelationId(): string | undefined {
  return correlationStorage.getStore();
}
