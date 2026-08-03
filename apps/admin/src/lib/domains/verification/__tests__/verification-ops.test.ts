import { describe, expect, it, vi } from "vitest";
import { VerificationOpsService } from "../verification-ops";
import type { VerificationActor } from "../contracts";

vi.mock("@build/db", () => ({
  prisma: {
    regulatorVerificationCase: {
      count: vi.fn(async () => 5),
      findMany: vi.fn(async () => [
        {
          id: "case_001",
          professionalId: "pro_12345678",
          authority: "NCA",
          licenseNumber: "NCA-12345",
          status: "NEEDS_MANUAL_REVIEW",
          createdAt: new Date("2026-07-28T10:00:00Z"),
          rawVerificationData: { confidence: 0.65 },
        },
        {
          id: "case_002",
          professionalId: "pro_87654321",
          authority: "EPRA",
          licenseNumber: "EPRA-9999",
          status: "AUTO_VERIFIED",
          createdAt: new Date("2026-08-01T08:00:00Z"),
          rawVerificationData: { confidence: 0.95 },
        },
      ]),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id === "case_001") {
          return {
            id: "case_001",
            professionalId: "pro_12345678",
            authority: "NCA",
            licenseNumber: "NCA-12345",
            status: "VERIFIED",
            createdAt: new Date("2026-07-28T10:00:00Z"),
            rawVerificationData: { confidence: 0.95 },
            decisions: [
              {
                id: "dec_001",
                decision: "OVERRIDE_VERIFY",
                actorId: "actor_admin_1",
                createdAt: new Date("2026-07-29T12:00:00Z"),
              },
            ],
          };
        }
        return null;
      }),
    },
    systemSettings: {
      findUnique: vi.fn(async () => ({
        verificationSlaHours: 48,
      })),
    },
  },
}));

describe("VerificationOpsService", () => {
  const service = new VerificationOpsService();
  const mockActor: VerificationActor = {
    dbUserId: "admin_user_1",
    clerkId: "clerk_admin_1",
    adminRole: "SUPER_ADMIN",
  };

  it("retrieves paginated verification queue items with SLA calculation", async () => {
    const res = await service.listQueue(mockActor, "PENDING", 1, 10);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.total).toBe(5);
      expect(res.data.items).toHaveLength(2);
      expect(res.data.items[0]?.authority).toBe("NCA");
      expect(res.data.items[0]?.isSlaBreached).toBe(true);
    }
  });

  it("generates compliance decision packet for completed verification case", async () => {
    const res = await service.generateDecisionPacket(mockActor, "case_001");
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.packetId).toContain("PKT-case_001");
      expect(res.data.authority).toBe("NCA");
      expect(res.data.finalStatus).toBe("VERIFIED");
      expect(res.data.auditTrail).toHaveLength(1);
    }
  });

  it("returns NOT_FOUND error when generating decision packet for nonexistent case", async () => {
    const res = await service.generateDecisionPacket(mockActor, "nonexistent");
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("NOT_FOUND");
    }
  });
});
