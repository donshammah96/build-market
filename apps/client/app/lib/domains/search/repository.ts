import { prisma } from "@build/db";
import { toSearchProfessionalResultDto } from "./mappers";
import type { SearchProfessionalResultDto } from "./contracts";

export const searchRepository = {
  async searchProfessionals(
    query: string,
  ): Promise<SearchProfessionalResultDto[]> {
    const rows = await prisma.professionalProfile.findMany({
      where: {
        OR: [
          { companyName: { contains: query, mode: "insensitive" } },
          { bio: { contains: query, mode: "insensitive" } },
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
      select: {
        userId: true,
        companyName: true,
        bio: true,
        verified: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    return rows.map((r) => toSearchProfessionalResultDto(r));
  },
};
