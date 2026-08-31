import { randomUUID } from "node:crypto";
import { prisma } from "@build/db";
import {
  createProviderEventKey,
  hashCallbackPayload,
  mpesaCallbackEnvelopeSchema,
} from "@build/mpesa";
import { addMpesaStkCallbackJob } from "@build/queue-server";
import { NextRequest } from "next/server";
import { providerCallbackResponse } from "../shared";

const MAX_CALLBACK_BYTES = 32 * 1024;

function acceptedResponse(status = 202) {
  return providerCallbackResponse(status);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_CALLBACK_BYTES) {
    return acceptedResponse(413);
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return acceptedResponse(400);
  }

  const parsed = mpesaCallbackEnvelopeSchema.safeParse(parsedBody);
  const callback = parsed.success ? parsed.data.Body.stkCallback : undefined;
  if (!callback) return acceptedResponse(400);

  const transaction = await prisma.mpesaTransaction.findFirst({
    where: {
      OR: [
        { checkoutRequestId: callback.CheckoutRequestID },
        { merchantRequestId: callback.MerchantRequestID },
      ],
    },
    select: { id: true, status: true },
  });

  // Unknown callbacks are acknowledged to stop provider retry storms, but are
  // never allowed to create or mutate a payment record.
  if (!transaction) return acceptedResponse();

  const providerEventKey = createProviderEventKey("stk", {
    checkoutRequestId: callback.CheckoutRequestID,
    merchantRequestId: callback.MerchantRequestID,
  });
  const redactedPayload = {
    MerchantRequestID: callback.MerchantRequestID,
    CheckoutRequestID: callback.CheckoutRequestID,
    ResultCode: callback.ResultCode,
    ResultDesc: callback.ResultDesc,
    CallbackMetadata: callback.CallbackMetadata?.Item.filter(
      (item) => item.Name !== "PhoneNumber",
    ),
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
          callbackType: "STK_CALLBACK",
          transactionId: transaction.id,
          checkoutRequestId: callback.CheckoutRequestID,
          payloadHash: hashCallbackPayload(rawBody),
          redactedPayload,
        },
      });
    } catch (error) {
      if (!String(error).includes("P2002")) return acceptedResponse(503);
      event = await prisma.mpesaCallbackEvent.findUnique({
        where: { providerEventKey },
      });
    }
  }

  if (!event) return acceptedResponse(503);
  if (!event.processedAt) {
    await addMpesaStkCallbackJob({
      callbackEventId: event.id,
      transactionId: transaction.id,
      correlationId: providerEventKey,
    });
  }

  return acceptedResponse();
}
