"use client";

/**
 * Per-file upload status list for the Join-as-Pro document upload flow.
 *
 * This is the first client-facing piece of the upload-lifecycle work in
 * this engagement — everything before this has been backend/security
 * hardening. Renders each item from `useStagedUploadQueue` with copy and
 * affordances specific to its actual state, most importantly giving
 * "quarantined" its own distinct, non-retryable treatment instead of
 * looking like a generic failure (see AUDIT_4_full_subsystem.md, M1/H3).
 */

import type { UploadQueueItem } from "@/app/lib/uploads/upload-queue";

type UploadStatusListProps = {
  items: UploadQueueItem[];
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ item }: { item: UploadQueueItem }) {
  switch (item.status) {
    case "queued":
      return (
        <span className="upload-badge upload-badge--pending">Waiting…</span>
      );
    case "uploading":
      return (
        <span className="upload-badge upload-badge--active">
          Uploading &amp; scanning…
        </span>
      );
    case "completed":
      return (
        <span className="upload-badge upload-badge--success">Verified ✓</span>
      );
    case "quarantined":
      return (
        <span className="upload-badge upload-badge--danger">Not accepted</span>
      );
    case "failed":
      return <span className="upload-badge upload-badge--warning">Failed</span>;
    case "cancelled":
      return (
        <span className="upload-badge upload-badge--muted">Cancelled</span>
      );
    default:
      return null;
  }
}

function StatusDetail({ item }: { item: UploadQueueItem }) {
  if (item.status === "quarantined") {
    return (
      <p className="upload-item-detail upload-item-detail--danger">
        This file couldn&apos;t be verified as safe and won&apos;t be accepted.
        Please double-check the file and try a different one — if this keeps
        happening, contact support rather than re-uploading the same file.
      </p>
    );
  }
  if (item.status === "failed" && item.error) {
    return (
      <p className="upload-item-detail upload-item-detail--warning">
        {item.error}
      </p>
    );
  }
  if (item.status === "uploading") {
    return (
      <p className="upload-item-detail">
        Uploading and checking this file — this usually takes a few seconds.
      </p>
    );
  }
  return null;
}

export function UploadStatusList({
  items,
  onRetry,
  onCancel,
  onRemove,
}: UploadStatusListProps) {
  if (items.length === 0) return null;

  return (
    <ul className="upload-status-list" aria-label="Uploaded documents">
      {items.map((item) => (
        <li key={item.id} className="upload-status-item">
          <div className="upload-item-row">
            <div className="upload-item-info">
              <span className="upload-item-filename">{item.file.name}</span>
              <span className="upload-item-size">
                {formatBytes(item.file.size)}
              </span>
            </div>
            <StatusBadge item={item} />
          </div>

          <StatusDetail item={item} />

          <div className="upload-item-actions">
            {item.status === "uploading" && (
              <button
                type="button"
                onClick={() => onCancel(item.id)}
                className="upload-action upload-action--secondary"
              >
                Cancel
              </button>
            )}
            {/* FIX (M1): retry is intentionally NOT offered for
                quarantined items — retrying a flagged file will not
                change the scan outcome, and each attempt is a real
                scan call on the backend (see AUDIT_4, finding H3). */}
            {item.status === "failed" && (
              <button
                type="button"
                onClick={() => onRetry(item.id)}
                className="upload-action upload-action--primary"
              >
                Retry
              </button>
            )}
            {(item.status === "completed" ||
              item.status === "quarantined" ||
              item.status === "cancelled" ||
              item.status === "failed") && (
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="upload-action upload-action--tertiary"
              >
                Remove
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
