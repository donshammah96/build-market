import { describe, it, expect } from "vitest";
import { Profession, County } from "@build/db";
import { aiCopilotService } from "../../../app/lib/domains/professionals/ai-copilot";

describe("AI Copilot Service (Human-in-the-Loop & Pricing Benchmarks)", () => {
  it("generates a draft bio marked with isDraft=true and disclaimer for human review", () => {
    const result = aiCopilotService.generateBioSuggestion({
      profession: Profession.ARCHITECT,
      county: County.NAIROBI,
      yearsOfExperience: 8,
      specializations: ["Sustainable Residential", "Passive Solar Design"],
      businessName: "Amani Design Studio",
      notableProjects: ["Karen Modern Eco-Villa", "Runda Green Residence"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.isDraft).toBe(true);
      expect(result.data.draftBio).toContain("Amani Design Studio");
      expect(result.data.draftBio).toContain("8 years");
      expect(result.data.draftBio).toContain("Sustainable Residential");
      expect(result.data.disclaimer).toContain("review and edit");
      expect(result.data.wordCount).toBeGreaterThan(15);
    }
  });

  it("returns pricing percentile bands labeled as informational market context", () => {
    const result = aiCopilotService.getServicePricingContext(
      Profession.MASON,
      County.NAIROBI,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.percentile25KES).toBeGreaterThan(0);
      expect(result.data.medianKES).toBeGreaterThan(
        result.data.percentile25KES,
      );
      expect(result.data.percentile75KES).toBeGreaterThan(
        result.data.medianKES,
      );
      expect(result.data.disclaimer).toContain("informational");
    }
  });
});
