import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalReadFlag = process.env.NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API;
const originalMutationFlag =
  process.env.NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API_MUTATIONS;

describe("projects client facade rollout gate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API = originalReadFlag;
    process.env.NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API_MUTATIONS =
      originalMutationFlag;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("blocks generic reads through the public facade when the rollout gate is disabled", async () => {
    process.env.NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API = "false";
    process.env.NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API_MUTATIONS = "false";

    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { projectsClient } = await import("@/lib/projects-client");

    const result = await projectsClient.getProjects({ page: 1 });

    expect(result).toEqual({
      success: false,
      error:
        "Generic projects API is disabled. Use professional portal projects APIs or enable NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps generic reads enabled but blocks generic mutations during read-only rollout", async () => {
    process.env.NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API = "true";
    process.env.NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API_MUTATIONS = "false";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { projects: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { projectsClient } = await import("@/lib/projects-client");

    const readResult = await projectsClient.getProjects({ page: 1 });
    const mutationResult = await projectsClient.createProject({
      title: "Read-only rollout",
      clientId: "11111111-1111-4111-8111-111111111111",
      type: "RESIDENTIAL",
      contractType: "FULL_CONTRACT",
      status: "PLANNING",
    });

    expect(readResult.success).toBe(true);
    expect(mutationResult).toEqual({
      success: false,
      error:
        "Generic projects mutations are disabled. Keep read-only rollout enabled or set NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API_MUTATIONS=true to enable writes.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("allows generic mutations through the public facade when both rollout gates are enabled", async () => {
    process.env.NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API = "true";
    process.env.NEXT_PUBLIC_ENABLE_GENERIC_PROJECTS_API_MUTATIONS = "true";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            project: {
              id: "11111111-1111-4111-8111-111111111111",
              title: "Enabled mutation",
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const { projectsClient } = await import("@/lib/projects-client");

    const result = await projectsClient.createProject({
      title: "Enabled mutation",
      clientId: "11111111-1111-4111-8111-111111111111",
      type: "RESIDENTIAL",
      contractType: "FULL_CONTRACT",
      status: "PLANNING",
    });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
