import { afterEach, describe, expect, it, vi } from "vitest";
import { propertiesClient } from "@/lib/properties-client";

describe("properties client contracts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses my-listings endpoint for owner listings", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { properties: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await propertiesClient.getMyProperties({ limit: 10, status: "active" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstArg = fetchMock.mock.calls[0]?.[0];
    expect(String(firstArg)).toContain("/api/properties/my-listings?");
    expect(String(firstArg)).not.toContain("/api/properties/me?");
  });

  it("uses similar endpoint for related properties", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { properties: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await propertiesClient.getSimilarProperties(
      "11111111-1111-4111-8111-111111111111",
      6,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstArg = fetchMock.mock.calls[0]?.[0];
    expect(String(firstArg)).toContain(
      "/api/properties/11111111-1111-4111-8111-111111111111/similar?limit=6",
    );
  });

  it("uses document-id endpoint with PATCH for document replacement", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "doc-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await propertiesClient.replacePropertyDocument({
      propertyId: "11111111-1111-4111-8111-111111111111",
      documentId: "22222222-2222-4222-8222-222222222222",
      type: "TITLE_DEED",
      assetId: "33333333-3333-4333-8333-333333333333",
      notes: "updated",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstArg = fetchMock.mock.calls[0]?.[0];
    const secondArg = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(String(firstArg)).toContain(
      "/api/properties/11111111-1111-4111-8111-111111111111/documents/22222222-2222-4222-8222-222222222222",
    );
    expect(secondArg?.method).toBe("PATCH");
  });
});
