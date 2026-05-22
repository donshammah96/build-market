import { describe, expect, it } from "vitest";
import { ClientType } from "@prisma/client";
import {
  buildClientOnboardingPreferences,
  buildClientTypeComplianceRouting,
  resolveClientType,
} from "@/app/lib/domains/user-profile/client-type-compliance";

describe("client-type onboarding compliance routing", () => {
  it("resolves valid client type values and rejects unknown values", () => {
    expect(resolveClientType("HOMEOWNER")).toBe(ClientType.HOMEOWNER);
    expect(resolveClientType("GOVERNMENT_ENTITY")).toBe(
      ClientType.GOVERNMENT_ENTITY,
    );
    expect(resolveClientType("NOT_A_CLIENT_TYPE")).toBeNull();
    expect(resolveClientType(undefined)).toBeNull();
  });

  it("builds standard routing for non-government client types", () => {
    const routing = buildClientTypeComplianceRouting({
      clientType: ClientType.CORPORATE_DEVELOPER,
    });

    expect(routing).toEqual({
      clientType: ClientType.CORPORATE_DEVELOPER,
      onboardingBranch: "standard_client",
      requiresDedicatedProcurementCheck: false,
      projectCreationPolicy: "standard_client_policy",
      paymentInitiationPolicy: "standard_client_policy",
      status: "ready",
      missingRequirements: [],
    });
  });

  it("marks government entities as pending when procurement fields are missing", () => {
    const routing = buildClientTypeComplianceRouting({
      clientType: ClientType.GOVERNMENT_ENTITY,
      companyName: "County Procurement Office",
      companyRegistration: "",
      kraPin: null,
    });

    expect(routing.requiresDedicatedProcurementCheck).toBe(true);
    expect(routing.onboardingBranch).toBe("government_entity");
    expect(routing.projectCreationPolicy).toBe(
      "government_entity_procurement_check",
    );
    expect(routing.paymentInitiationPolicy).toBe(
      "government_entity_procurement_check",
    );
    expect(routing.status).toBe("pending_information");
    expect(routing.missingRequirements).toEqual([
      "companyRegistration",
      "kraPin",
    ]);
  });

  it("marks government entities as ready when required procurement fields are present", () => {
    const routing = buildClientTypeComplianceRouting({
      clientType: ClientType.GOVERNMENT_ENTITY,
      companyName: "County Procurement Office",
      companyRegistration: "CR12-KE-001",
      kraPin: "P051234567A",
    });

    expect(routing.status).toBe("ready");
    expect(routing.missingRequirements).toEqual([]);
  });

  it("merges compliance routing into existing preferences", () => {
    const routing = buildClientTypeComplianceRouting({
      clientType: ClientType.GOVERNMENT_ENTITY,
      companyName: "County Procurement Office",
      companyRegistration: "CR12-KE-001",
      kraPin: "P051234567A",
    });

    const preferences = buildClientOnboardingPreferences({
      existingPreferences: {
        theme: "light",
        onboarding: {
          completedStep: 1,
        },
      },
      routing,
    });

    expect(preferences).toMatchObject({
      theme: "light",
      onboarding: {
        completedStep: 1,
        clientType: "GOVERNMENT_ENTITY",
        clientTypeBranch: "government_entity",
      },
      complianceRouting: {
        scope: "client_type",
        clientType: "GOVERNMENT_ENTITY",
        requiresDedicatedProcurementCheck: true,
        projectCreationPolicy: "government_entity_procurement_check",
        paymentInitiationPolicy: "government_entity_procurement_check",
        status: "ready",
        missingRequirements: [],
      },
    });
  });
});
