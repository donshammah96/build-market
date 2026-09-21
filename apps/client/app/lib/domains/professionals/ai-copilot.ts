import { Profession, County } from "@build/db";
import { ok, err, type Result } from "@/app/lib/errors/result";

export interface GenerateBioInput {
  profession: Profession;
  county: County;
  yearsOfExperience: number;
  specializations: string[];
  notableProjects?: string[];
  businessName?: string;
}

export interface GeneratedBioSuggestion {
  draftBio: string;
  wordCount: number;
  highlightedKeywords: string[];
  generatedAt: string;
  disclaimer: string;
  isDraft: true; // Explicit flag ensuring human-in-the-loop review before publishing
}

export interface ServicePricingBenchmark {
  profession: Profession;
  serviceCategory: string;
  county: County;
  unit: string;
  percentile25KES: number;
  medianKES: number;
  percentile75KES: number;
  disclaimer: string;
}

export interface AiCopilotDomainError {
  code: "INVALID_INPUT" | "GENERATION_FAILED";
  message: string;
  details?: Record<string, unknown>;
}

// Localized market pricing benchmarks (informational market context only)
const KENYA_SERVICE_PRICE_BENCHMARKS: Record<
  string,
  { unit: string; p25: number; median: number; p75: number }
> = {
  [Profession.ARCHITECT]: {
    unit: "per sq. meter drawing / scheme",
    p25: 1200,
    median: 1800,
    p75: 2500,
  },
  [Profession.STRUCTURAL_ENGINEER]: {
    unit: "per structural calculation package",
    p25: 45000,
    median: 75000,
    p75: 120000,
  },
  [Profession.QUANTITY_SURVEYOR]: {
    unit: "per BOQ preparation",
    p25: 35000,
    median: 60000,
    p75: 95000,
  },
  [Profession.MASON]: {
    unit: "per day standard rate",
    p25: 1500,
    median: 2000,
    p75: 2800,
  },
  [Profession.ELECTRICIAN]: {
    unit: "per electrical outlet / conduit point",
    p25: 400,
    median: 650,
    p75: 950,
  },
  [Profession.PLUMBER]: {
    unit: "per plumbing fixture installation",
    p25: 1200,
    median: 1800,
    p75: 2500,
  },
  [Profession.PAINTER]: {
    unit: "per sq. meter (3-coat finish)",
    p25: 180,
    median: 260,
    p75: 380,
  },
};

export class AiCopilotService {
  /**
   * Generates a suggested professional bio draft.
   * Human-in-the-loop invariant: Returns a draft payload for professional review; never auto-publishes.
   */
  generateBioSuggestion(
    input: GenerateBioInput,
  ): Result<GeneratedBioSuggestion, AiCopilotDomainError> {
    if (!input.profession || !input.county) {
      return err({
        code: "INVALID_INPUT",
        message:
          "Profession and County are required to generate bio suggestions",
      });
    }

    const expText =
      input.yearsOfExperience > 0
        ? `With over ${input.yearsOfExperience} years of hands-on experience across ${input.county} County and neighboring regions,`
        : `Operating across ${input.county} County,`;

    const namePrefix = input.businessName
      ? `${input.businessName} is a dedicated`
      : `A dedicated`;
    const professionTitle = input.profession.toLowerCase().replace(/_/g, " ");

    const specText =
      input.specializations.length > 0
        ? `Specializing in ${input.specializations.join(", ")}, our focus is delivering high-precision workmanship, regulatory compliance, and transparent project milestones.`
        : `Committed to quality craft, safety benchmarks, and on-time project delivery.`;

    const projectText =
      input.notableProjects && input.notableProjects.length > 0
        ? ` Recent highlights include successful delivery of ${input.notableProjects.slice(0, 2).join(" and ")}.`
        : "";

    const draftBio = `${namePrefix} ${professionTitle} professional. ${expText} ${specText}${projectText} Dedicated to building trust with clients through verified standards, detailed quotes, and rigorous site execution.`;

    return ok({
      draftBio,
      wordCount: draftBio.split(/\s+/).length,
      highlightedKeywords: [
        input.profession,
        input.county,
        ...input.specializations,
      ],
      generatedAt: new Date().toISOString(),
      disclaimer:
        "This AI-drafted bio is an informational suggestion. Please review and edit all claims before saving to your profile.",
      isDraft: true,
    });
  }

  /**
   * Returns localized pricing percentile context.
   * Invariant: Provided strictly as market context; never used for price-fixing or forced quote pricing.
   */
  getServicePricingContext(
    profession: Profession,
    county: County,
  ): Result<ServicePricingBenchmark, AiCopilotDomainError> {
    const benchmark = KENYA_SERVICE_PRICE_BENCHMARKS[profession] ?? {
      unit: "per standard scope item",
      p25: 1000,
      median: 2000,
      p75: 3500,
    };

    // Nairobi / Kiambu cost of living multiplier adjustment (informational)
    const multiplier =
      county === County.NAIROBI || county === County.KIAMBU ? 1.15 : 1.0;

    return ok({
      profession,
      serviceCategory: profession.toLowerCase().replace(/_/g, " "),
      county,
      unit: benchmark.unit,
      percentile25KES: Math.round(benchmark.p25 * multiplier),
      medianKES: Math.round(benchmark.median * multiplier),
      percentile75KES: Math.round(benchmark.p75 * multiplier),
      disclaimer:
        "Price ranges represent general market context across registered trade professionals in Kenya and are purely informational.",
    });
  }
}

export const aiCopilotService = new AiCopilotService();
