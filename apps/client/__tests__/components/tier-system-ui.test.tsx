// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TrustSealBadge } from "@build/ui/trust-seal-badge";
import { BadgeRow } from "@build/ui/badge-row";
import { PlanChip } from "@build/ui/plan-chip";
import { SponsoredLabel } from "@build/ui/sponsored-label";
import { InsuredIndicator } from "@build/ui/insured-indicator";
import { validateKenyanPhone } from "@build/ui/mpesa-stk-modal";

describe("Professional Tier System UI Primitives (@build/ui)", () => {
  describe("Must-Fix #1: TrustSealBadge Visual Split", () => {
    it("renders circular engraved SVG seal for LICENSE_VERIFIED and ELITE", () => {
      const { container: licensedContainer } = render(
        <TrustSealBadge
          tier="LICENSE_VERIFIED"
          authority="NCA"
          licenseNumber="NCA-12345"
        />,
      );

      // Must have SVG circular seal and textPath
      expect(licensedContainer.querySelector("circle")).toBeInTheDocument();
      expect(licensedContainer.querySelector("textPath")).toBeInTheDocument();
      expect(screen.getAllByText(/NCA/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Regulator Licensed/i)).toBeInTheDocument();

      const { container: eliteContainer } = render(
        <TrustSealBadge
          tier="ELITE"
          authority="BORAQS"
          licenseNumber="A-999"
        />,
      );
      expect(eliteContainer.querySelector("circle")).toBeInTheDocument();
      expect(screen.getByText(/Elite Professional/i)).toBeInTheDocument();
    });

    it("renders simple non-regulator checkmark chip for SKILLS_VERIFIED and ID_VERIFIED (no circular stamp)", () => {
      const { container: skillsContainer } = render(
        <TrustSealBadge tier="SKILLS_VERIFIED" />,
      );

      // Must NOT contain circular engraved seal textPath
      expect(skillsContainer.querySelector("textPath")).toBeNull();
      expect(screen.getByText("Skills Verified")).toBeInTheDocument();

      const { container: idContainer } = render(
        <TrustSealBadge tier="ID_VERIFIED" />,
      );
      expect(idContainer.querySelector("textPath")).toBeNull();
      expect(screen.getByText("ID Verified")).toBeInTheDocument();
    });

    it("renders plain text with NO stamp shape for UNVERIFIED", () => {
      const { container } = render(<TrustSealBadge tier="UNVERIFIED" />);

      expect(container.querySelector("svg")).toBeNull();
      expect(screen.getByText("Not yet verified")).toBeInTheDocument();
    });
  });

  describe("Must-Fix #2: BadgeRow Schema Accuracy", () => {
    it("renders strictly the 5 schema BadgeType values", () => {
      render(
        <BadgeRow
          earnedBadges={["TOP_RATED", "FOUNDING_PRO"]}
          showLocked={true}
        />,
      );

      // All 5 real BadgeType values displayed (with earned vs locked status)
      expect(screen.getByText("Top Rated")).toBeInTheDocument();
      expect(screen.getByText("Founding Pro")).toBeInTheDocument();
      expect(screen.getByText("Fast Responder")).toBeInTheDocument();
      expect(screen.getByText("Rising Talent")).toBeInTheDocument();
      expect(screen.getByText("Elite Pro")).toBeInTheDocument();

      // Must not render trust tiers as badges
      expect(screen.queryByText("Skills Verified")).toBeNull();
      expect(screen.queryByText("License Verified")).toBeNull();
    });

    it("renders only earned badges when showLocked is false", () => {
      render(<BadgeRow earnedBadges={["TOP_RATED"]} showLocked={false} />);

      expect(screen.getByText("Top Rated")).toBeInTheDocument();
      expect(screen.queryByText("Fast Responder")).toBeNull();
    });
  });

  describe("InsuredIndicator Standalone Component", () => {
    it("renders insurance indicator when isInsured is true and null when false", () => {
      const { rerender } = render(<InsuredIndicator isInsured={true} />);
      expect(screen.getByText("Insured")).toBeInTheDocument();

      rerender(<InsuredIndicator isInsured={false} />);
      expect(screen.queryByText("Insured")).toBeNull();
    });
  });

  describe("SponsoredLabel Guardrail", () => {
    it("renders visible sponsored tag with prominent aria-label", () => {
      render(<SponsoredLabel label="Sponsored" />);

      const badge = screen.getByText("Sponsored");
      expect(badge).toBeInTheDocument();
      expect(screen.getByLabelText(/Sponsored ranking/i)).toBeInTheDocument();
    });
  });

  describe("PlanChip Variants and Trialing Support", () => {
    it("renders plan chip with status and founding pro marker", () => {
      render(
        <PlanChip planKey="BUSINESS" status="TRIALING" isFoundingPro={true} />,
      );

      expect(screen.getByText("Bora (Business)")).toBeInTheDocument();
      expect(screen.getByText("Trialing")).toBeInTheDocument();
      expect(screen.getByText("Founding Pro")).toBeInTheDocument();
    });
  });

  describe("M-Pesa STK Phone Validation", () => {
    it("validates Kenyan phone formats", () => {
      expect(validateKenyanPhone("0712345678")).toBe(true);
      expect(validateKenyanPhone("0112345678")).toBe(true);
      expect(validateKenyanPhone("254712345678")).toBe(true);
      expect(validateKenyanPhone("+254712345678")).toBe(true);

      expect(validateKenyanPhone("0812345678")).toBe(false);
      expect(validateKenyanPhone("12345")).toBe(false);
      expect(validateKenyanPhone("")).toBe(false);
    });
  });
});
