import { afterEach, describe, expect, it, vi } from "vitest";
import { LicenseAuthority } from "@prisma/client";
import {
  HttpRegulatorAdapter,
  type HttpRegulatorAdapterConfig,
} from "@/app/lib/domains/regulator-verification/adapters/http-regulator-adapter";

const baseRequest = {
  professionalId: "pro_1",
  licenseId: "lic_1",
  authority: LicenseAuthority.NCA,
  licenseNumber: "NCA-123",
};

function buildAdapter(overrides: Partial<HttpRegulatorAdapterConfig> = {}) {
  return new HttpRegulatorAdapter({
    authority: LicenseAuthority.NCA,
    loadCredentials: () => ({
      baseUrl: "https://regulator.example",
      apiKey: "key",
    }),
    buildRequestPath: (r) => `/v1/licenses/${r.licenseNumber}`,
    mapResponse: (raw: any) => ({
      licenseNumber: raw.license_number,
      holderName: raw.holder_name,
      status: raw.status,
    }),
    timeoutMs: 50,
    ...overrides,
  });
}

describe("HttpRegulatorAdapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns unavailable/non-retryable when credentials are missing", async () => {
    const adapter = new HttpRegulatorAdapter({
      authority: "NCA",
      loadCredentials: () => null,
      buildRequestPath: () => "/v1/licenses/x",
      mapResponse: () => null,
    });

    const result = await adapter.verify(baseRequest);
    expect(result).toEqual({
      supported: true,
      available: false,
      retryable: false,
    });
  });

  it("maps a 200 response through the configured mapper", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({
          license_number: "NCA-123",
          holder_name: "Amina Builder",
          status: "ACTIVE",
        }),
        headers: new Headers(),
      }),
    );

    const adapter = buildAdapter();
    const result = await adapter.verify(baseRequest);

    expect(result.available).toBe(true);
    expect(result.record?.licenseNumber).toBe("NCA-123");
    expect(result.record?.raw).toBeDefined();
  });

  it("treats a 404 as available with no record (AUTO_REJECTED upstream)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ status: 404, ok: false, headers: new Headers() }),
    );

    const adapter = buildAdapter();
    const result = await adapter.verify(baseRequest);
    expect(result).toEqual({ supported: true, available: true, record: null });
  });

  it("treats a 401 as non-retryable auth failure, not a transient outage", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ status: 401, ok: false, headers: new Headers() }),
    );

    const adapter = buildAdapter();
    const result = await adapter.verify(baseRequest);
    expect(result.available).toBe(false);
    expect(result.retryable).toBe(false);
  });

  it("treats a 429 as retryable with the regulator's retry-after header", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 429,
        ok: false,
        headers: new Headers({ "retry-after": "120" }),
      }),
    );

    const adapter = buildAdapter();
    const result = await adapter.verify(baseRequest);
    expect(result.retryable).toBe(true);
    expect(result.retryAfterSeconds).toBe(120);
  });

  it("treats a 5xx as retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ status: 503, ok: false, headers: new Headers() }),
    );

    const adapter = buildAdapter();
    const result = await adapter.verify(baseRequest);
    expect(result.available).toBe(false);
    expect(result.retryable).toBe(true);
  });

  it("treats a request that exceeds the timeout budget as retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => {
              const err = new DOMException("aborted", "AbortError");
              reject(err);
            });
          }),
      ),
    );

    const adapter = buildAdapter({ timeoutMs: 10 } as any);
    const result = await adapter.verify(baseRequest);
    expect(result.available).toBe(false);
    expect(result.retryable).toBe(true);
  });

  it("treats a malformed 200 payload as non-retryable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        json: async () => ({ unexpected: "shape" }),
        headers: new Headers(),
      }),
    );

    const adapter = buildAdapter({
      mapResponse: () => {
        throw new Error("missing required fields");
      },
    } as any);

    const result = await adapter.verify(baseRequest);
    expect(result.available).toBe(false);
    expect(result.retryable).toBe(false);
  });
});
