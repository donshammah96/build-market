"use server";

import { z } from "zod";
import { safeAction } from "./shared";
import { projectsService } from "@/lib/domains/projects/service";
import type {
  ProjectDetails,
  ProjectFilterInput,
  ProjectListItem,
  ProjectPageResult,
} from "@/lib/domains/projects/contracts";

export type {
  ProjectListItem,
  ProjectDetails,
  ProjectFilterInput,
  ProjectPageResult,
};

// ============================================================================
// Schemas
// ============================================================================

const ProjectFilterSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(10),
  search: z.string().default(""),
});

function parseActionInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  fallbackMessage: string,
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? fallbackMessage);
  }
  return result.data;
}

// ============================================================================
// Actions
// ============================================================================

/**
 * Fetches a paginated list of projects.
 * Searchable by title or description.
 * Budget is converted from Decimal to number for JSON serialization.
 */
export async function getProjects(page = 1, limit = 10, search = "") {
  return safeAction("getProjects", async ({ actor }) => {
    const valid = parseActionInput(
      ProjectFilterSchema,
      { page, limit, search },
      "Invalid filter parameters",
    );

    const result = await projectsService.listProjectPage(actor, valid);
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.data;
  });
}

/**
 * Fetches complete project details with client and professional relations.
 * Budget is converted from Decimal to number.
 */
export async function getProjectDetails(projectId: string) {
  return safeAction("getProjectDetails", async ({ actor }) => {
    const parsedId = parseActionInput(
      z.string().uuid({ message: "Project ID must be a valid UUID" }),
      projectId,
      "Project ID must be a valid UUID",
    );

    const result = await projectsService.getProjectDetails(actor, parsedId);
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.data;
  });
}
