import { describe, expect, it } from "vitest";
import { ROUTES } from "@/lib/routes";

const parsedProfessionalOnboarding = new URL(
  ROUTES.professionalOnboarding,
  "http://localhost:3500",
);

describe("professional onboarding route contract", () => {
  it("keeps Join as a Pro on the dedicated professional sign-up path", () => {
    expect(ROUTES.joinAsPro).toBe("/professional/sign-up");
  });

  it("sends professional sign-up completion into locked professional onboarding", () => {
    expect(parsedProfessionalOnboarding.pathname).toBe("/onboarding");
    expect(parsedProfessionalOnboarding.searchParams.get("role")).toBe(
      "professional",
    );
    expect(parsedProfessionalOnboarding.searchParams.get("step")).toBe("2");
    expect(parsedProfessionalOnboarding.searchParams.get("source")).toBe(
      "join-as-pro",
    );
  });

  it("defines canonical professional pending verification route", () => {
    expect(ROUTES.professionalPendingVerification).toBe(
      "/professional-portal/pending-verification",
    );
  });

  it("defines canonical professional portal dashboard route", () => {
    expect(ROUTES.professionalDashboard).toBe("/professional-portal/dashboard");
  });
});
