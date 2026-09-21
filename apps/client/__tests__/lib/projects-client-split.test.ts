import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("projects client context split", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("routes generic and portal list calls to distinct endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            projects: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                title: "Project A",
                status: "PLANNING",
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const { projectsClient } = await import("@/lib/facades/projects-client");

    await projectsClient.getProjects({ page: 1 });
    await projectsClient.getPortalProjects();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/projects?");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      "/api/professional-portal/projects",
    );
  });

  it("returns operation-context parse errors from transport helper", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ data: { item: { title: "missing id" } } }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const { projectsClient } = await import("@/lib/facades/projects-client");

    const result = await projectsClient.getProject(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain(
        "Invalid API response shape for projects client",
      );
    }
  });
});
