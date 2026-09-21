import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { normalizeKenyanPhone, redactPhoneNumber } from "../phone.js";
import {
  mpesaCallbackEnvelopeSchema,
  stkPushResponseSchema,
} from "../schemas.js";
import { encryptSecurityCredential } from "../security.js";

describe("M-Pesa provider contracts", () => {
  it("normalizes Kenyan mobile numbers to the Daraja 254 format", () => {
    expect(normalizeKenyanPhone("0712 345 678")).toBe("254712345678");
    expect(normalizeKenyanPhone("+254712345678")).toBe("254712345678");
    expect(redactPhoneNumber("254712345678")).toBe("2547******78");
  });

  it("rejects callback payloads without a correlation identifier", () => {
    const result = mpesaCallbackEnvelopeSchema.safeParse({
      Body: { stkCallback: { ResultCode: 0 } },
    });

    expect(result.success).toBe(false);
  });

  it("parses a successful STK initiation response", () => {
    const result = stkPushResponseSchema.parse({
      MerchantRequestID: "29115-34620561-1",
      CheckoutRequestID: "ws_CO_191220191020363925",
      ResponseCode: "0",
      ResponseDescription: "成功",
      CustomerMessage: "Success. Request accepted for processing",
    });

    expect(result.CheckoutRequestID).toBe("ws_CO_191220191020363925");
  });

  it("encrypts the initiator password with the provider certificate", () => {
    const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const certificate = publicKey
      .export({ type: "spki", format: "pem" })
      .toString();

    const credential = encryptSecurityCredential("secret", certificate);

    expect(credential).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(credential).not.toContain("secret");
  });
});
