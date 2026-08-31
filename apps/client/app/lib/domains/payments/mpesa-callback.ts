import { randomUUID } from "node:crypto";
import { prisma } from "@build/db";
import {
  b2cResultSchema,
  createProviderEventKey,
  hashCallbackPayload,
} from "@build/mpesa";
import { addMpesaB2cResultJob } from "@build/queue-server";
import { NextRequest } from "next/server";
import { providerCallbackResponse } from "@/app/api/webhooks/mpesa/shared";

function accepted(status = 202) {
  return providerCallbackResponse(status);
}

export async function receiveB2cCallback(
  request: NextRequest,
  callbackType: "B2C_RESULT" | "B2C_TIMEOUT",
) {
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 32 * 1024) return accepted(413);
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return accepted(400);
  }
  const parsed = b2cResultSchema.safeParse(body);
  if (!parsed.success) return accepted(400);
  const result = parsed.data.Result;
  const payout = await prisma.mpesaB2C.findFirst({
    where: {
      OR: [
        { conversationId: result.ConversationID },
        { originatorConvId: result.OriginatorConversationID },
      ],
    },
    select: { id: true },
  });
  if (!payout) return accepted();

  const providerEventKey = createProviderEventKey(`b2c:${callbackType}`, {
    conversationId: result.ConversationID,
    transactionId: result.TransactionID,
  });
  const redactedPayload = {
    ResultCode: result.ResultCode,
    ResultDesc: result.ResultDesc,
    ConversationID: result.ConversationID,
    OriginatorConversationID: result.OriginatorConversationID,
    TransactionID: result.TransactionID,
  };
  let event = await prisma.mpesaCallbackEvent.findUnique({
    where: { providerEventKey },
  });
  if (!event) {
    try {
      event = await prisma.mpesaCallbackEvent.create({
        data: {
          id: randomUUID(),
          providerEventKey,
          callbackType,
          payoutId: payout.id,
          conversationId: result.ConversationID,
          payloadHash: hashCallbackPayload(rawBody),
          redactedPayload,
        },
      });
    } catch (error) {
      if (!String(error).includes("P2002")) return accepted(503);
      event = await prisma.mpesaCallbackEvent.findUnique({
        where: { providerEventKey },
      });
    }
  }
  if (!event) return accepted(503);
  if (!event.processedAt) {
    await addMpesaB2cResultJob({
      payoutId: payout.id,
      callbackEventId: event.id,
      correlationId: providerEventKey,
    });
  }
  return accepted();
}
