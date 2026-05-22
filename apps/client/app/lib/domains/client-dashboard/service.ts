import { err, ok } from "@/app/lib/errors/result";
import { clientDashboardRepository } from "./repository";
import type {
  ClientDashboardActor,
  ClientDashboardResult,
  DashboardDataDto,
} from "./contracts";

function requireClientDashboardActor(
  actor: ClientDashboardActor,
): ClientDashboardResult<{ userId: string }> {
  if (!actor.userId) {
    return err({ error: "forbidden", message: "Forbidden", status: 403 });
  }
  return ok({ userId: actor.userId });
}

export const clientDashboardService = {
  async getDashboardData(
    actor: ClientDashboardActor,
  ): Promise<ClientDashboardResult<DashboardDataDto>> {
    const actorResult = requireClientDashboardActor(actor);
    if (!actorResult.ok) {
      return actorResult;
    }
    const data = await clientDashboardRepository.getDashboardData(
      actorResult.data.userId,
    );
    return ok(data);
  },
};
