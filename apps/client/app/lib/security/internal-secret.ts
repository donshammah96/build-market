import { NextResponse } from "next/server";
import { env } from "@/app/lib/infrastructure/env";

export function ensureValidInternalSecret(receivedSecret: string | null) {
  const expectedSecret = env.services.internalApiSecret;
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
