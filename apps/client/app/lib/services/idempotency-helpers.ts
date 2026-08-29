import { getClientLogger } from "@/app/lib/api/resilient-api";
import { IdempotencyService } from "@/app/lib/services/idempotency.service";

type IdempotencyCompletionContext = {
  correlationId?: string;
  operationName?: string;
  httpMethod?: string;
  routePattern?: string;
  actorRole?: string;
  httpStatus?: number;
  durationMs?: number;
  resourceType?: string;
  resourceId?: string;
};

export async function safeIdempotencyComplete(
  key: string,
  data: unknown,
  context: IdempotencyCompletionContext = {},
): Promise<void> {
  try {
    await IdempotencyService.complete(key, data);
  } catch (completionError) {
    await IdempotencyService.fail(key).catch(() => undefined);

    const logger = getClientLogger();
    const payload: Record<string, unknown> = {
      outcome: "idempotency_complete_failed",
    };

    if (context.correlationId) payload.correlationId = context.correlationId;
    if (context.operationName) payload.operationName = context.operationName;
    if (context.httpMethod) payload.httpMethod = context.httpMethod;
    if (context.routePattern) payload.routePattern = context.routePattern;
    if (context.actorRole) payload.actorRole = context.actorRole;
    if (typeof context.httpStatus === "number") {
      payload.httpStatus = context.httpStatus;
    }
    if (typeof context.durationMs === "number") {
      payload.durationMs = context.durationMs;
    }
    if (context.resourceType) payload.resourceType = context.resourceType;
    if (context.resourceId) payload.resourceId = context.resourceId;

    logger.error(
      "Idempotency completion failed",
      completionError instanceof Error
        ? completionError
        : new Error(String(completionError)),
      payload,
    );
  }
}
