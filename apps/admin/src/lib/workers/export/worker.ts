/**
 * GDPR Data Export Worker (Producer / Daemon Boundary)
 *
 * Per ADR-ADMIN-016, consumer loops run exclusively inside the standalone
 * `apps/workers` daemon (`apps/workers/src/processors/export.processor.ts`).
 *
 * In Next.js web/admin instances, top-level Worker instantiations are omitted
 * to prevent Redis TCP socket leaks and serverless lifecycle degradation.
 */
import { ExportProcessor } from "./processor";

export { ExportProcessor };
