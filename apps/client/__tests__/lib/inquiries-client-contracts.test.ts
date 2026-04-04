import { afterEach, describe, expect, it, vi } from "vitest";
import { inquiriesClient } from "@/lib/inquiries-client";

function expectSuccess<T>(result: {
  success: boolean;
  data?: T;
  error?: string;
}): T {
  expect(result.success).toBe(true);

  if (!result.success || result.data === undefined) {
    throw new Error(result.error || "Expected successful result");
  }

  return result.data;
}

describe("inquiries client contracts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes inquiry list responses into items plus pagination", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            data: [
              {
                id: "550e8400-e29b-41d4-a716-446655440001",
                property: {
                  id: "property-1",
                  title: "Garden Estate",
                  slug: "garden-estate",
                  location: "Nairobi",
                },
                clientName: "Jane Doe",
                clientPhone: "+254700000000",
                clientEmail: "jane@example.com",
                message: "Interested in a viewing",
                status: "NEW",
                createdAt: "2026-03-10T12:00:00.000Z",
                updatedAt: "2026-03-10T12:05:00.000Z",
              },
            ],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await inquiriesClient.getInquiries({ limit: 10, page: 1 });
    const data = expectSuccess(result);

    expect(data.data[0]?.property.title).toBe("Garden Estate");
    expect(data.pagination.total).toBe(1);
  });

  it("normalizes inquiry detail responses and preserves editable fields", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "550e8400-e29b-41d4-a716-446655440001",
            clientName: "Jane Doe",
            clientEmail: "jane@example.com",
            clientPhone: "+254700000000",
            message: "Interested in a viewing",
            status: "CONTACTED",
            notes: "Client prefers weekend slots",
            preferredViewingDate: "2026-03-15T09:00:00.000Z",
            createdAt: "2026-03-10T12:00:00.000Z",
            updatedAt: "2026-03-10T12:05:00.000Z",
            sender: {
              id: "user-1",
              firstName: "Jane",
              lastName: "Doe",
              email: "jane@example.com",
              phone: "+254700000000",
            },
            property: {
              id: "property-1",
              title: "Garden Estate",
              slug: "garden-estate",
              price: 12500000,
              currency: "KES",
              type: "HOUSE",
              category: "SALE",
              location: "Nairobi",
              status: "ACTIVE",
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await inquiriesClient.getInquiry(
      "550e8400-e29b-41d4-a716-446655440001",
    );
    const data = expectSuccess(result);

    expect(data.clientName).toBe("Jane Doe");
    expect(data.notes).toBe("Client prefers weekend slots");
    expect(data.preferredViewingDate).toBe("2026-03-15T09:00:00.000Z");
  });

  it("sends null preferred viewing dates through the update contract", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "550e8400-e29b-41d4-a716-446655440001",
            clientName: "Jane Doe",
            clientEmail: "jane@example.com",
            clientPhone: "+254700000000",
            message: "Interested in a viewing",
            status: "CONTACTED",
            notes: null,
            preferredViewingDate: null,
            createdAt: "2026-03-10T12:00:00.000Z",
            updatedAt: "2026-03-10T12:05:00.000Z",
            sender: null,
            property: {
              id: "property-1",
              title: "Garden Estate",
              slug: "garden-estate",
              price: 12500000,
              currency: "KES",
              type: "HOUSE",
              category: "SALE",
              location: "Nairobi",
              status: "ACTIVE",
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await inquiriesClient.updateInquiry({
      inquiryId: "550e8400-e29b-41d4-a716-446655440001",
      data: { status: "CONTACTED", preferredViewingDate: null, notes: "" },
    });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(requestInit?.method).toBe("PATCH");
    expect(requestInit?.body).toContain('"preferredViewingDate":null');
  });
});
