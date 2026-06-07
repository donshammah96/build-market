/**
 * Entity Route Configuration
 *
 * Centralized routing strategy for verification notifications.
 * Each entity type has dedicated routes for management and verification status.
 */

import type { EntityType } from "./types";
import type { NotificationType } from "./notification-templates";

/**
 * Route configuration for each entity type
 */
export interface EntityRouteConfig {
  /** Base management route (for listing/managing entities) */
  managementRoute: string;
  /** Route builder for specific entity (when entityId available) */
  entityDetailRoute?: (entityId: string) => string;
  /** Route for verification status view */
  verificationRoute?: string;
  /** Query parameter key for status filtering */
  statusQueryKey?: string;
}

/**
 * Route configurations for all entity types
 */
export const ENTITY_ROUTES: Record<EntityType, EntityRouteConfig> = {
  professional: {
    managementRoute: "/professional-portal/settings",
    entityDetailRoute: (id) => `/professional-portal/profile/${id}`,
    verificationRoute: "/professional-portal/settings?tab=verification",
    statusQueryKey: "status",
  },
  store: {
    managementRoute: "/professional-portal/settings/stores",
    entityDetailRoute: (id) => `/professional-portal/settings/stores?id=${id}`,
    verificationRoute: "/professional-portal/settings/stores?tab=verification",
    statusQueryKey: "status",
  },
  property: {
    managementRoute: "/professional-portal/settings/properties",
    entityDetailRoute: (id) => `/properties/${id}`,
    verificationRoute:
      "/professional-portal/settings/properties?tab=verification",
    statusQueryKey: "status",
  },
  certificate: {
    managementRoute: "/professional-portal/settings",
    verificationRoute: "/professional-portal/settings?tab=certificates",
    statusQueryKey: "status",
  },
};

/**
 * Build verification link for an entity based on notification type
 *
 * @param entityType - Type of entity (professional, store, property, certificate)
 * @param notificationType - Type of notification (VERIFIED, REJECTED, etc.)
 * @param options - Optional parameters including entityId for detail routes
 * @returns Complete route with query parameters
 */
export function buildVerificationLink(
  entityType: EntityType,
  notificationType: NotificationType,
  options?: {
    entityId?: string;
  },
): string {
  const config = ENTITY_ROUTES[entityType];

  // Prefer entity detail route if entityId available
  if (options?.entityId && config.entityDetailRoute) {
    const baseRoute = config.entityDetailRoute(options.entityId);
    return addStatusQuery(baseRoute, notificationType, config.statusQueryKey);
  }

  // Use verification-specific route if available
  if (config.verificationRoute) {
    return addStatusQuery(
      config.verificationRoute,
      notificationType,
      config.statusQueryKey,
    );
  }

  // Fallback to management route
  return addStatusQuery(
    config.managementRoute,
    notificationType,
    config.statusQueryKey,
  );
}

/**
 * Add status query parameter to route based on notification type
 *
 * @param route - Base route
 * @param notificationType - Type of notification
 * @param queryKey - Query parameter key (default: "status")
 * @returns Route with status query parameter appended
 */
function addStatusQuery(
  route: string,
  notificationType: NotificationType,
  queryKey?: string,
): string {
  if (!queryKey) return route;

  // Map notification types to URL-friendly status values
  const statusMap: Partial<Record<NotificationType, string>> = {
    REJECTED: "rejected",
    NEEDS_CORRECTION: "needs_correction",
    VERIFIED: "verified",
    DOCUMENT_APPROVED: "approved",
    DOCUMENT_REJECTED: "rejected",
  };

  const status = statusMap[notificationType];
  if (!status) return route;

  // Append query parameter (handle existing query params)
  const separator = route.includes("?") ? "&" : "?";
  return `${route}${separator}${queryKey}=${status}`;
}

/**
 * Get management route for an entity type
 */
export function getManagementRoute(entityType: EntityType): string {
  return ENTITY_ROUTES[entityType].managementRoute;
}

/**
 * Get verification route for an entity type
 */
export function getVerificationRoute(entityType: EntityType): string {
  return (
    ENTITY_ROUTES[entityType].verificationRoute ||
    ENTITY_ROUTES[entityType].managementRoute
  );
}

/**
 * Get entity detail route if available
 */
export function getEntityDetailRoute(
  entityType: EntityType,
  entityId: string,
): string | null {
  const config = ENTITY_ROUTES[entityType];
  return config.entityDetailRoute ? config.entityDetailRoute(entityId) : null;
}
