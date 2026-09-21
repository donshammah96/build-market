"use server";

import { z } from "zod";
import { safeAction } from "@/_core/safe-action";
import { parseActionInput } from "./_core/validation";
import { projectsService } from "@/lib/domains/projects/service";

const ProjectFilterSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(1000).default(10),
  search: z.string().default(""),
});

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
