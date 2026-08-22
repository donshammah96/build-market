import { NextResponse } from "next/server";
import { env } from "@/app/lib/infrastructure/env";

/**
 * Edge-compatible constant-time string comparison to prevent timing attacks.
 * Does not import Node.js 'crypto' module so it runs safely in Edge runtime (middleware).
 */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function ensureValidInternalSecret(receivedSecret: string | null) {
  const expectedSecret = env.services.internalApiSecret;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Internal API secret is not configured" },
      { status: 503 },
    );
  }

  if (!receivedSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!timingSafeEqualStrings(receivedSecret, expectedSecret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
