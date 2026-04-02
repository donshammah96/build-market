// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createThread, sendMessage } from "./messaging";
import { createProject, getUserProjects } from "./projects";

// Mock the prisma client
const prismaMock = vi.hoisted(() => ({
  messageThread: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  message: {
    create: vi.fn(),
  },
  project: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  professionalProfile: {
    findMany: vi.fn(),
  },
}));

vi.mock("../db", () => ({
  prisma: prismaMock,
}));

describe("Messaging Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a thread", async () => {
    const mockUsers = [{ id: "user-1" }, { id: "user-2" }, { id: "user-3" }];
    const mockThread = { id: "thread-1", users: mockUsers };
    prismaMock.messageThread.create.mockResolvedValue(mockThread);

    const result = await createThread("user-1", ["user-2", "user-3"], {
      type: "GROUP",
      subject: "Site Visit",
      projectId: "proj-1",
    });

    expect(prismaMock.messageThread.create).toHaveBeenCalledWith({
      data: {
        projectId: "proj-1",
        users: {
          connect: [{ id: "user-1" }, { id: "user-2" }, { id: "user-3" }],
        },
      },
      include: { users: true },
    });
    expect(result).toEqual({
      ...mockThread,
      participants: ["user-1", "user-2", "user-3"],
    });
  });

  it("should send a message and update thread", async () => {
    const mockMessage = { id: "msg-1", content: "hello" };
    prismaMock.message.create.mockResolvedValue(mockMessage);
    prismaMock.messageThread.update.mockResolvedValue({});

    const result = await sendMessage("thread-1", "user-1", "hello");

    expect(prismaMock.message.create).toHaveBeenCalled();
    expect(prismaMock.messageThread.update).toHaveBeenCalledWith({
      where: { id: "thread-1" },
      data: {
        lastMessage: "hello",
        lastMessageAt: expect.any(Date),
      },
    });
    expect(result).toEqual(mockMessage);
  });
});

describe("Project Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a project", async () => {
    const mockProject = {
      id: "proj-1",
      title: "New Project",
      status: "PLANNING",
    };
    prismaMock.project.create.mockResolvedValue(mockProject);

    const result = await createProject({
      clientId: "user-1",
      title: "New Project",
      description: "description",
      type: "RESIDENTIAL",
      contractType: "FULL_CONTRACT",
      budgetMin: 1000,
      budgetMax: 2000,
      agreedPrice: 1500,
      startDate: "2026-01-01",
      endDate: "2026-02-01",
      location: "location",
      siteAddress: "siteAddress",
      county: "NAIROBI",
      status: "PLANNING",
    });

    expect(prismaMock.project.create).toHaveBeenCalledWith({
      data: {
        clientId: "user-1",
        title: "New Project",
        description: undefined,
        type: "RESIDENTIAL",
        contractType: "FULL_CONTRACT",
        budgetMin: undefined,
        budgetMax: undefined,
        agreedPrice: undefined,
        startDate: undefined,
        endDate: undefined,
        location: undefined,
        siteAddress: undefined,
        county: undefined,
        status: "PLANNING",
      },
    });
    expect(result).toEqual(mockProject);
  });

  it("should get user projects", async () => {
    const mockProjects = [{ id: "proj-1" }];
    prismaMock.project.findMany.mockResolvedValue(mockProjects);

    const result = await getUserProjects("user-1", "client");

    expect(prismaMock.project.findMany).toHaveBeenCalledWith({
      where: { clientId: "user-1" },
      orderBy: { updatedAt: "desc" },
      include: { professional: true },
    });
    expect(result).toEqual(mockProjects);
  });
});

// Search service migrated to app/lib/domains/search; see __tests__/lib/domains/search.service.test.ts
