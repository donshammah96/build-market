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

describe("projects client gate rollout", () => {
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

  it("blocks generic reads when generic API gate is disabled", async () => {
    mockEnv.features.genericProjectsApi = false;
    mockEnv.features.genericProjectsApiMutations = false;

    const { projectsClient } =
      await import("@/app/lib/domains/projects/client/index");

    await expect(projectsClient.getProjects()).rejects.toThrow(
      "Generic projects API is disabled",
    );
  });

  it("allows generic reads but blocks generic mutations in controlled rollout mode", async () => {
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

    const { projectsClient } =
      await import("@/app/lib/domains/projects/client/index");

    const readResult = await projectsClient.getProjects({ page: 1 });
    expect(readResult.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await expect(
      projectsClient.createProject({
        title: "Controlled rollout",
        clientId: "11111111-1111-4111-8111-111111111111",
        type: "RESIDENTIAL",
        contractType: "FULL_CONTRACT",
        status: "PLANNING",
      }),
    ).rejects.toThrow("Generic projects mutations are disabled");
  });

  it("allows generic mutations when mutation gate is enabled", async () => {
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

    const { projectsClient } =
      await import("@/app/lib/domains/projects/client/index");

    const createResult = await projectsClient.createProject({
      title: "Enabled mutation",
      clientId: "11111111-1111-4111-8111-111111111111",
      type: "RESIDENTIAL",
      contractType: "FULL_CONTRACT",
      status: "PLANNING",
    });

    expect(createResult.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
