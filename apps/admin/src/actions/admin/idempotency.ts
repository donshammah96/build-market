import { IdempotencyService } from "../../lib/services/idempotency.service";

type RunWithIdempotencyParams<T> = {
  adminUserId: string;
  actionName: string;
  idempotencyKey: string;
  resourceId?: string;
  ttlHours?: number;
  run: () => Promise<T>;
};

export async function runWithIdempotency<T>(
  params: RunWithIdempotencyParams<T>,
): Promise<T> {
  const clientKey = params.idempotencyKey?.trim();
  if (!clientKey) {
    throw new Error("Idempotency-Key is required");
  }

  const scopedKey = IdempotencyService.generateKey(
    params.adminUserId,
    params.actionName,
    {
      clientKey,
      resourceId: params.resourceId ?? "global",
    },
  );

  const check = await IdempotencyService.checkOrCreate(
    scopedKey,
    "admin-action",
    params.adminUserId,
    params.actionName,
    undefined,
    params.ttlHours ?? 0.25,
  );

  if (check?.status === "completed") {
    return check.response as T;
  }

  if (check?.status === "pending") {
    throw new Error("Request already in progress");
  }

  try {
    const result = await params.run();
    await IdempotencyService.complete(scopedKey, result);
    return result;
  } catch (error) {
    await IdempotencyService.fail(scopedKey).catch(() => undefined);
    throw error;
  }
}
