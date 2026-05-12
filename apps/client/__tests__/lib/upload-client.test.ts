// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  uploadFiles,
  uploadFilesDirect,
  uploadForCredential,
  UploadErrorCode,
} from "@/lib/facades/upload-client";

describe("upload-client async lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        subtle: {
          digest: vi.fn().mockResolvedValue(new Uint8Array(32).buffer),
        },
      },
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn().mockReturnValue("blob:local-preview"),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns immediate URLs for synchronous upload responses", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            uploaded: [
              {
                fieldName: "images",
                assetId: "asset-1",
                url: "https://cdn.example.com/files/a.jpg",
              },
            ],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const file = new File(["demo"], "a.jpg", { type: "image/jpeg" });
    const result = await uploadFiles([file], "images");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.urls).toEqual(["https://cdn.example.com/files/a.jpg"]);
    expect(result.assetIds).toEqual(["asset-1"]);
  });

  it("polls status endpoints for 202 pending image uploads until ready", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              uploaded: [
                {
                  fieldName: "images",
                  uploadId: "upload-token-1",
                  status: "pending",
                  statusUrl: "/api/uploads/upload-token-1",
                },
              ],
            },
          }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              uploadId: "upload-token-1",
              status: "processing",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              uploadId: "upload-token-1",
              status: "ready",
              asset: {
                assetId: "asset-ready-1",
                url: "https://cdn.example.com/files/ready.jpg",
              },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const file = new File(["demo"], "ready.jpg", { type: "image/jpeg" });
    const result = await uploadFiles([file], "images", {
      pollIntervalMs: 1,
      maxPollingAttempts: 5,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.urls).toEqual(["https://cdn.example.com/files/ready.jpg"]);
    expect(result.assetIds).toEqual(["asset-ready-1"]);
  });

  it("throws when pending image processing finishes as failed", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              uploaded: [
                {
                  fieldName: "images",
                  uploadId: "upload-token-2",
                  status: "pending",
                  statusUrl: "/api/uploads/upload-token-2",
                },
              ],
            },
          }),
          { status: 202, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              uploadId: "upload-token-2",
              status: "failed",
              error: "Image processing failed",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const file = new File(["demo"], "broken.jpg", { type: "image/jpeg" });

    await expect(
      uploadFiles([file], "images", {
        pollIntervalMs: 1,
        maxPollingAttempts: 3,
      }),
    ).rejects.toMatchObject({
      code: UploadErrorCode.MAX_RETRIES_EXCEEDED,
      message: expect.stringContaining("Image processing failed"),
    });
  });

  it("uploads documents through presign, direct PUT, and confirm", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              uploadId: "11111111-1111-4111-8111-111111111111",
              uploadUrl: "/api/uploads/direct?token=signed",
              key: "private/uploads/2026/05/license.pdf",
              requiredHeaders: { "Content-Type": "application/pdf" },
              expiresAt: "2026-05-03T09:05:00.000Z",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              assetId: "asset-private-1",
              visibility: "PRIVATE",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const file = new File(["%PDF-1.7"], "license.pdf", {
      type: "application/pdf",
    });
    const result = await uploadFilesDirect([file], "documents");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/uploads/presign",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"context":"document"'),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/uploads/direct?token=signed",
      expect.objectContaining({
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/uploads/confirm",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          uploadId: "11111111-1111-4111-8111-111111111111",
        }),
      }),
    );
    expect(result.assetIds).toEqual(["asset-private-1"]);
    expect(result.urls).toEqual(["blob:local-preview"]);
  });

  it("uses the direct document flow by default for credentials", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              uploadId: "22222222-2222-4222-8222-222222222222",
              uploadUrl: "/api/uploads/direct?token=signed",
              requiredHeaders: { "Content-Type": "application/pdf" },
              expiresAt: "2026-05-03T09:05:00.000Z",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            data: {
              assetId: "asset-private-2",
              visibility: "PRIVATE",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

    const file = new File(["%PDF-1.7"], "credential.pdf", {
      type: "application/pdf",
    });

    await expect(uploadForCredential(file)).resolves.toEqual({
      assetId: "asset-private-2",
      url: "blob:local-preview",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/uploads/presign",
      expect.any(Object),
    );
  });
});
