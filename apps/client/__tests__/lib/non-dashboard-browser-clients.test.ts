import { afterEach, describe, expect, it, vi } from "vitest";
import { consentClient } from "@/lib/consent-client";
import { financeClient } from "@/lib/finance-client";
import { onboardingClient } from "@/lib/onboarding-client";
import { portfolioClient } from "@/lib/portfolio-client";
import { userProfileClient } from "@/lib/user-profile-client";

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

describe("non-dashboard browser clients", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("treats missing profile status as a null result", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 404 }),
    );

    const result = await userProfileClient.getProfileStatus();
    expect(result).toEqual({ kind: "empty" });
  });

  it("sends consent updates through the bulk consent endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { updated: 2 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await consentClient.updateConsents({
      consents: [
        { type: "ANALYTICS_COOKIES", granted: true },
        { type: "MARKETING_EMAIL", granted: false },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstArg = fetchMock.mock.calls[0]?.[0];
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;

    expect(String(firstArg)).toContain("/api/user/consent");
    expect(requestInit?.method).toBe("PUT");
    expect(String(requestInit?.body)).toContain("ANALYTICS_COOKIES");
  });

  it("extracts uploaded onboarding files from the nested upload envelope", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            uploaded: {
              licenses: [
                {
                  uploadId: "upload-1",
                  previewUrl: "https://cdn.example.com/license-1.jpg",
                },
                {
                  uploadId: "",
                  previewUrl: "https://cdn.example.com/ignored.jpg",
                },
              ],
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const file = new File(["demo"], "license.jpg", { type: "image/jpeg" });
    const result = await onboardingClient.uploadFiles([file], "licenses");
    const data = expectSuccess(result);

    expect(data).toEqual([
      {
        uploadId: "upload-1",
        previewUrl: "https://cdn.example.com/license-1.jpg",
      },
    ]);
  });

  it("normalizes finance transaction lists into page-safe records", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            data: [
              {
                id: "txn-1",
                description: "Withdrawal to M-Pesa",
                amount: 12500,
                type: "withdrawal",
                status: "SUCCESS",
                date: "2026-03-10T12:00:00.000Z",
                referenceCode: "WD-1001",
                createdAt: "2026-03-10T12:00:00.000Z",
                updatedAt: "2026-03-10T12:05:00.000Z",
                project: { id: "project-1", title: "Karen Maisonette" },
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

    const result = await financeClient.getTransactions({ page: 1, limit: 10 });
    const data = expectSuccess(result);

    expect(data.items[0]?.status).toBe("COMPLETED");
    expect(data.items[0]?.type).toBe("WITHDRAWAL");
    expect(data.items[0]?.reference).toBe("WD-1001");
    expect(data.items[0]?.project?.title).toBe("Karen Maisonette");
  });

  it("normalizes portfolio detail payloads for page consumers", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            id: "550e8400-e29b-41d4-a716-446655440010",
            title: "Lavington Renovation",
            description: "Interior and exterior upgrade",
            projectType: "RENOVATION",
            clientTestimonial: "Strong finish quality",
            completionDate: "2026-03-01T00:00:00.000Z",
            createdAt: "2026-03-10T12:00:00.000Z",
            updatedAt: "2026-03-10T12:05:00.000Z",
            images: [
              {
                id: "image-1",
                category: "BEFORE",
                isMain: true,
                sortOrder: 1,
                createdAt: "2026-03-10T12:00:00.000Z",
                asset: {
                  id: "asset-1",
                  cdnUrl: "https://cdn.example.com/before.jpg",
                },
              },
            ],
            professional: {
              companyName: "Build Right Ltd",
              city: "Nairobi",
              county: "Nairobi",
              country: "Kenya",
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await portfolioClient.getPortfolioDetail(
      "550e8400-e29b-41d4-a716-446655440010",
    );
    const data = expectSuccess(result);

    expect(data.completedAt).toBe("2026-03-01T00:00:00.000Z");
    expect(data.images[0]?.url).toBe("https://cdn.example.com/before.jpg");
    expect(data.images[0]?.isBefore).toBe(true);
    expect(data.professional?.companyName).toBe("Build Right Ltd");
  });
});
