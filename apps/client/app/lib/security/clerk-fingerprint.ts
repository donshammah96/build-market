/**
 * Safe Clerk Publishable Key Fingerprinting
 * ============================================================================
 * Provides non-sensitive categorical fingerprinting of Clerk publishable keys
 * for cross-runtime (Edge vs Node) diagnostics.
 *
 * Invariant: NEVER returns or logs raw secret tokens.
 * Decodes the base64-encoded FAPI host embedded in Clerk publishable keys
 * (e.g. pk_live_Y2xlcmsuc3RhZ2luZy5idWlsZG1hcmtldC5hcHAk -> pk_live:clerk.staging.buildmarket.app).
 */

export function fingerprintPublishableKey(key?: string | null): string | null {
  if (!key || typeof key !== "string") {
    return null;
  }

  const trimmed = key.trim();
  if (!trimmed) {
    return null;
  }

  const isTest = trimmed.startsWith("pk_test_");
  const isLive = trimmed.startsWith("pk_live_");

  if (!isTest && !isLive) {
    return "unknown_prefix";
  }

  const prefix = isTest ? "pk_test" : "pk_live";
  const rawPayload = trimmed.slice(prefix.length + 1); // strip pk_test_ or pk_live_

  try {
    // Add back base64 padding if stripped
    let base64 = rawPayload;
    while (base64.length % 4 !== 0) {
      base64 += "=";
    }

    const decoded =
      typeof Buffer !== "undefined"
        ? Buffer.from(base64, "base64").toString("utf-8")
        : typeof atob !== "undefined"
          ? atob(base64)
          : null;

    if (!decoded) {
      return `${prefix}:unsupported_runtime_decoder`;
    }

    // Clerk key hosts typically terminate with '$', e.g. "clerk.staging.buildmarket.app$"
    const host = decoded.replace(/\$$/, "").trim();
    if (!/^[\x20-\x7E]+$/.test(host)) {
      return `${prefix}:non_ascii_payload`;
    }
    return `${prefix}:${host}`;
  } catch {
    return `${prefix}:malformed_payload`;
  }
}
