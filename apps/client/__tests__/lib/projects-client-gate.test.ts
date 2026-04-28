import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("projects domain client generic API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("routes generic reads through /api/projects", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            items: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                title: "Always-on read",
              },
            ],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
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

    const result = await projectsClient.getProjects({ page: 1 });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/projects?");
  });

  it("keeps generic mutation methods available after cutover", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            item: {
              id: "11111111-1111-4111-8111-111111111111",
              title: "Always-on mutation",
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

    const result = await projectsClient.createProject({
      title: "Always-on mutation",
      clientId: "11111111-1111-4111-8111-111111111111",
      type: "RESIDENTIAL",
      contractType: "FULL_CONTRACT",
      status: "PLANNING",
    });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(request?.method).toBe("POST");
  });

  it("preserves idempotency header shaping for mutations", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            item: {
              id: "11111111-1111-4111-8111-111111111111",
              title: "Idempotent mutation",
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

    const result = await projectsClient.createProject({
      title: "Idempotent mutation",
      clientId: "11111111-1111-4111-8111-111111111111",
      type: "RESIDENTIAL",
      contractType: "FULL_CONTRACT",
      status: "PLANNING",
      idempotencyKey: "idem-domain-1",
    });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = request?.headers as Record<string, string> | undefined;
    expect(headers?.["Idempotency-Key"]).toBe("idem-domain-1");
  });
});
