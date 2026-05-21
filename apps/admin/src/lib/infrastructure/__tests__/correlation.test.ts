import { describe, it, expect, vi, afterEach } from "vitest";
import {
  initializeAdminCorrelationId,
  withAdminCorrelation,
  getAdminCorrelationId,
} from "../correlation";

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// initializeAdminCorrelationId
// ---------------------------------------------------------------------------

describe("initializeAdminCorrelationId", () => {
  it("reads x-correlation-id from request headers when present", () => {
    const request = new Request("https://example.com", {
      headers: { "x-correlation-id": "upstream-corr-id-456" },
    });
    const id = initializeAdminCorrelationId(request);
    expect(id).toBe("upstream-corr-id-456");
  });

  it("generates a UUID v4 when header is absent", () => {
    const request = new Request("https://example.com");
    const id = initializeAdminCorrelationId(request);
    // UUID v4 format
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("generates a UUID v4 when no request is provided", () => {
    const id = initializeAdminCorrelationId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("ignores blank x-correlation-id header and generates a UUID instead", () => {
    const request = new Request("https://example.com", {
      headers: { "x-correlation-id": "   " },
    });
    const id = initializeAdminCorrelationId(request);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("generates unique IDs on successive calls", () => {
    const a = initializeAdminCorrelationId();
    const b = initializeAdminCorrelationId();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// withAdminCorrelation / getAdminCorrelationId
// ---------------------------------------------------------------------------

describe("withAdminCorrelation", () => {
  it("makes the correlation ID available inside the scope", async () => {
    await withAdminCorrelation("test-corr-789", async () => {
      const id = getAdminCorrelationId();
      expect(id).toBe("test-corr-789");
    });
  });

  it("returns the value produced by fn", async () => {
    const result = await withAdminCorrelation("corr-111", async () => 42);
    expect(result).toBe(42);
  });

  it("propagates the ID through nested async continuations", async () => {
    const ids: string[] = [];

    await withAdminCorrelation("nested-corr", async () => {
      ids.push(getAdminCorrelationId()!);
      await Promise.resolve(); // suspension point
      ids.push(getAdminCorrelationId()!);
    });

    expect(ids).toEqual(["nested-corr", "nested-corr"]);
  });

  it("isolates scopes — inner scope does not bleed into outer scope", async () => {
    let outerIdAfterInner: string | undefined;

    await withAdminCorrelation("outer", async () => {
      await withAdminCorrelation("inner", async () => {
        expect(getAdminCorrelationId()).toBe("inner");
      });
      outerIdAfterInner = getAdminCorrelationId();
    });

    expect(outerIdAfterInner).toBe("outer");
  });

  it("two concurrent scopes carry independent IDs", async () => {
    const aIds: string[] = [];
    const bIds: string[] = [];

    await Promise.all([
      withAdminCorrelation("scope-A", async () => {
        await Promise.resolve();
        aIds.push(getAdminCorrelationId()!);
      }),
      withAdminCorrelation("scope-B", async () => {
        await Promise.resolve();
        bIds.push(getAdminCorrelationId()!);
      }),
    ]);

    expect(aIds).toEqual(["scope-A"]);
    expect(bIds).toEqual(["scope-B"]);
  });
});

// ---------------------------------------------------------------------------
// getAdminCorrelationId — outside scope
// ---------------------------------------------------------------------------

describe("getAdminCorrelationId — outside scope", () => {
  it("returns undefined when called outside a withAdminCorrelation scope", () => {
    // This test runs at module level — no scope is active
    const id = getAdminCorrelationId();
    expect(id).toBeUndefined();
  });
});
