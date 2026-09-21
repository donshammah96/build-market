import { afterEach, describe, expect, it, vi } from "vitest";
import { ideaBooksClient } from "@/lib/facades/idea-books-client";

describe("idea-books client contracts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses idea-books list endpoint with query params", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            data: [],
            pagination: { page: 2, limit: 15, total: 0, totalPages: 0 },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await ideaBooksClient.list({
      page: 2,
      limit: 15,
      search: "kitchen",
      category: "KITCHEN",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstArg = fetchMock.mock.calls[0]?.[0];
    const url = String(firstArg);

    expect(url).toContain("/api/idea-books?");
    expect(url).toContain("page=2");
    expect(url).toContain("limit=15");
    expect(url).toContain("search=kitchen");
    expect(url).toContain("category=KITCHEN");
  });

  it("sends idempotency key header on create", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "book-1",
            title: "Kitchen Ideas",
            slug: "kitchen-ideas",
            description: null,
            category: "KITCHEN",
            privacy: "PRIVATE",
            viewCount: 0,
            likes: 0,
            coverImage: null,
            attachments: [],
            collaboratorCount: 0,
            attachmentCount: 0,
            savedProductCount: 0,
            savedProjectCount: 0,
            savedImageCount: 0,
            createdAt: "2026-04-13T00:00:00.000Z",
            updatedAt: "2026-04-13T00:00:00.000Z",
          },
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await ideaBooksClient.create(
      {
        title: "Kitchen Ideas",
        description: "Renovation references",
        category: "KITCHEN",
        privacy: "PRIVATE",
      },
      "idem-idea-book-1",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstArg = fetchMock.mock.calls[0]?.[0];
    const secondArg = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;

    expect(String(firstArg)).toContain("/api/idea-books");
    expect(secondArg?.method).toBe("POST");

    const headers = secondArg?.headers as Record<string, string> | undefined;
    expect(headers?.["Idempotency-Key"]).toBe("idem-idea-book-1");

    const body = JSON.parse(String(secondArg?.body));
    expect(body).toMatchObject({
      title: "Kitchen Ideas",
      category: "KITCHEN",
      privacy: "PRIVATE",
    });
  });

  it("uses item route POST for addAttachment", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "att-1",
            sourceUrl: null,
            fileUrl: "https://cdn.example.com/inspiration.jpg",
            fileKey: "uploads/inspiration.jpg",
            mimeType: "image/jpeg",
            size: 1000,
            width: 1200,
            height: 800,
            caption: "Countertop",
            createdAt: "2026-04-13T00:00:00.000Z",
            updatedAt: "2026-04-13T00:00:00.000Z",
            asset: null,
          },
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await ideaBooksClient.addAttachment("book-1", {
      fileUrl: "https://cdn.example.com/inspiration.jpg",
      fileKey: "uploads/inspiration.jpg",
      mimeType: "image/jpeg",
      size: 1000,
      caption: "Countertop",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstArg = fetchMock.mock.calls[0]?.[0];
    const secondArg = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;

    expect(String(firstArg)).toContain("/api/idea-books/book-1");
    expect(String(firstArg)).not.toContain("/attachments");
    expect(secondArg?.method).toBe("POST");
  });

  it("uses attachments collection endpoint for listAttachments", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            data: [],
            pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await ideaBooksClient.listAttachments("book-1", { page: 1, limit: 25 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstArg = fetchMock.mock.calls[0]?.[0];
    const url = String(firstArg);

    expect(url).toContain("/api/idea-books/book-1/attachments?");
    expect(url).toContain("page=1");
    expect(url).toContain("limit=25");
  });

  it("uses attachment item DELETE endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            message: "Attachment deleted successfully",
            id: "att-1",
            deletedKey: "uploads/inspiration.jpg",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await ideaBooksClient.deleteAttachment("book-1", "att-1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstArg = fetchMock.mock.calls[0]?.[0];
    const secondArg = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;

    expect(String(firstArg)).toContain(
      "/api/idea-books/book-1/attachments/att-1",
    );
    expect(secondArg?.method).toBe("DELETE");
    expect(secondArg?.body).toBeUndefined();
  });
});
