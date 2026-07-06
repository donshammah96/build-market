// ============================================================================
// System Health Domain — Contracts
// ============================================================================
// Pure types for the system health probe results. No Prisma, no services.
// Consumed by SystemInfrastructureWidget (RSC) via systemHealthService.
// ============================================================================

/**
 * Discrete status for a single infrastructure service.
 *
 * - healthy   → probe succeeded within normal latency
 * - degraded  → probe succeeded but latency is elevated
 * - unhealthy → probe failed or returned an error
 * - unknown   → probe was skipped (e.g. service not configured in this env)
 */
export type ServiceStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

/**
 * Single probe result for one infrastructure dependency.
 */
export type SystemHealthEntry = {
  /** Stable machine identifier (e.g. "database", "cache"). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Short description shown as the service sub-label. */
  description: string;
  /** Result of the health probe. */
  status: ServiceStatus;
  /**
   * Round-trip latency in milliseconds.
   * Absent when the probe was skipped (status === "unknown") or did not
   * involve a network call.
   */
  latencyMs?: number;
  /** ISO-8601 timestamp when this entry was produced. */
  checkedAt: string;
  /** Optional human-readable detail — error message, config note, etc. */
  detail?: string;
};

/**
 * Aggregated result for all infrastructure probes run in a single pass.
 */
export type SystemHealthSummary = {
  /**
   * Worst-case aggregate status derived from all checks:
   *   unhealthy > degraded > unknown > healthy
   */
  overallStatus: ServiceStatus;
  checks: SystemHealthEntry[];
  /** ISO-8601 timestamp when the aggregate result was produced. */
  checkedAt: string;
};
