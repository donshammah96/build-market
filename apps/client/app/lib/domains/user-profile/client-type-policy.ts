import { prisma } from "@build/db";
import type { ClientType } from "@prisma/client";
import {
  buildClientTypeComplianceRouting,
  resolveClientType,
  type ClientTypeComplianceRouting,
} from "./client-type-compliance";

export type ClientMutationPolicy =
  "projectCreationPolicy" | "paymentInitiationPolicy";

export type ClientMutationPolicyResult =
  | {
      ok: true;
      routing: ClientTypeComplianceRouting | null;
    }
  | {
      ok: false;
      routing: ClientTypeComplianceRouting;
      message: string;
    };

type ClientPolicyProfileSnapshot = {
  type: ClientType | null;
  companyName: string | null;
  companyRegistration: string | null;
  kraPin: string | null;
};

function selectPolicyRoute(
  routing: ClientTypeComplianceRouting,
  policy: ClientMutationPolicy,
) {
  if (policy === "projectCreationPolicy") {
    return routing.projectCreationPolicy;
  }

  return routing.paymentInitiationPolicy;
}

function buildPolicyBlockMessage(routing: ClientTypeComplianceRouting): string {
  if (routing.missingRequirements.length === 0) {
    return "Government entity procurement compliance is incomplete.";
  }

  return `Government entity procurement compliance is incomplete. Missing required fields: ${routing.missingRequirements.join(", ")}.`;
}

async function readClientPolicyProfile(
  clientUserId: string,
): Promise<ClientPolicyProfileSnapshot | null> {
  return prisma.clientProfile.findUnique({
    where: { userId: clientUserId },
    select: {
      type: true,
      companyName: true,
      companyRegistration: true,
      kraPin: true,
    },
  });
}

export async function enforceClientMutationPolicy(params: {
  clientUserId: string;
  policy: ClientMutationPolicy;
}): Promise<ClientMutationPolicyResult> {
  const profile = await readClientPolicyProfile(params.clientUserId);
  if (!profile) {
    return { ok: true, routing: null };
  }

  const clientType = resolveClientType(profile.type);
  const routing = buildClientTypeComplianceRouting({
    clientType: clientType ?? undefined,
    companyName: profile.companyName,
    companyRegistration: profile.companyRegistration,
    kraPin: profile.kraPin,
  });

  const route = selectPolicyRoute(routing, params.policy);
  const requiresDedicatedProcurementCheck =
    route === "government_entity_procurement_check";

  if (!requiresDedicatedProcurementCheck || routing.status === "ready") {
    return { ok: true, routing };
  }

  return {
    ok: false,
    routing,
    message: buildPolicyBlockMessage(routing),
  };
}
