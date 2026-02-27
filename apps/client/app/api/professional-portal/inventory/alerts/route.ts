import { createProfessionalPortalGet } from "@/app/lib/api/professional-portal-handler";
import { getInventoryAlerts } from "@/lib/services/inventory";

/**
 * GET /api/professional-portal/inventory/alerts
 * Get inventory alerts for the professional's stores.
 */
export const GET = createProfessionalPortalGet({
  rateLimitKey: "inventory-alerts",
  handler: async ({ dbUserId }) => getInventoryAlerts(dbUserId),
  operationName: "get_inventory_alerts",
  errorMessage: "Failed to fetch inventory alerts",
});
