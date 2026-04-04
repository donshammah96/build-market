import { beforeEach, describe, expect, it, vi } from "vitest";
import { enforceClientMutationPolicy } from "@/app/lib/domains/user-profile/client-type-policy";

const dbMock = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock("@build/db", () => ({
  prisma: {
    clientProfile: {
      findUnique: dbMock.findUnique,
    },
  },
}));

describe("client type policy enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows mutations when no client profile exists", async () => {
    dbMock.findUnique.mockResolvedValue(null);

    const result = await enforceClientMutationPolicy({
      clientUserId: "client-1",
      policy: "projectCreationPolicy",
    });

    expect(result).toEqual({ ok: true, routing: null });
  });

  it("blocks government entity project creation when procurement fields are missing", async () => {
    dbMock.findUnique.mockResolvedValue({
      type: "GOVERNMENT_ENTITY",
      companyName: "County Procurement Office",
      companyRegistration: null,
      kraPin: "",
    });

    const result = await enforceClientMutationPolicy({
      clientUserId: "client-1",
      policy: "projectCreationPolicy",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.routing.status).toBe("pending_information");
      expect(result.routing.missingRequirements).toEqual([
        "companyRegistration",
        "kraPin",
      ]);
      expect(result.message).toContain("Missing required fields");
    }
  });

  it("allows government entity payment initiation once procurement data is complete", async () => {
    dbMock.findUnique.mockResolvedValue({
      type: "GOVERNMENT_ENTITY",
      companyName: "County Procurement Office",
      companyRegistration: "CR12-KE-001",
      kraPin: "P051234567A",
    });

    const result = await enforceClientMutationPolicy({
      clientUserId: "client-1",
      policy: "paymentInitiationPolicy",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.routing?.status).toBe("ready");
      expect(result.routing?.paymentInitiationPolicy).toBe(
        "government_entity_procurement_check",
      );
    }
  });
});
