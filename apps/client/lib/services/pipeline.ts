/**
 * Pipeline Service
 *
 * Sales pipeline data for property professionals.
 */
import { prisma } from "../db";

export type PipelineStage = {
  id: string;
  label: string;
  count: number;
  value: number;
};

const EMPTY_PIPELINE: PipelineStage[] = [
  { id: "viewing", label: "Viewings Scheduled", count: 0, value: 0 },
  { id: "offer", label: "Offers Pending", count: 0, value: 0 },
  { id: "closing", label: "Ready to Close", count: 0, value: 0 },
];

export type PipelineResult = {
  stages: PipelineStage[];
  totalValue: number;
};

export async function getProfessionalPipeline(
  dbUserId: string,
): Promise<PipelineResult> {
  const properties = await prisma.property.findMany({
    where: { agentId: dbUserId, deletedAt: null },
    select: { id: true, price: true },
  });

  const propertyIds = properties.map((p) => p.id);

  if (propertyIds.length === 0) {
    return { stages: EMPTY_PIPELINE, totalValue: 0 };
  }

  const propertyPriceMap = new Map(
    properties.map((p) => [p.id, Number(p.price)]),
  );

  const pipelineCounts = await prisma.propertyInquiry.groupBy({
    by: ["status", "propertyId"],
    where: {
      propertyId: { in: propertyIds },
    },
    _count: { id: true },
  });

  const statusCounts = {
    VIEWING_SCHEDULED: { count: 0, value: 0 },
    OFFER_MADE: { count: 0, value: 0 },
    CLOSED: { count: 0, value: 0 },
  };

  for (const item of pipelineCounts) {
    if (
      item.status === "VIEWING_SCHEDULED" ||
      item.status === "OFFER_MADE" ||
      item.status === "CLOSED"
    ) {
      const entry = statusCounts[item.status];
      entry.count += item._count.id;
      const propertyPrice = propertyPriceMap.get(item.propertyId) || 0;
      entry.value += propertyPrice * item._count.id;
    }
  }

  const stages: PipelineStage[] = [
    {
      id: "viewing",
      label: "Viewings Scheduled",
      count: statusCounts.VIEWING_SCHEDULED.count,
      value: statusCounts.VIEWING_SCHEDULED.value,
    },
    {
      id: "offer",
      label: "Offers Pending",
      count: statusCounts.OFFER_MADE.count,
      value: statusCounts.OFFER_MADE.value,
    },
    {
      id: "closing",
      label: "Ready to Close",
      count: statusCounts.CLOSED.count,
      value: statusCounts.CLOSED.value,
    },
  ];

  const totalValue = stages.reduce((sum, s) => sum + s.value, 0);

  return { stages, totalValue };
}
