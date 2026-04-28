// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { uploadFiles, UploadErrorCode } from "@/lib/upload-client";

describe("upload-client async lifecycle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
});
