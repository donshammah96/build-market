// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CTA } from "@/components/home/CTA";
import { ReviewCard } from "@/components/reviews/ReviewCard";
import { ReviewsSection } from "@/components/reviews/ReviewsSection";
import VendorCard from "@/components/vendors/VendorCard";
import { VendorsSection } from "@/components/vendors/VendorSection";
import PropertyCard from "@/components/real-estate/PropertyCard";
import { Property } from "@/components/real-estate/Property";
import ProfessionalCard from "@/components/professional/ProfessionalCard";
import { Professionals } from "@/components/professional/Professionals";
import type { StoreCategory, County } from "@/types/store";
import type { PropertyCardData } from "@/types/property";
import type { Profession } from "@/types/professional";

beforeEach(() => {
  global.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;

  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;

  window.matchMedia =
    window.matchMedia ||
    (function () {
      return {
        matches: false,
        addListener: function () {},
        removeListener: function () {},
        addEventListener: function () {},
        removeEventListener: function () {},
        dispatchEvent: function () {
          return false;
        },
      };
    } as any);
});

describe("Landing Page Dark Mode Theme Compliance & Hardcoded Color Audit", () => {
  describe("CTA Section", () => {
    it("does not use inverted from-foreground gradient that breaks in dark mode", () => {
      const { container } = render(<CTA />);
      const section = container.querySelector("section");
      expect(section).not.toBeNull();
      // from-foreground inverts to near-white in dark mode
      expect(section?.className).not.toContain("from-foreground");
      expect(section?.className).not.toContain("via-foreground");
    });

    it("does not clash text-primary-foreground (black in dark mode) on white text", () => {
      const { container } = render(<CTA />);
      const spanHighlight = container.querySelector("h2 span");
      expect(spanHighlight?.className).not.toContain("text-primary-foreground");
    });
  });

  describe("ReviewCard Component", () => {
    it("uses bg-card and semantic tokens instead of hardcoded bg-white and border-zinc-100", () => {
      const { container } = render(
        <ReviewCard
          quote="Exceptional service!"
          name="Wanjiku Mwangi"
          location="Nairobi"
          role="Homeowner"
          image="/avatar.jpg"
        />,
      );
      const card = container.querySelector('[class*="rounded-2xl"]');
      expect(card?.className).not.toContain("bg-white");
      expect(card?.className).not.toContain("border-zinc-100");
      expect(card?.className).toContain("bg-card");
    });

    it("does not use text-zinc-900 or text-zinc-700 which have poor contrast in dark mode", () => {
      const { container } = render(
        <ReviewCard
          quote="Exceptional service!"
          name="Wanjiku Mwangi"
          location="Nairobi"
          role="Homeowner"
          image="/avatar.jpg"
        />,
      );
      expect(container.innerHTML).not.toContain("text-zinc-900");
      expect(container.innerHTML).not.toContain("text-zinc-700");
    });
  });

  describe("ReviewsSection Component", () => {
    it("does not use hardcoded bg-zinc-50 or text-zinc-900", () => {
      const { container } = render(<ReviewsSection />);
      const section = container.querySelector("section");
      expect(section?.className).not.toContain("bg-zinc-50");
      expect(container.innerHTML).not.toContain("text-zinc-900");
    });
  });

  describe("VendorCard Component", () => {
    it("uses bg-card instead of hardcoded bg-white and border-zinc-200", () => {
      const mockVendor = {
        id: "1",
        name: "Test Hardware",
        description: "Best supplies",
        image: "/hardware.png",
        categories: ["hardware" as StoreCategory],
        verified: true,
        rating: 4.5,
        slug: "hardware",
        county: "NAIROBI" as County,
        images: [],
        categoryLabels: ["Hardware"],
        storeType: "retail" as any,
        storeTypeLabel: "Retail",
        reviewCount: 10,
        productCount: 50,
        location: "Nairobi",
        address: "123 Street",
        city: "Nairobi",
        featured: true,
      };

      const { container } = render(<VendorCard vendor={mockVendor} />);
      const card = container.querySelector('[class*="rounded-xl"]');
      expect(card?.className).not.toContain("bg-white");
      expect(card?.className).not.toContain("border-zinc-200");
      expect(card?.className).toContain("bg-card");
      expect(container.innerHTML).not.toContain("text-zinc-900");
    });
  });

  describe("VendorsSection Component", () => {
    it("does not use hardcoded bg-white for the full-width section", () => {
      const { container } = render(<VendorsSection />);
      const section = container.querySelector("section");
      expect(section?.className).not.toContain("bg-white");
      expect(section?.className).not.toContain("bg-zinc-50");
    });
  });

  describe("PropertyCard Component", () => {
    it("uses bg-card instead of hardcoded bg-white and border-zinc-200", () => {
      const mockProperty: PropertyCardData = {
        id: "1",
        title: "Modern Apartment",
        price: 15000000,
        currency: "KES",
        location: "Kilimani, Nairobi",
        county: "NAIROBI" as County,
        countyLabel: "Nairobi",
        type: "SALE" as any,
        typeLabel: "Sale",
        category: "RESIDENTIAL" as any,
        categoryLabel: "Residential",
        status: "AVAILABLE" as any,
        statusLabel: "Available",
        beds: 3,
        baths: 2,
        area: 1500,
        image: "/property.jpg",
        featured: true,
        verified: true,
        agent: {
          id: "agent-1",
          name: "Agent Name",
          image: "/agent.jpg",
          companyName: "Agency",
        },
        createdAt: new Date().toISOString(),
      };

      const { container } = render(<PropertyCard property={mockProperty} />);
      const card = container.querySelector('[class*="rounded-xl"]');
      expect(card?.className).not.toContain("bg-white");
      expect(card?.className).not.toContain("border-zinc-200");
      expect(card?.className).toContain("bg-card");
      expect(container.innerHTML).not.toContain("text-zinc-900");
    });
  });

  describe("Property Section Component", () => {
    it("does not use hardcoded bg-zinc-50 and border-zinc-200", () => {
      const { container } = render(<Property />);
      const section = container.querySelector("section");
      expect(section?.className).not.toContain("bg-zinc-50");
      expect(section?.className).not.toContain("border-zinc-200");
    });
  });

  describe("ProfessionalCard Component", () => {
    it("uses bg-card instead of hardcoded bg-white or border-zinc-200", () => {
      const mockPro = {
        id: "1",
        name: "Evans Ndegwa",
        companyName: "Evannas Engineering",
        profession: "structural_engineer" as Profession,
        professionLabel: "Structural Engineer",
        title: "Lead Engineer",
        services: [],
        portfolioImage: "/pro.jpg",
        yearsExperience: 6,
        projectCount: 10,
        status: "VERIFIED" as any,
        verified: true,
        rating: 4.8,
        reviewCount: 24,
        location: "Nairobi, Kenya",
      };

      const { container } = render(<ProfessionalCard professional={mockPro} />);
      const card = container.querySelector('[class*="rounded-xl"]');
      expect(card?.className).not.toContain("bg-white");
      expect(card?.className).not.toContain("border-zinc-200");
      expect(card?.className).toContain("bg-card");
      expect(container.innerHTML).not.toContain("text-zinc-900");
    });

    it("sponsored card does not use hardcoded #FFFCF5 or #F2D18B", () => {
      const mockPro = {
        id: "2",
        name: "Sponsored Architect",
        companyName: "Arch Studio",
        profession: "architect" as Profession,
        professionLabel: "Architect",
        title: "Architect",
        services: [],
        portfolioImage: "/pro.jpg",
        yearsExperience: 8,
        projectCount: 15,
        status: "VERIFIED" as any,
        verified: true,
        rating: 4.9,
        reviewCount: 30,
        location: "Nairobi, Kenya",
        isSponsored: true,
      };

      const { container } = render(<ProfessionalCard professional={mockPro} />);
      expect(container.innerHTML).not.toContain("#FFFCF5");
      expect(container.innerHTML).not.toContain("#FFF8E6");
    });
  });

  describe("Professionals Section Component", () => {
    it("does not use hardcoded bg-zinc-50 and border-zinc-200", () => {
      const { container } = render(<Professionals />);
      const section = container.querySelector("section");
      expect(section?.className).not.toContain("bg-zinc-50");
      expect(section?.className).not.toContain("border-zinc-200");
    });
  });
});
