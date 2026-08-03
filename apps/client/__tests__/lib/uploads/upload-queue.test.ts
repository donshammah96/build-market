import { describe, expect, it, vi, beforeEach } from "vitest";
import { BoundedUploadQueue } from "@/app/lib/uploads/upload-queue";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("BoundedUploadQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enqueues files and respects maximum concurrency bound of 2", async () => {
    let resolveFirst: (res: unknown) => void = () => {};
    let resolveSecond: (res: unknown) => void = () => {};

    mockFetch.mockImplementation(() => new Promise(() => {}));
    mockFetch
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          }),
      );

    const queue = new BoundedUploadQueue({ maxConcurrency: 2 });
    const file1 = new File(["file1 content"], "file1.pdf", {
      type: "application/pdf",
    });
    const file2 = new File(["file2 content"], "file2.pdf", {
      type: "application/pdf",
    });
    const file3 = new File(["file3 content"], "file3.pdf", {
      type: "application/pdf",
    });

    const id1 = queue.enqueue(file1);
    const id2 = queue.enqueue(file2);
    const id3 = queue.enqueue(file3);

    expect(queue.getItem(id1)?.status).toBe("uploading");
    expect(queue.getItem(id2)?.status).toBe("uploading");
    expect(queue.getItem(id3)?.status).toBe("queued");
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Resolve first upload
    resolveFirst({
      ok: true,
      json: async () => ({ data: { uploadId: "upl_1" } }),
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(queue.getItem(id1)?.status).toBe("completed");
    expect(queue.getItem(id1)?.stagedUploadId).toBe("upl_1");
    // Now third file should start uploading
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(queue.getItem(id3)?.status).toBe("uploading");

    resolveSecond({
      ok: true,
      json: async () => ({ data: { uploadId: "upl_2" } }),
    });
  });

  it("supports cancelling an active upload via AbortController", () => {
    mockFetch.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => {
            reject(new Error("Upload cancelled"));
          });
        }),
    );

    const queue = new BoundedUploadQueue();
    const file = new File(["data"], "cancel-me.png", { type: "image/png" });
    const id = queue.enqueue(file);

    expect(queue.getItem(id)?.status).toBe("uploading");

    const cancelled = queue.cancel(id);
    expect(cancelled).toBe(true);
    expect(queue.getItem(id)?.status).toBe("cancelled");
    expect(queue.getItem(id)?.error).toContain("cancelled");
  });

  it("extracts clean draft state without persisting raw blob handles or URLs", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { uploadId: "stg_draft_123" } }),
    });

    const queue = new BoundedUploadQueue();
    const file = new File(["license data"], "license.pdf", {
      type: "application/pdf",
    });
    const id = queue.enqueue(file);

    await new Promise((r) => setTimeout(r, 20));

    expect(queue.getItem(id)?.status).toBe("completed");

    const draftState = queue.getDraftState();
    expect(draftState).toEqual([
      { filename: "license.pdf", uploadId: "stg_draft_123" },
    ]);
  });
});
