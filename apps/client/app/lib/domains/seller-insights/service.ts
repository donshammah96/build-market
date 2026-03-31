import { err, ok } from "@/app/lib/errors/result";
import { normalizeRole } from "@/app/lib/security/roles";
import { sellerInsightsRepository } from "./repository";
import type {
  OrdersQueryInput,
  SellerInsightsActor,
  SellerInsightsResult,
  SellerInventoryAlertsResult,
  SellerOrderListResult,
  SellerTopProduct,
  SellerTopProductsQuery,
} from "./contracts";

const SELLER_INSIGHTS_ROLES = new Set(["professional", "admin"]);

function requireProfessionalActor(
  actor: SellerInsightsActor,
): SellerInsightsResult<{ userId: string }> {
  const role = normalizeRole(actor.role);
  if (!role || !SELLER_INSIGHTS_ROLES.has(role)) {
    return err({ error: "forbidden", message: "Forbidden", status: 403 });
  }
  return ok({ userId: actor.userId });
}

export const sellerInsightsService = {
  async getInventoryAlerts(
    actor: SellerInsightsActor,
  ): Promise<SellerInsightsResult<SellerInventoryAlertsResult>> {
    const actorResult = requireProfessionalActor(actor);
    if (!actorResult.ok) return actorResult;
    const data = await sellerInsightsRepository.getInventoryAlerts(
      actorResult.data.userId,
    );
    return ok(data);
  },

  async getOrders(
    actor: SellerInsightsActor,
    query: OrdersQueryInput,
  ): Promise<SellerInsightsResult<SellerOrderListResult>> {
    const actorResult = requireProfessionalActor(actor);
    if (!actorResult.ok) return actorResult;
    const data = await sellerInsightsRepository.getOrders(
      actorResult.data.userId,
      query,
    );
    return ok(data);
  },

  async getTopProducts(
    actor: SellerInsightsActor,
    query: SellerTopProductsQuery,
  ): Promise<SellerInsightsResult<SellerTopProduct[]>> {
    const actorResult = requireProfessionalActor(actor);
    if (!actorResult.ok) return actorResult;
    const limit = query.limit ?? 5;
    const data = await sellerInsightsRepository.getTopProducts(
      actorResult.data.userId,
      limit,
    );
    return ok(data);
  },
};
