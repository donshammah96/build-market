import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/NavBar";
import { LEGAL_ROUTES, ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Sitemap | Build Market",
  description:
    "Overview of all public pages, categories, and legal directories on the Build Market Kenya platform.",
};

interface SitemapSection {
  title: string;
  links: { label: string; href: string; description?: string }[];
}

const sitemapSections: SitemapSection[] = [
  {
    title: "Marketplace & Discovery",
    links: [
      {
        label: "Home",
        href: "/",
        description: "Main platform entry and featured categories",
      },
      {
        label: "Find Professionals",
        href: ROUTES.findProfessional,
        description:
          "Directory of verified architects, engineers & contractors",
      },
      {
        label: "Properties",
        href: ROUTES.properties,
        description: "Commercial and residential real estate listings",
      },
      {
        label: "Idea Books",
        href: ROUTES.ideaBooks,
        description: "Curated galleries of Kenyan residential designs",
      },
      {
        label: "Customer Reviews",
        href: ROUTES.reviews,
        description: "Verified reviews from Kenyan homeowners",
      },
    ],
  },
  {
    title: "Building Supplies & Stores",
    links: [
      {
        label: "All Suppliers",
        href: ROUTES.stores,
        description: "Vetted hardware, timber, tile, and plumbing stores",
      },
      {
        label: "Hardware & Tools",
        href: ROUTES.storeHardware,
        description: "Equipment, hand tools, and building hardware",
      },
      {
        label: "Building Materials",
        href: ROUTES.storeBuildingMaterials,
        description: "Cement, sand, aggregates, and foundational supplies",
      },
      {
        label: "Tiles & Ceramics",
        href: ROUTES.storeTilesAndCeramics,
        description: "Porcelain tiles, wall ceramics, and adhesives",
      },
      {
        label: "Electrical",
        href: ROUTES.storeElectrical,
        description: "Cabling, conduits, circuit breakers, and lighting",
      },
      {
        label: "Plumbing",
        href: ROUTES.storePlumbing,
        description: "Piping, fittings, tanks, and sanitaryware",
      },
    ],
  },
  {
    title: "For Professionals",
    links: [
      {
        label: "BuildMarket Pro Network",
        href: ROUTES.professional,
        description: "Overview for architects, engineers, and contractors",
      },
      {
        label: "Sign Up as a Professional",
        href: ROUTES.joinAsPro,
        description: "Create your practitioner account and begin verification",
      },
    ],
  },
  {
    title: "Legal, Trust & Governance",
    links: [
      {
        label: "Privacy Policy",
        href: LEGAL_ROUTES.privacy,
        description: "Compliance under the Kenya Data Protection Act 2019",
      },
      {
        label: "Terms of Service",
        href: LEGAL_ROUTES.terms,
        description: "General terms governing homeowners and platform clients",
      },
      {
        label: "Professional Services Agreement",
        href: LEGAL_ROUTES.professionalTerms,
        description: "Terms for licensed practitioners and suppliers",
      },
      {
        label: "Safety & Verification",
        href: LEGAL_ROUTES.safetyAndVerification,
        description: "Credential validation processes with EBK, BORAQS & NCA",
      },
      {
        label: "Review Policy",
        href: LEGAL_ROUTES.reviewPolicy,
        description: "Guidelines ensuring authentic and unmanipulated reviews",
      },
      {
        label: "Disputes & Complaints",
        href: LEGAL_ROUTES.disputesAndComplaints,
        description: "Mediation process and milestone dispute handling",
      },
      {
        label: "Content Moderation",
        href: LEGAL_ROUTES.contentModeration,
        description:
          "Platform safety rules for user submissions and portfolios",
      },
      {
        label: "Cookie Settings",
        href: LEGAL_ROUTES.cookieSettings,
        description: "Manage analytical and tracking preferences",
      },
      {
        label: "Accessibility Statement",
        href: LEGAL_ROUTES.accessibility,
        description: "WCAG 2.1 Level AA digital accessibility standards",
      },
    ],
  },
];

export default function SitemapPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar variant="light" />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 md:px-12 pt-28 pb-20 w-full flex-1">
        {/* Header */}
        <div className="mb-12 max-w-2xl">
          <div className="inline-block px-3 py-1 mb-3 text-xs font-semibold tracking-wider text-emerald-600 uppercase bg-emerald-50 dark:bg-emerald-950/40 rounded-full">
            Directory
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-display tracking-tight text-foreground mb-4">
            Platform <span className="text-emerald-600">Sitemap</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Complete index of all public discovery sections, supplier
            directories, and statutory legal documentation across Build Market.
          </p>
        </div>

        {/* Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {sitemapSections.map((section) => (
            <div
              key={section.title}
              className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4"
            >
              <h2 className="text-xl font-bold text-foreground tracking-tight border-b border-border/60 pb-3">
                {section.title}
              </h2>
              <ul className="space-y-3.5">
                {section.links.map((link) => (
                  <li key={link.href} className="group">
                    <Link
                      href={link.href}
                      className="text-base font-semibold text-foreground hover:text-emerald-600 transition-colors flex items-center gap-1.5"
                    >
                      <span>{link.label}</span>
                      <span
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-emerald-600"
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </Link>
                    {link.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {link.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
