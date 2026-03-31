import { err, ok } from "@/app/lib/errors/result";
import { normalizeRole } from "@/app/lib/security/roles";
import { pipelineRepository } from "@/app/lib/domains/pipeline/repository";
import type {
  PipelineActor,
  PipelineResult,
  PipelineStage,
  PipelineSummary,
} from "@/app/lib/domains/pipeline/contracts";

const PROFESSIONAL_PIPELINE_ROLES = new Set(["professional", "admin"]);

const EMPTY_PIPELINE: PipelineStage[] = [
  { id: "viewing", label: "Viewings Scheduled", count: 0, value: 0 },
  { id: "offer", label: "Offers Pending", count: 0, value: 0 },
  { id: "closing", label: "Ready to Close", count: 0, value: 0 },
];

function requireProfessionalPipelineActor(
  actor: PipelineActor,
): PipelineResult<{ userId: string }> {
  const role = normalizeRole(actor.role);
  if (!role || !PROFESSIONAL_PIPELINE_ROLES.has(role)) {
    return err({ error: "forbidden", message: "Forbidden", status: 403 });
  }

  return ok({ userId: actor.userId });
}

export const pipelineService = {
  async getProfessionalPipeline(
    actor: PipelineActor,
  ): Promise<PipelineResult<PipelineSummary>> {
    const actorResult = requireProfessionalPipelineActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }

    const properties = await pipelineRepository.listProfessionalProperties(
      actorResult.data.userId,
    );
    const propertyIds = properties.map((property) => property.id);

    if (propertyIds.length === 0) {
      return ok({ stages: EMPTY_PIPELINE, totalValue: 0 });
    }

    const propertyPriceMap = new Map(
      properties.map((property) => [property.id, Number(property.price)]),
    );

    const pipelineCounts =
      await pipelineRepository.groupPipelineCounts(propertyIds);

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

    return ok({
      stages,
      totalValue: stages.reduce((sum, stage) => sum + stage.value, 0),
    });
  },
};
