import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("projects client facade generic API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("routes generic reads through the public projects facade", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            items: [
              {
                id: "11111111-1111-4111-8111-111111111111",
                title: "Facade read",
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

    const { projectsClient } = await import("@/lib/facades/projects-client");
    const result = await projectsClient.getProjects({ page: 1 });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/projects?");
  });

  it("routes generic mutations through the public projects facade", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            item: {
              id: "11111111-1111-4111-8111-111111111111",
              title: "Facade mutation",
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const { projectsClient } = await import("@/lib/facades/projects-client");
    const result = await projectsClient.createProject({
      title: "Facade mutation",
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

  it("preserves idempotency key and payload on mutation requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            item: {
              id: "11111111-1111-4111-8111-111111111111",
              title: "Idempotency facade mutation",
            },
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const { projectsClient } = await import("@/lib/facades/projects-client");

    const result = await projectsClient.createProject({
      title: "Idempotency facade mutation",
      clientId: "11111111-1111-4111-8111-111111111111",
      type: "RESIDENTIAL",
      contractType: "FULL_CONTRACT",
      status: "PLANNING",
      idempotencyKey: "idem-facade-1",
    });

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = request?.headers as Record<string, string> | undefined;
    expect(headers?.["Idempotency-Key"]).toBe("idem-facade-1");
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({ title: "Idempotency facade mutation" });
  });
});
