/**
 * Bounded Concurrency Upload Queue Manager
 *
 * FIX (M1 / "next slice"): adds a `quarantined` status distinct from
 * `failed`. Previously, a file rejected by malware scanning and a file
 * that failed to upload due to a network blip both landed on the same
 * generic `"failed"` status — indistinguishable to the user, and both
 * offered the same "retry" affordance. Retrying a quarantined file is
 * pointless (it will never come back clean) and, per
 * AUDIT_4_full_subsystem.md finding H3, each retry is a real,
 * possibly-paid vendor scan — so the UI was actively inviting the exact
 * abuse pattern the backend audit flagged. `quarantined` items now:
 *   - Are visually and semantically distinct (see UploadStatusList.tsx)
 *   - Are NOT retryable via `retry()` (only `failed`/`cancelled` are)
 *   - Are NOT included in `getDraftState()` (a quarantined upload must
 *     never be usable as a completed draft entry)
 *
 * The server signals this via the staging response's `scanResult` /
 * `error` shape (see `enqueue`'s response handling) rather than via HTTP
 * status alone, since `stageOnboardingUpload` returns a normal 4xx
 * `invalid_input` error for a quarantined upload today (per the
 * synchronous-scanning design confirmed in ARCHITECTURE_DECISION_scan_pipeline.md) —
 * this queue inspects the response body to tell "quarantined" apart from
 * any other validation failure.
 */

export type UploadItemStatus =
  "queued" | "uploading" | "completed" | "failed" | "quarantined" | "cancelled";

export type UploadQueueItem = {
  id: string;
  file: File;
  status: UploadItemStatus;
  progress: number;
  stagedUploadId?: string;
  error?: string;
  /** Present only when status is "quarantined" — for user-facing copy. */
  quarantineReason?: string;
  attempts: number;
  controller?: AbortController;
};

export type UploadQueueOptions = {
  maxConcurrency?: number;
  maxRetries?: number;
  maxItems?: number;
  uploadEndpoint?: string;
  onItemChange?: (item: UploadQueueItem) => void;
  onQueueComplete?: (items: UploadQueueItem[]) => void;
};

/**
 * Shape of the JSON body returned by POST /api/uploads/staged when
 * scanning rejects the file. Matches uploadService.stageOnboardingUpload's
 * `fail("invalid_input", ..., { scanResult })` response — see service.ts.
 */
type StagingErrorBody = {
  error?: string;
  details?: {
    scanResult?: {
      status?: "CLEAN" | "INFECTED" | "ERROR";
      details?: string;
    };
  };
};

export class BoundedUploadQueue {
  private items: Map<string, UploadQueueItem> = new Map();
  private maxConcurrency: number;
  private maxRetries: number;
  private maxItems: number;
  private uploadEndpoint: string;
  private activeUploads: number = 0;
  private onItemChange?: (item: UploadQueueItem) => void;
  private onQueueComplete?: (items: UploadQueueItem[]) => void;

  constructor(options?: UploadQueueOptions) {
    this.maxConcurrency = options?.maxConcurrency ?? 2;
    this.maxRetries = options?.maxRetries ?? 3;
    this.maxItems = options?.maxItems ?? 20;
    this.uploadEndpoint = options?.uploadEndpoint ?? "/api/uploads/staged";
    this.onItemChange = options?.onItemChange;
    this.onQueueComplete = options?.onQueueComplete;
  }

  public enqueue(file: File): string {
    if (this.items.size >= this.maxItems) {
      return "";
    }

    const id = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const item: UploadQueueItem = {
      id,
      file,
      status: "queued",
      progress: 0,
      attempts: 0,
    };

    this.items.set(id, item);
    this.notifyItemChange(item);
    this.processNext();
    return id;
  }

  public cancel(id: string): boolean {
    const item = this.items.get(id);
    if (
      !item ||
      item.status === "completed" ||
      item.status === "cancelled" ||
      item.status === "quarantined"
    ) {
      return false;
    }

    if (item.controller) {
      item.controller.abort();
    }

    const wasUploading = item.status === "uploading";
    item.status = "cancelled";
    item.error = "Upload cancelled by user";
    this.notifyItemChange(item);

    if (wasUploading) {
      this.activeUploads = Math.max(0, this.activeUploads - 1);
    }

    this.processNext();
    return true;
  }

