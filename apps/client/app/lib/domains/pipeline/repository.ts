import { prisma } from "@build/db";

export const pipelineRepository = {
  listProfessionalProperties(userId: string) {
    return prisma.property.findMany({
      where: { agentId: userId, deletedAt: null },
      select: { id: true, price: true },
    });
  },

  groupPipelineCounts(propertyIds: string[]) {
    return prisma.propertyInquiry.groupBy({
      by: ["status", "propertyId"],
      where: {
        propertyId: { in: propertyIds },
      },
      _count: { id: true },
    });
  },
};
