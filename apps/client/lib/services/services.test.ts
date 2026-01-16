// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createThread, sendMessage } from './messaging';
import { createProject, getUserProjects } from './projects';
import { searchProfessionals } from './search';

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

vi.mock('../db', () => ({
  prisma: prismaMock,
}));

describe('Messaging Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a thread', async () => {
    const mockUsers = [{ id: 'user-1' }, { id: 'user-2' }];
    const mockThread = { id: 'thread-1', users: mockUsers };
    prismaMock.messageThread.create.mockResolvedValue(mockThread);

    const result = await createThread(['user-1', 'user-2']);

    expect(prismaMock.messageThread.create).toHaveBeenCalledWith({
      data: {
        projectId: undefined,
        users: {
          connect: [{ id: 'user-1' }, { id: 'user-2' }],
        },
      },
      include: { users: true },
    });
    expect(result).toEqual({
      ...mockThread,
      participants: ['user-1', 'user-2'],
    });
  });

  it('should send a message and update thread', async () => {
    const mockMessage = { id: 'msg-1', content: 'hello' };
    prismaMock.message.create.mockResolvedValue(mockMessage);
    prismaMock.messageThread.update.mockResolvedValue({});

    const result = await sendMessage('thread-1', 'user-1', 'hello');

    expect(prismaMock.message.create).toHaveBeenCalled();
    expect(prismaMock.messageThread.update).toHaveBeenCalledWith({
      where: { id: 'thread-1' },
      data: {
        lastMessage: 'hello',
        lastMessageAt: expect.any(Date),
      },
    });
    expect(result).toEqual(mockMessage);
  });
});

describe('Project Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a project', async () => {
    const mockProject = { id: 'proj-1', title: 'New Project', status: 'planning' };
    prismaMock.project.create.mockResolvedValue(mockProject);

    const result = await createProject({ clientId: 'user-1', title: 'New Project' });

    expect(prismaMock.project.create).toHaveBeenCalledWith({
      data: {
        clientId: 'user-1',
        title: 'New Project',
        description: undefined,
        budget: undefined,
        startDate: undefined,
        status: 'planning',
      },
    });
    expect(result).toEqual(mockProject);
  });

  it('should get user projects', async () => {
    const mockProjects = [{ id: 'proj-1' }];
    prismaMock.project.findMany.mockResolvedValue(mockProjects);

    const result = await getUserProjects('user-1', 'client');

    expect(prismaMock.project.findMany).toHaveBeenCalledWith({
      where: { clientId: 'user-1' },
      orderBy: { updatedAt: 'desc' },
      include: { professional: true },
    });
    expect(result).toEqual(mockProjects);
  });
});

describe('Search Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should search professionals', async () => {
    const mockPros = [{ companyName: 'Acme Plumbers' }];
    prismaMock.professionalProfile.findMany.mockResolvedValue(mockPros);

    const result = await searchProfessionals('Plumber');

    expect(prismaMock.professionalProfile.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { companyName: { contains: 'Plumber', mode: 'insensitive' } },
          { bio: { contains: 'Plumber', mode: 'insensitive' } },
          { servicesOffered: { has: 'Plumber' } },
        ],
        verified: true,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    expect(result).toEqual(mockPros);
  });
});
