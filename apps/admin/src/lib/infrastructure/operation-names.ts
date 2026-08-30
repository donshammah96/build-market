/**
 * Admin operation name registry — ADR-ADMIN-003 §7.3
 *
 * Every admin operation that emits a structured log event MUST use a name
 * from this registry.  Operation names are stable join keys across log
 * aggregation, alerting, and audit dashboards — renaming one is a breaking
 * observability change that requires coordinated dashboard updates.
 *
 * Format: <verb>_<resource>  (lower_snake_case, present tense)
 *
 * When adding a new operation:
 *   1. Add the constant here.
 *   2. Update ADR-ADMIN-003.md Operation Name Registry section.
 *   3. Update any dashboard/alert rules that join on operationName.
 */

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const AdminOperationName = {
  // ---- Users (Tier 1) -------------------------------------------------------
  LIST_USERS: "list_users",
  GET_USER_DETAIL: "get_user_detail",
  DELETE_USER: "delete_user",
  BULK_DELETE_USERS: "bulk_delete_users",
  INVITE_USER: "invite_user",
  RESET_CREDENTIALS: "reset_credentials",
  ASSIGN_ROLE: "assign_role",

  // ---- Verification (Tier 1) ------------------------------------------------
  LIST_PENDING_VERIFICATIONS: "list_pending_verifications",
  GET_VERIFICATION_STATS: "get_verification_stats",
  GET_VERIFICATION_DETAILS: "get_verification_details",
  VERIFY_ENTITY: "verify_entity",
  VERIFY_DOCUMENT: "verify_document",
  BATCH_VERIFY_DOCUMENTS: "batch_verify_documents",
  BATCH_VERIFY_ENTITIES: "batch_verify_entities",
  VERIFY_PROFESSIONAL: "verify_professional",
  REJECT_PROFESSIONAL: "reject_professional",

  // ---- Audit (Tier 1) -------------------------------------------------------
  QUERY_AUDIT_LOG: "query_audit_log",
  GET_AUDIT_STATS: "get_audit_stats",
  GET_AUDIT_ACTIONS: "get_audit_actions",
  EXPORT_AUDIT_LOG: "export_audit_log",

  // ---- Finance (Tier 1) -----------------------------------------------------
  GET_FINANCE_OVERVIEW: "get_finance_overview",
  GET_ANALYTICS: "get_analytics",
  GET_METRIC_TIMESERIES: "get_metric_timeseries",
  GET_GEO_DISTRIBUTION: "get_geo_distribution",
  GET_TOP_PROFESSIONALS: "get_top_professionals",

  // ---- Content (Tier 2) -----------------------------------------------------
  LIST_STORES: "list_stores",
  GET_STORE_DETAIL: "get_store_detail",
  GET_STORE_STATS: "get_store_stats",
  UPDATE_STORE: "update_store",
  TOGGLE_STORE_FEATURED: "toggle_store_featured",
  VERIFY_STORE: "verify_store",
  REJECT_STORE: "reject_store",
  DELETE_STORE: "delete_store",
  LIST_PROPERTIES: "list_properties",
  GET_PROPERTY_DETAIL: "get_property_detail",
  GET_PROPERTY_STATS: "get_property_stats",
  UPDATE_PROPERTY: "update_property",
  TOGGLE_PROPERTY_FEATURED: "toggle_property_featured",
  VERIFY_PROPERTY: "verify_property",
  REJECT_PROPERTY: "reject_property",
  CHANGE_PROPERTY_STATUS: "change_property_status",
  DELETE_PROPERTY: "delete_property",
  LIST_PROJECTS: "list_projects",
  GET_PROJECT_DETAIL: "get_project_detail",
  UPDATE_PROJECT: "update_project",
  DELETE_PROJECT: "delete_project",

  // ---- Leads / Services / Professionals (Tier 2) ----------------------------
  LIST_LEADS: "list_leads",
  GET_LEAD_DETAIL: "get_lead_detail",
  UPDATE_LEAD: "update_lead",
  DELETE_LEAD: "delete_lead",
  GET_LEAD_STATS: "get_lead_stats",
  BULK_UPDATE_LEAD_STATUS: "bulk_update_lead_status",
  EXPORT_LEADS: "export_leads",
  LIST_SERVICES: "list_services",
  GET_SERVICE_DETAIL: "get_service_detail",
  CREATE_SERVICE: "create_service",
  UPDATE_SERVICE: "update_service",
  TOGGLE_SERVICE_ACTIVE: "toggle_service_active",
  DELETE_SERVICE: "delete_service",
  REORDER_SERVICES: "reorder_services",
  GET_SERVICE_STATS: "get_service_stats",
  LIST_PROFESSIONALS: "list_professionals",
  GET_PROFESSIONAL_DETAIL: "get_professional_detail",
  UPDATE_PROFESSIONAL: "update_professional",
  DELETE_CERTIFICATE: "delete_certificate",

  // ---- Compliance / GDPR (Tier 1) -------------------------------------------
  GET_COMPLIANCE_QUEUE: "get_compliance_queue",
  GET_COMPLIANCE_QUEUE_STATUS: "get_compliance_queue_status",
  PROCESS_COMPLIANCE_REQUEST: "process_compliance_request",

  // ---- Settings (Tier 1) ----------------------------------------------------
  GET_SYSTEM_SETTINGS: "get_system_settings",
  UPDATE_SYSTEM_SETTINGS: "update_system_settings",
  CLEAR_SYSTEM_CACHE: "clear_system_cache",

  // ---- Dashboard ------------------------------------------------------------
  GET_DASHBOARD_STATS: "get_dashboard_stats",

  // ---- Subscriptions & Tiers (Tier 1) ---------------------------------------
  GET_SUBSCRIPTION_PLANS: "get_subscription_plans",
  UPDATE_SUBSCRIPTION_PLAN: "update_subscription_plan",
  GET_PROFESSIONAL_SUBSCRIPTION: "get_professional_subscription",
  OVERRIDE_PROFESSIONAL_SUBSCRIPTION: "override_professional_subscription",
  OVERRIDE_TRUST_TIER: "override_trust_tier",
  MANAGE_PROFESSIONAL_BADGE: "manage_professional_badge",
  CREATE_PROFILE_BOOST: "create_profile_boost",
  GET_LEAD_CREDIT_WALLET: "get_lead_credit_wallet",
  ADJUST_LEAD_CREDIT_WALLET: "adjust_lead_credit_wallet",
} as const;

export type AdminOperationName =
  (typeof AdminOperationName)[keyof typeof AdminOperationName];

// ---------------------------------------------------------------------------
// Validation helper — confirms a string is a registered operation name
// ---------------------------------------------------------------------------

const _registeredNames = new Set<string>(Object.values(AdminOperationName));

/**
 * Type guard that confirms `value` is a registered AdminOperationName.
 * Use in tests and drift-check scripts to catch unregistered operation names.
 */
export function isRegisteredOperationName(
  value: string,
): value is AdminOperationName {
  return _registeredNames.has(value);
}
