import { NextRequest } from "next/server";

/**
 * Extracts the expected version for optimistic concurrency control.
 * Prioritizes the "version" field in the JSON body, falling back to the If-Match header.
 * Designed to be safe against empty or invalid bodies.
 */
export function extractExpectedVersion(
  req: NextRequest,
  body: unknown,
): number | null {
  const ifMatch = req.headers.get("If-Match");
  if (ifMatch) {
    const parsed = parseInt(ifMatch.replace(/"/g, ""), 10);
    if (!isNaN(parsed)) return parsed;
  }

  if (body && typeof body === "object" && "version" in body) {
    const parsed = parseInt(
      String((body as Record<string, unknown>).version),
      10,
    );
    if (!isNaN(parsed)) return parsed;
  }

  return null;
}
