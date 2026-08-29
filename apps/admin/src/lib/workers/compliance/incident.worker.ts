/**
 * Security Incidents Worker (Producer / Daemon Boundary)
 *
 * Per ADR-ADMIN-016, consumer loops run exclusively inside the standalone
 * `apps/workers` daemon (`apps/workers/src/processors/incident.processor.ts`).
 *
 * In Next.js web/admin instances, top-level Worker instantiations are omitted
 * to prevent Redis TCP socket leaks and serverless lifecycle degradation.
 *
 * Producers should enqueue jobs using `queueEmergencyProtocol` or `incidentQueue`
 * from `@build/queue-server`.
 */
export {
  incidentQueue,
  ComplianceJobs,
  type IncidentJobData,
  queueEmergencyProtocol,
} from "@build/queue-server";
