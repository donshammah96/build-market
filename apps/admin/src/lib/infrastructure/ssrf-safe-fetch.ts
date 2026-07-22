/**
 * SSRF-Safe Outbound HTTP Client
 * Validates outgoing HTTP/HTTPS target URLs against restricted IP ranges
 * (RFC 1918 private IPs, RFC 3927 link-local/cloud metadata, and loopback addresses).
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "169.254.169.254",
]);

function isPrivateIpV4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)
  ) {
    return false;
  }

  const [a, b] = parts;
  if (a === undefined || b === undefined) {
    return false;
  }

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 10.0.0.0/8 (RFC 1918)
  if (a === 10) return true;
  // 172.16.0.0/12 (RFC 1918)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (RFC 1918)
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (Link-Local / AWS Metadata)
  if (a === 169 && b === 254) return true;
  // 0.0.0.0
  if (a === 0) return true;

  return false;
}

export function validateSsrfTargetUrl(inputUrl: string): URL {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(inputUrl);
  } catch {
    throw new Error(`SSRF Protection: Invalid URL input "${inputUrl}"`);
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(
      `SSRF Protection: Invalid protocol "${parsedUrl.protocol}". Only HTTP/HTTPS targets are allowed.`,
    );
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(hostname) || isPrivateIpV4(hostname)) {
    throw new Error(
      `SSRF Protection: Target host "${hostname}" is restricted (private/internal range).`,
    );
  }

  return parsedUrl;
}

export async function ssrfSafeFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const urlString = typeof input === "string" ? input : input.toString();
  const validUrl = validateSsrfTargetUrl(urlString);

  return fetch(validUrl.toString(), init);
}
