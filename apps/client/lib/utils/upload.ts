/**
 * Upload-related utility functions.
 *
 * Pure helpers for URL checks and upload-related logic.
 * For actual file uploads, use lib/upload-client.ts.
 */

/**
 * Checks if a URL is a local upload (vs external URL).
 * Handles various patterns: /uploads/, relative paths, blob URLs.
 */
export function isLocalUpload(url: string): boolean {
  if (!url) return false;

  // Check for common local patterns
  return (
    url.startsWith("/uploads/") ||
    url.startsWith("/api/") ||
    url.startsWith("blob:") ||
    // Relative paths without protocol
    (!url.startsWith("http://") &&
      !url.startsWith("https://") &&
      !url.startsWith("data:"))
  );
}
