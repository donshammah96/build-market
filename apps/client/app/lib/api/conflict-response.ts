/**
 * conflict-response.ts
 *
 * HTTP adapter utility for building 409 Conflict responses with current
 * version headers. These helpers live in the API adapter layer because they
 * produce NextResponse — domain operations files must not import next/server.
 *
 * Route handlers should import these directly. Domain services should expose
 * a plain version-fetch function; this module wraps it in the HTTP response.
 */
import { NextResponse } from "next/server";
import { apiError, HttpStatus } from "@/api/api-response";
import { prisma } from "@build/db";
import { StoreEventService } from "@/domains/stores/events";

/**
 * Build a 409 Conflict response for a project optimistic-lock conflict.
 * Sets the X-Project-Version header so the client can retry with the current version.
 */
export async function buildProjectConflictResponse(
  message: string,
  projectId: string,
): Promise<NextResponse> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { version: true },
  });
  const currentVersion = project?.version ?? 0;
  const response = apiError(message, HttpStatus.CONFLICT);
  response.headers.set("X-Project-Version", String(currentVersion));
  return response;
}

/**
 * Build a 409 Conflict response for a milestone optimistic-lock conflict.
 * Sets the X-Milestone-Version header so the client can retry with the current version.
 */
export async function buildMilestoneConflictResponse(
  message: string,
  milestoneId: string,
): Promise<NextResponse> {
  const milestone = await prisma.projectMilestone.findUnique({
    where: { id: milestoneId },
    select: { version: true },
  });
  const currentVersion = milestone?.version ?? 0;
  const response = apiError(message, HttpStatus.CONFLICT);
  response.headers.set("X-Milestone-Version", String(currentVersion));
  return response;
}

/**
 * Build a 409 Conflict response for a store optimistic-lock conflict.
 * Sets the X-Store-Version header so the client can retry with the current version.
 */
export async function buildStoreConflictResponse(
  message: string,
  storeId: string,
): Promise<NextResponse> {
  const currentVersion = await StoreEventService.getCurrentVersion(storeId);
  const response = apiError(message, HttpStatus.CONFLICT);
  response.headers.set("X-Store-Version", String(currentVersion));
  return response;
}
