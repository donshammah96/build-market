// Add this exported helper to the file
import { NextRequest } from "next/server";

export function extractExpectedVersion(
  req: NextRequest,
  body: unknown,
): number | null {
  const ifMatch = req.headers.get("If-Match");
  if (ifMatch) {
    const parsed = parseInt(ifMatch.replace(/"/g, ""), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (
    body &&
    typeof body === "object" &&
    "version" in (body as Record<string, unknown>)
  ) {
    const v = (body as Record<string, unknown>).version;
    const parsed = parseInt(String(v), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}
