'use server';

import { createProject, getProject, getUserProjects, CreateProjectInput } from '@/lib/services/projects';
import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';

export async function createProjectAction(data: Omit<CreateProjectInput, 'clientId'>) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  const project = await createProject({
    ...data,
    clientId: userId,
  });
  
  revalidatePath('/projects');
  return project;
}

export async function getProjectAction(id: string) {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  return await getProject(id);
}

export async function getUserProjectsAction(role: 'client' | 'professional' = 'client') {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  return await getUserProjects(userId, role);
}