  /**
   * FIX (M1): quarantined items are deliberately excluded — retrying a
   * file that was flagged as malware will not change the outcome, and
   * every retry is a real scan call on the backend.
   */
  public retry(id: string): boolean {
    const item = this.items.get(id);
    if (!item || (item.status !== "failed" && item.status !== "cancelled")) {
      return false;
    }

    item.status = "queued";
    item.progress = 0;
    item.error = undefined;
    item.attempts = 0;
    this.notifyItemChange(item);

    this.processNext();
    return true;
  }

  public remove(id: string): boolean {
    const item = this.items.get(id);
    if (!item || item.status === "uploading" || item.status === "queued") {
      return false;
    }
    return this.items.delete(id);
  }

  public clearFinished(): number {
    let removed = 0;
    for (const [id, item] of this.items) {
      if (
        item.status === "completed" ||
        item.status === "failed" ||
        item.status === "cancelled" ||
        item.status === "quarantined"
      ) {
        this.items.delete(id);
        removed++;
      }
    }
    return removed;
  }

  public getItem(id: string): UploadQueueItem | undefined {
    return this.items.get(id);
  }

  public getAllItems(): UploadQueueItem[] {
    return Array.from(this.items.values());
  }

  /**
   * FIX (M1): quarantined items are never draft-eligible, even though the
   * filter below is unchanged in shape — `stagedUploadId` is never set on
   * a quarantined item in the first place (see processNext), so this is
   * belt-and-suspenders rather than the only guard.
   */
  public getDraftState(): Array<{ filename: string; uploadId: string }> {
    return Array.from(this.items.values())
      .filter((i) => i.status === "completed" && i.stagedUploadId)
      .map((i) => ({
        filename: i.file.name,
        uploadId: i.stagedUploadId!,
      }));
  }

  private notifyItemChange(item: UploadQueueItem): void {
    if (this.onItemChange) {
      this.onItemChange({ ...item });
    }

    const allFinished = Array.from(this.items.values()).every(
      (i) =>
        i.status === "completed" ||
        i.status === "failed" ||
        i.status === "cancelled" ||
        i.status === "quarantined",
    );
    if (allFinished && this.items.size > 0 && this.onQueueComplete) {
      this.onQueueComplete(this.getAllItems());
    }
  }

  private async processNext(): Promise<void> {
    if (this.activeUploads >= this.maxConcurrency) {
      return;
    }

    const queuedItem = Array.from(this.items.values()).find(
      (i) => i.status === "queued",
    );

    if (!queuedItem) {
      return;
    }

    this.activeUploads++;
    queuedItem.status = "uploading";
    queuedItem.attempts++;
    queuedItem.controller = new AbortController();
    this.notifyItemChange(queuedItem);

    try {
      const formData = new FormData();
      formData.append("file", queuedItem.file);

      const response = await fetch(this.uploadEndpoint, {
        method: "POST",
        body: formData,
        signal: queuedItem.controller.signal,
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        // FIX (M1): distinguish "scanning rejected this file" from any
        // other failure (network, validation, server error) using the
        // response body's scanResult, not just the HTTP status.
        const body = json as StagingErrorBody;
        const scanStatus = body.details?.scanResult?.status;

        if (scanStatus === "INFECTED") {
          queuedItem.status = "quarantined";
          queuedItem.quarantineReason =
            body.details?.scanResult?.details ??
            "This file could not be verified as safe.";
          queuedItem.controller = undefined;
          this.notifyItemChange(queuedItem);
          this.activeUploads = Math.max(0, this.activeUploads - 1);
          this.processNext();
          return;
        }

        throw new Error(`Upload HTTP server error: ${response.status}`);
      }

      const uploadId = json.data?.uploadId || json.data?.id;
      if (!uploadId) {
        throw new Error("Missing upload ID from response");
      }

      queuedItem.status = "completed";
      queuedItem.progress = 100;
      queuedItem.stagedUploadId = uploadId;
      queuedItem.controller = undefined;
      this.notifyItemChange(queuedItem);
    } catch (err: unknown) {
      if (queuedItem.controller?.signal.aborted) {
        queuedItem.status = "cancelled";
        queuedItem.error = "Upload cancelled";
      } else if (queuedItem.attempts < this.maxRetries) {
        queuedItem.status = "queued";
        const delayMs = Math.pow(2, queuedItem.attempts) * 300;
        setTimeout(() => this.processNext(), delayMs);
      } else {
        queuedItem.status = "failed";
        queuedItem.error = err instanceof Error ? err.message : "Upload failed";
      }
      queuedItem.controller = undefined;
      this.notifyItemChange(queuedItem);
    } finally {
      this.activeUploads = Math.max(0, this.activeUploads - 1);
      this.processNext();
    }
  }
}
