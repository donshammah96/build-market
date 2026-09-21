import { createHash } from "node:crypto";

export function createProviderEventKey(
  callbackType: "stk" | "b2c" | string,
  identifiers: {
    checkoutRequestId?: string;
    merchantRequestId?: string;
    conversationId?: string;
    transactionId?: string;
  },
): string {
  const providerId =
    identifiers.checkoutRequestId ??
    identifiers.conversationId ??
    identifiers.transactionId ??
    identifiers.merchantRequestId;
  if (!providerId)
    throw new Error("Callback has no provider correlation identifier");

  const secondaryId =
    identifiers.merchantRequestId ?? identifiers.transactionId ?? "";
  return `${callbackType}:${providerId}:${secondaryId}`;
}

export function hashCallbackPayload(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}
