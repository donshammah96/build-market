import { prisma } from "../db";

export async function searchProfessionals(query: string) {
  // Simple search implementation using Prisma's contains
  // In a real MVP, we might want to use Postgres Full Text Search if performance becomes an issue
  return await prisma.professionalProfile.findMany({
    where: {
      OR: [
        { companyName: { contains: query, mode: "insensitive" } },
        { bio: { contains: query, mode: "insensitive" } },
        // Search in services relation (many-to-many)
        {
          offeredServices: {
            some: {
              service: { name: { contains: query, mode: "insensitive" } },
            },
          },
        },
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
}
