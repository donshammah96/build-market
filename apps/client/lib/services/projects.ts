import { prisma } from '../db';
import { ProjectStatus } from '@repo/db'; // Assuming types are exported from @repo/db or generated client

export interface CreateProjectInput {
  clientId: string;
  title: string;
  description?: string;
  budget?: number;
  startDate?: Date;
}

export async function createProject(data: CreateProjectInput) {
  return await prisma.project.create({
    data: {
      clientId: data.clientId,
      title: data.title,
      description: data.description,
      budget: data.budget,
      startDate: data.startDate,
      status: ProjectStatus.planning,
    },
  });
}

export async function getProject(id: string) {
  return await prisma.project.findUnique({
    where: { id },
    include: {
      client: true,
      professional: true,
      milestones: true,
    },
  });
}

export async function getUserProjects(userId: string, role: 'client' | 'professional' = 'client') {
  if (role === 'client') {
    return await prisma.project.findMany({
      where: { clientId: userId },
      orderBy: { updatedAt: 'desc' },
      include: { professional: true },
    });
  } else {
    return await prisma.project.findMany({
      where: { professionalId: userId },
      orderBy: { updatedAt: 'desc' },
      include: { client: true },
    });
  }
}
