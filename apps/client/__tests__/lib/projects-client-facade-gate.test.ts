import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockEnv } = vi.hoisted(() => ({
  mockEnv: {
    features: {
      genericProjectsApi: false,
      genericProjectsApiMutations: false,
    },
  },
}));

vi.mock("@/app/lib/infrastructure/env", () => ({
  env: mockEnv,
}));

describe("projects client facade rollout gate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    mockEnv.features.genericProjectsApi = false;
    mockEnv.features.genericProjectsApiMutations = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("blocks generic reads through the public facade when the rollout gate is disabled", async () => {
    mockEnv.features.genericProjectsApi = false;
    mockEnv.features.genericProjectsApiMutations = false;

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
    mockEnv.features.genericProjectsApi = true;
    mockEnv.features.genericProjectsApiMutations = false;

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            items: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
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
    mockEnv.features.genericProjectsApi = true;
    mockEnv.features.genericProjectsApiMutations = true;

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            item: {
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
