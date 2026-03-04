import { NextResponse } from "next/server";

export function ensureValidInternalSecret(receivedSecret: string | null) {
  const expectedSecret = process.env.INTERNAL_API_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: "Internal API secret is not configured" },
      { status: 503 },
    );
  }

  if (receivedSecret !== expectedSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null;
}
