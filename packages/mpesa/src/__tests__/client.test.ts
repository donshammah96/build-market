import { describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { MpesaError } from "../errors.js";
import { createMpesaClient } from "../client.js";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Daraja HTTP client", () => {
  it("caches OAuth tokens and validates the STK initiation response", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({ access_token: "token", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(
        response({
          MerchantRequestID: "merchant-1",
          CheckoutRequestID: "checkout-1",
          ResponseCode: "0",
          ResponseDescription: "Accepted",
          CustomerMessage: "Success",
        }),
      )
      .mockResolvedValueOnce(
        response({
          MerchantRequestID: "merchant-2",
          CheckoutRequestID: "checkout-2",
          ResponseCode: "0",
          ResponseDescription: "Accepted",
        }),
      );
    const client = createMpesaClient({
      baseUrl: "https://sandbox.safaricom.co.ke",
      consumerKey: "key",
      consumerSecret: "secret",
      shortcode: "174379",
      passkey: "passkey",
      callbackUrl:
        "https://buildmarket.example/api/webhooks/mpesa/stk-callback",
      fetcher,
      now: () => Date.parse("2026-08-31T08:00:00Z"),
    });

    await expect(
      client.initiateStkPush({
        amount: 100,
        phoneNumber: "0712345678",
        accountReference: "txn-1",
        transactionDescription: "Project payment",
      }),
    ).resolves.toMatchObject({ CheckoutRequestID: "checkout-1" });
    await expect(
      client.initiateStkPush({
        amount: 200,
        phoneNumber: "0712345678",
        accountReference: "txn-2",
        transactionDescription: "Project payment",
      }),
    ).resolves.toMatchObject({ CheckoutRequestID: "checkout-2" });

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
    );
  });

  it("classifies non-2xx responses as retryable provider errors", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({ access_token: "token", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(response({ errorMessage: "busy" }, 503));
    const client = createMpesaClient({
      baseUrl: "https://sandbox.safaricom.co.ke",
      consumerKey: "key",
      consumerSecret: "secret",
      shortcode: "174379",
      passkey: "passkey",
      callbackUrl: "https://buildmarket.example/callback",
      fetcher,
    });

    await expect(
      client.initiateStkPush({
        amount: 100,
        phoneNumber: "0712345678",
        accountReference: "txn-1",
        transactionDescription: "Project payment",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
      retryable: true,
    } satisfies Partial<MpesaError>);
  });

  it("queries an existing STK request without creating a second payment", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({ access_token: "token", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(
        response({
          ResponseCode: "0",
          ResponseDescription: "The service request has been accepted",
          MerchantRequestID: "merchant-1",
          CheckoutRequestID: "checkout-1",
          ResultCode: "0",
          ResultDesc: "The service request is processed successfully",
        }),
      );
    const client = createMpesaClient({
      baseUrl: "https://sandbox.safaricom.co.ke",
      consumerKey: "key",
      consumerSecret: "secret",
      shortcode: "174379",
      passkey: "passkey",
      callbackUrl: "https://buildmarket.example/callback",
      fetcher,
      now: () => Date.parse("2026-08-31T08:00:00Z"),
    });

    await expect(
      client.queryStkPush({ checkoutRequestId: "checkout-1" }),
    ).resolves.toMatchObject({
      ResultCode: "0",
    });
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      "https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query",
    );
  });

  it("builds B2C requests with an encrypted security credential", async () => {
    const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({ access_token: "token", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(
        response({
          ConversationID: "conversation-1",
          OriginatorConversationID: "originator-1",
          ResponseCode: "0",
          ResponseDescription: "Accepted",
        }),
      );
    const client = createMpesaClient({
      baseUrl: "https://sandbox.safaricom.co.ke",
      consumerKey: "key",
      consumerSecret: "secret",
      shortcode: "174379",
      passkey: "passkey",
      callbackUrl: "https://buildmarket.example/stk",
      b2c: {
        initiatorName: "initiator",
        initiatorPassword: "secret-password",
        certificatePem: publicKey
          .export({ type: "spki", format: "pem" })
          .toString(),
        resultUrl: "https://buildmarket.example/b2c-result",
        timeoutUrl: "https://buildmarket.example/b2c-timeout",
      },
      fetcher,
    });

    await expect(
      client.initiateB2c({
        amount: 100,
        phoneNumber: "0712345678",
        remarks: "Payout",
      }),
    ).resolves.toMatchObject({ ConversationID: "conversation-1" });
  });
});
