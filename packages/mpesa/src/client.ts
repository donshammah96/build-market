import { MpesaError } from "./errors.js";
import { normalizeKenyanPhone } from "./phone.js";
import { encryptSecurityCredential } from "./security.js";
import {
  b2cInitiateResponseSchema,
  oauthResponseSchema,
  stkPushResponseSchema,
  stkQueryResponseSchema,
  type StkPushResponse,
  type StkQueryResponse,
} from "./schemas.js";

export interface MpesaClientOptions {
  baseUrl: string;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
  fetcher?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  b2c?: {
    initiatorName: string;
    initiatorPassword: string;
    certificatePem: string;
    resultUrl: string;
    timeoutUrl: string;
  };
}

export interface StkPushInput {
  amount: number;
  phoneNumber: string;
  accountReference: string;
  transactionDescription: string;
}

export interface StkQueryInput {
  checkoutRequestId: string;
}

export interface MpesaClient {
  initiateStkPush(input: StkPushInput): Promise<StkPushResponse>;
  queryStkPush(input: StkQueryInput): Promise<StkQueryResponse>;
  initiateB2c(input: B2cInput): Promise<B2cInitiateResponse>;
}

export interface B2cInput {
  amount: number;
  phoneNumber: string;
  remarks: string;
}

export interface B2cInitiateResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

interface TokenCache {
  value: string;
  expiresAt: number;
}

function formatDarajaTimestamp(now: number): string {
  const date = new Date(now);
  const parts = [
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
  ];
  return parts.map((part) => String(part).padStart(2, "0")).join("");
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export function createMpesaClient(options: MpesaClientOptions): MpesaClient {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 10_000;
  let tokenCache: TokenCache | undefined;

  async function request(path: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(`${options.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });
      const body = await readJson(response);
      if (!response.ok) {
        throw new MpesaError(
          "PROVIDER_ERROR",
          "Daraja rejected the request",
          response.status >= 500 || response.status === 429,
        );
      }
      return body;
    } catch (error) {
      if (error instanceof MpesaError) throw error;
      if (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")
      ) {
        throw new MpesaError(
          "PROVIDER_TIMEOUT",
          "Daraja request timed out",
          true,
        );
      }
      throw new MpesaError("PROVIDER_ERROR", "Daraja request failed", true);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getAccessToken(): Promise<string> {
    if (tokenCache && tokenCache.expiresAt > now() + 60_000) {
      return tokenCache.value;
    }

    const basicAuth = Buffer.from(
      `${options.consumerKey}:${options.consumerSecret}`,
      "utf8",
    ).toString("base64");
    const body = oauthResponseSchema.parse(
      await request("/oauth/v1/generate?grant_type=client_credentials", {
        headers: { Authorization: `Basic ${basicAuth}` },
      }),
    );
    tokenCache = {
      value: body.access_token,
      expiresAt: now() + body.expires_in * 1_000,
    };
    return body.access_token;
  }

  return {
    async initiateStkPush(input) {
      if (!Number.isFinite(input.amount) || input.amount <= 0) {
        throw new MpesaError("VALIDATION_ERROR", "Amount must be positive");
      }
      if (!input.accountReference || input.accountReference.length > 12) {
        throw new MpesaError(
          "VALIDATION_ERROR",
          "Account reference must be 1–12 characters",
        );
      }
      const timestamp = formatDarajaTimestamp(now());
      const password = Buffer.from(
        `${options.shortcode}${options.passkey}${timestamp}`,
        "utf8",
      ).toString("base64");
      const body = await request("/mpesa/stkpush/v1/processrequest", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await getAccessToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: options.shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: Math.round(input.amount),
          PartyA: normalizeKenyanPhone(input.phoneNumber),
          PartyB: options.shortcode,
          PhoneNumber: normalizeKenyanPhone(input.phoneNumber),
          CallBackURL: options.callbackUrl,
          AccountReference: input.accountReference,
          TransactionDesc: input.transactionDescription.slice(0, 13),
        }),
      });
      return stkPushResponseSchema.parse(body);
    },
    async queryStkPush(input) {
      if (!input.checkoutRequestId) {
        throw new MpesaError(
          "VALIDATION_ERROR",
          "Checkout request ID is required",
        );
      }
      const timestamp = formatDarajaTimestamp(now());
      const password = Buffer.from(
        `${options.shortcode}${options.passkey}${timestamp}`,
        "utf8",
      ).toString("base64");
      const body = await request("/mpesa/stkpushquery/v1/query", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await getAccessToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: options.shortcode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: input.checkoutRequestId,
        }),
      });
      return stkQueryResponseSchema.parse(body);
    },
    async initiateB2c(input) {
      if (!options.b2c) {
        throw new MpesaError(
          "CONFIGURATION_ERROR",
          "B2C credentials are not configured",
        );
      }
      if (!Number.isFinite(input.amount) || input.amount <= 0) {
        throw new MpesaError("VALIDATION_ERROR", "Amount must be positive");
      }
      const securityCredential = encryptSecurityCredential(
        options.b2c.initiatorPassword,
        options.b2c.certificatePem,
      );
      const body = await request("/mpesa/b2c/v1/paymentrequest", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await getAccessToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          InitiatorName: options.b2c.initiatorName,
          SecurityCredential: securityCredential,
          CommandID: "BusinessPayment",
          Amount: Math.round(input.amount),
          PartyA: options.shortcode,
          PartyB: normalizeKenyanPhone(input.phoneNumber),
          Remarks: input.remarks.slice(0, 100),
          QueueTimeOutURL: options.b2c.timeoutUrl,
          ResultURL: options.b2c.resultUrl,
          Occasion: "BuildMarket payout",
        }),
      });
      return b2cInitiateResponseSchema.parse(body);
    },
  };
}
