import { describe, it, expect, vi, beforeEach } from "vitest";
import { marketplaceLeadsService } from "@/app/lib/domains/marketplace-leads/service";
import { marketplaceLeadsRepository } from "@/app/lib/domains/marketplace-leads/repository";

describe("Marketplace Leads Domain Service", () => {
  const mockClientId = "user-client-123";
  const mockProId = "user-pro-456";
  const mockLeadId = "mlead-789";
  const mockRoutingEventId = "mroute-abc";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a draft marketplace lead with DRAFT status", async () => {
    vi.spyOn(marketplaceLeadsRepository, "createLead").mockResolvedValue({
      id: mockLeadId,
      clientId: mockClientId,
      projectCounty: "Nairobi",
      projectType: "residential",
      title: "4 Bedroom Townhouse",
      description: "Modern design on 1/4 acre",
      status: "DRAFT",
      createdAt: new Date(),
      updatedAt: new Date(),
      qualification: null,
      documents: [],
      routingEvents: [],
    } as any);

    const result = await marketplaceLeadsService.createDraftLead(mockClientId, {
      projectCounty: "Nairobi",
      projectType: "residential",
      title: "4 Bedroom Townhouse",
      description: "Modern design on 1/4 acre",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.leadId).toBe(mockLeadId);
      expect(result.data.status).toBe("DRAFT");
      expect(result.data.projectCounty).toBe("Nairobi");
    }
  });

  it("submits a qualified lead and calculates confidence score via scoring engine", async () => {
    vi.spyOn(marketplaceLeadsRepository, "findLeadForClient").mockResolvedValue(
      {
        id: mockLeadId,
        clientId: mockClientId,
        projectCounty: "Kiambu",
        projectType: "residential",
        title: "Family Villa",
        status: "DRAFT",
        qualification: {
          landOwnershipStatus: "OWNED_TITLED",
          architecturalStage: "COUNTY_APPROVED",
          budgetReadiness: "FINANCING_APPROVED",
          budgetRangeMin: 15_000_000,
          budgetRangeMax: 20_000_000,
        },
        documents: [
          {
            id: "doc-1",
            type: "TITLE_DEED",
            scanStatus: "clean",
          },
        ],
        routingEvents: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any,
    );

    vi.spyOn(
      marketplaceLeadsRepository,
      "updateScoredQualification",
    ).mockResolvedValue({
      landOwnershipStatus: "OWNED_TITLED",
      architecturalStage: "COUNTY_APPROVED",
      budgetReadiness: "FINANCING_APPROVED",
      budgetRangeMin: 15_000_000,
      budgetRangeMax: 20_000_000,
      confidenceScore: 0.988,
      confidenceLabel: "high",
    } as any);

    vi.spyOn(marketplaceLeadsRepository, "updateLead").mockResolvedValue({
      id: mockLeadId,
      status: "QUALIFIED",
      projectCounty: "Kiambu",
      projectType: "residential",
      title: "Family Villa",
      documents: [{ id: "doc-1" }],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const result = await marketplaceLeadsService.submitLeadForQualification(
      mockClientId,
      mockLeadId,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("QUALIFIED");
      expect(result.data.qualification?.confidenceLabel).toBe("high");
      expect(result.data.qualification?.confidenceScore).toBeGreaterThanOrEqual(
        0.75,
      );
    }
  });

  it("enforces masked contact information during professional inbox listing", async () => {
    vi.spyOn(
      marketplaceLeadsRepository,
      "listRoutingEventsForProfessional",
    ).mockResolvedValue([
      {
        id: mockRoutingEventId,
        matchScore: 0.92,
        confidenceLabel: "high",
        routedAt: new Date(),
        outcome: null,
        lead: {
          id: mockLeadId,
          projectCounty: "Nairobi",
          projectType: "commercial_fit_out",
          title: "Office Fit-out",
          description: "200 sqm corporate workspace",
          qualification: {
            budgetReadiness: "PROOF_OF_FUNDS",
            budgetRangeMin: 5_000_000,
            budgetRangeMax: 8_000_000,
            landOwnershipStatus: "LEASED",
            architecturalStage: "APPROVED_DRAWINGS",
          },
        },
      },
    ] as any);

    const result =
      await marketplaceLeadsService.listMaskedLeadsForProfessional(mockProId);

    expect(result.ok).toBe(true);
    if (result.ok && result.data[0]) {
      expect(result.data).toHaveLength(1);
      const item = result.data[0];
      expect(item.isContactDisclosed).toBe(false);
      expect((item as any).clientPhone).toBeUndefined();
      expect((item as any).clientEmail).toBeUndefined();
      expect(item.confidenceLabel).toBe("high");
      expect(item.matchScore).toBe(0.92);
    }
  });

  it("reveals contact information when professional accepts routed lead and stamps disclosure timestamp", async () => {
    const disclosedTime = new Date();

    vi.spyOn(
      marketplaceLeadsRepository,
      "acceptRoutingEvent",
    ).mockResolvedValue({
      id: mockRoutingEventId,
      outcome: "accepted",
      outcomeAt: disclosedTime,
      contactDisclosedAt: disclosedTime,
    } as any);

    vi.spyOn(
      marketplaceLeadsRepository,
      "findRoutingEventWithDisclosedLead",
    ).mockResolvedValue({
      id: mockRoutingEventId,
      professionalId: mockProId,
      matchScore: 0.95,
      routedAt: new Date(),
      contactDisclosedAt: disclosedTime,
      lead: {
        id: mockLeadId,
        projectCounty: "Nairobi",
        projectType: "residential",
        title: "Villa Project",
        description: "Full residential build",
        status: "QUALIFIED",
        client: {
          id: mockClientId,
          firstName: "Wanjiku",
          lastName: "Kamau",
          displayName: "Wanjiku K.",
          email: "wanjiku@example.com",
          phone: "+254712345678",
        },
        qualification: {
          landOwnershipStatus: "OWNED_TITLED",
          architecturalStage: "APPROVED_DRAWINGS",
          budgetReadiness: "FINANCING_APPROVED",
          confidenceScore: 0.91,
          confidenceLabel: "high",
          scoringRuleVersion: "leads-v3",
          breakdownJson: {},
        },
        documents: [
          {
            id: "doc-1",
            type: "TITLE_DEED",
            scanStatus: "clean",
            createdAt: new Date(),
          },
        ],
      },
    } as any);

    const result = await marketplaceLeadsService.acceptRoutedLead(
      mockProId,
      mockRoutingEventId,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isContactDisclosed).toBe(true);
      expect(result.data.client.email).toBe("wanjiku@example.com");
      expect(result.data.client.phone).toBe("+254712345678");
      expect(result.data.client.firstName).toBe("Wanjiku");
      expect(result.data.acceptedAt).toBeDefined();
    }
  });
});
