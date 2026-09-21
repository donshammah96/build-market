/**
 * Small, dependency-light accessor for the configured ESP provider.
 *
 * Previously this lived in service.ts as a trivial re-export of
 * envConfig.newsletter.provider. That meant lib/jobs/newsletter-esp-sync.worker.ts
 * (a BullMQ consumer process) imported service.ts — which itself imports
 * newsletter.queue.ts to get a *producer* handle (newsletterEspSyncQueue,
 * newsletterEmailQueue). A consumer process has no business constructing
 * queue-producer objects; SafeQueue's lazy instantiation makes this
 * harmless today, but it's an architectural smell that will bite the
 * first time someone adds real side effects to queue construction (e.g.
 * connection-count metrics, a warmup ping). Keeping this accessor in its
 * own zero-dependency module lets the worker import only what it needs.
 */
import { envConfig } from "@/app/lib/infrastructure/env";

export function getConfiguredEspProvider(): string {
  return envConfig.newsletter.provider ?? "stub";
}
