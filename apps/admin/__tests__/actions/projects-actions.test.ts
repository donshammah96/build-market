import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================================
// Hoisted mocks — safeAction requires Clerk auth + Prisma user lookup
// ============================================================================

const dbMock = vi.hoisted(() => ({
  AdminRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    SUPPORT_AGENT: "SUPPORT_AGENT",
    CONTENT_MODERATOR: "CONTENT_MODERATOR",
  } as const,
  UserRole: { ADMIN: "ADMIN" } as const,
}));

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}));

const clerkMock = vi.hoisted(() => ({
  auth: vi.fn(),
}));

const rateLimitMock = vi.hoisted(() => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

const projectsServiceMock = vi.hoisted(() => ({
  projectsService: {
    listProjectPage: vi.fn(),
    getProjectDetails: vi.fn(),
  },
}));

vi.mock("@build/db", () => ({
  AdminRole: dbMock.AdminRole,
  UserRole: dbMock.UserRole,
  prisma: prismaMock,
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: clerkMock.auth }));
vi.mock("@/lib/api/rate-limit", () => rateLimitMock);
vi.mock("@/lib/domains/projects/service", () => projectsServiceMock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/config/feature-flags", () => ({
  AdminFeatureFlag: {
    ADMIN_V2_STRUCTURED_LOGGING: "admin_v2_structured_logging",
  },
  isAdminFeatureEnabled: vi.fn().mockReturnValue(false),
}));
vi.mock("@/actions/admin/idempotency", () => ({
  runWithIdempotency: vi.fn(async <T>(params: { run: () => Promise<T> }) =>
    params.run(),
  ),
}));

// ============================================================================
// Imports (after mocks)
// ============================================================================

import { getProjects, getProjectDetails } from "@/actions/admin/projects";

const mockService = projectsServiceMock.projectsService;

// ============================================================================
// Auth helpers
// ============================================================================

function mockActorAs(role: string) {
  clerkMock.auth.mockResolvedValue({ userId: "clerk_test", sessionClaims: {} });
  prismaMock.user.findUnique.mockResolvedValue({
    id: "user_1",
    role: dbMock.UserRole.ADMIN,
    adminProfile: { role, isActive: true },
  });
}

describe("getProjects action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated projects list on service success", async () => {
    mockActorAs(dbMock.AdminRole.SUPER_ADMIN);
    mockService.listProjectPage.mockResolvedValue({
      ok: true,
      data: {
        projects: [
          {
            id: "proj-1",
            title: "Project 1",
            status: "PENDING",
            budget: 1000,
            createdAt: new Date(),
            client: {
              firstName: "Client",
              lastName: "1",
              email: "client@example.com",
            },
            professional: {
              companyName: "Pro Ltd",
              user: { avatar: null },
            },
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          totalPages: 1,
        },
      },
    });

    const result = await getProjects(1, 10, "Project");
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    if (result.success && result.data) {
      expect(result.data.projects).toHaveLength(1);
      expect(result.data.projects[0]?.title).toBe("Project 1");
    }
  });

  it("fails safeParse on invalid parameters (negative page)", async () => {
    mockActorAs(dbMock.AdminRole.SUPER_ADMIN);
    const result = await getProjects(-5, 10);
    expect(result.success).toBe(false);
  });

  it("propagates service policy errors", async () => {
    mockActorAs(dbMock.AdminRole.SUPPORT_AGENT);
    mockService.listProjectPage.mockResolvedValue({
      ok: false,
      code: "PROJECTS_POLICY_DENIED",
      message: "Admin capability denied",
    });

    const result = await getProjects();
    expect(result.success).toBe(false);
    expect(result.error).toBe("Admin capability denied");
  });
});

describe("getProjectDetails action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  it("returns project details on service success", async () => {
    mockActorAs(dbMock.AdminRole.SUPER_ADMIN);
    mockService.getProjectDetails.mockResolvedValue({
      ok: true,
      data: {
        id: validUuid,
        title: "Detailed Project",
        description: "A description",
        status: "IN_PROGRESS",
        budget: 5000,
        createdAt: new Date(),
        client: {
          id: "client-1",
          firstName: "Client",
          lastName: "1",
          email: "client@example.com",
          avatar: null,
        },
        professional: {
          userId: "pro-1",
          companyName: "Pro Ltd",
          user: {
            id: "pro-1",
            firstName: "Pro",
            lastName: "1",
            email: "pro@example.com",
            avatar: null,
          },
        },
      },
    });

    const result = await getProjectDetails(validUuid);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    if (result.success && result.data) {
      expect(result.data.title).toBe("Detailed Project");
      expect(result.data.professional?.companyName).toBe("Pro Ltd");
    }
  });

  it("rejects non-uuid project IDs", async () => {
    mockActorAs(dbMock.AdminRole.SUPER_ADMIN);
    const result = await getProjectDetails("not-a-uuid");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Project ID must be a valid UUID");
  });

  it("propagates not found error", async () => {
    mockActorAs(dbMock.AdminRole.SUPER_ADMIN);
    mockService.getProjectDetails.mockResolvedValue({
      ok: false,
      code: "PROJECTS_NOT_FOUND",
      message: "Project not found",
    });

    const result = await getProjectDetails(validUuid);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Project not found");
  });
});
