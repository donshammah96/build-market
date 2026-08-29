import { ClientType, type Prisma } from "@prisma/client";

const VALID_CLIENT_TYPES = new Set<ClientType>(Object.values(ClientType));

export type GovernmentEntityComplianceRequirement =
  "companyName" | "companyRegistration" | "kraPin";

export type ClientTypeOnboardingBranch =
  "standard_client" | "government_entity";

export type ClientTypeComplianceRouting = {
  clientType: ClientType;
  onboardingBranch: ClientTypeOnboardingBranch;
  requiresDedicatedProcurementCheck: boolean;
  projectCreationPolicy:
    "standard_client_policy" | "government_entity_procurement_check";
  paymentInitiationPolicy:
    "standard_client_policy" | "government_entity_procurement_check";
  status: "ready" | "pending_information";
  missingRequirements: GovernmentEntityComplianceRequirement[];
};

export type ClientTypeComplianceRoutingInput = {
  clientType?: ClientType | null;
  companyName?: string | null;
  companyRegistration?: string | null;
  kraPin?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

export function resolveClientType(value: unknown): ClientType | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (VALID_CLIENT_TYPES.has(normalized as ClientType)) {
    return normalized as ClientType;
  }

  return null;
}

export function isGovernmentEntityClientType(clientType: ClientType): boolean {
  return clientType === ClientType.GOVERNMENT_ENTITY;
}

export function buildClientTypeComplianceRouting(
  input: ClientTypeComplianceRoutingInput,
): ClientTypeComplianceRouting {
  const clientType = input.clientType ?? ClientType.HOMEOWNER;

  if (!isGovernmentEntityClientType(clientType)) {
    return {
      clientType,
      onboardingBranch: "standard_client",
      requiresDedicatedProcurementCheck: false,
      projectCreationPolicy: "standard_client_policy",
      paymentInitiationPolicy: "standard_client_policy",
      status: "ready",
      missingRequirements: [],
    };
  }

  const missingRequirements: GovernmentEntityComplianceRequirement[] = [];

  if (isBlank(input.companyName)) {
    missingRequirements.push("companyName");
  }

  if (isBlank(input.companyRegistration)) {
    missingRequirements.push("companyRegistration");
  }

  if (isBlank(input.kraPin)) {
    missingRequirements.push("kraPin");
  }

  return {
    clientType,
    onboardingBranch: "government_entity",
    requiresDedicatedProcurementCheck: true,
    projectCreationPolicy: "government_entity_procurement_check",
    paymentInitiationPolicy: "government_entity_procurement_check",
    status: missingRequirements.length === 0 ? "ready" : "pending_information",
    missingRequirements,
  };
}

export function buildClientOnboardingPreferences(params: {
  existingPreferences?: Prisma.JsonValue | null;
  routing: ClientTypeComplianceRouting;
}): Prisma.InputJsonValue {
  const basePreferences = isRecord(params.existingPreferences)
    ? params.existingPreferences
    : {};
  const onboardingPreferences = isRecord(basePreferences.onboarding)
    ? basePreferences.onboarding
    : {};

  return {
    ...basePreferences,
    onboarding: {
      ...onboardingPreferences,
      clientType: params.routing.clientType,
      clientTypeBranch: params.routing.onboardingBranch,
    },
    complianceRouting: {
      scope: "client_type",
      clientType: params.routing.clientType,
      requiresDedicatedProcurementCheck:
        params.routing.requiresDedicatedProcurementCheck,
      projectCreationPolicy: params.routing.projectCreationPolicy,
      paymentInitiationPolicy: params.routing.paymentInitiationPolicy,
      status: params.routing.status,
      missingRequirements: params.routing.missingRequirements,
    },
  };
}
