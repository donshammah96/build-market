import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Build Market",
  description:
    "Build Market Terms of Service — governing homeowners, clients, and platform visitors connecting with building professionals across Kenya.",
};

const termsSections = [
  {
    icon: "🏗️",
    title: "1. The Build Market Platform",
    description:
      "Build Market Technologies Ltd provides an online marketplace connecting homeowners and property developers with licensed architects, engineers, contractors, and construction material suppliers. Build Market is an intermediary technology provider and does not directly provide construction, architectural, or engineering services.",
  },
  {
    icon: "✅",
    title: "2. Eligibility & Account Security",
    description:
      "To use Build Market as a client or homeowner, you must be at least 18 years old and capable of forming legally binding contracts under Kenyan law. You are responsible for maintaining the confidentiality of your credentials and all activities occurring under your account.",
  },
  {
    icon: "🛡️",
    title: "3. Milestone Engagements & Payments",
    description:
      "Projects may use agreed milestone stages. Clients and professionals agree on deliverables and payment terms directly, and Build Market does not hold, safeguard, or disburse project funds.",
  },
  {
    icon: "🚫",
    title: "4. No Circumvention & Honest Conduct",
    description:
      "To protect the integrity and safety of the ecosystem, clients and professionals introduced through Build Market agree not to circumvent the platform to avoid fees, dispute protections, or credential tracking. Circumvention or fee avoidance may result in account termination and forfeiture of dispute resolution services.",
  },
  {
    icon: "⭐",
    title: "5. Reviews & Community Integrity",
    description:
      "Reviews and ratings must reflect genuine, first-hand experiences on contracted projects. Submitting false, coercive, or incentivized reviews is strictly prohibited and subject to immediate removal under our Content Moderation and Review Policies.",
  },
  {
    icon: "⚖️",
    title: "6. Independent Contractor Relationship",
    description:
      "Professionals and suppliers are independent third-party contractors and vendors, not employees, partners, or agents of Build Market. Professionals are solely responsible for obtaining and maintaining required statutory licenses (EBK, BORAQS, NCA, VRB) and complying with the Kenya Building Code.",
  },
  {
    icon: "🇰🇪",
    title: "7. Governing Law & Dispute Resolution",
    description:
      "These Terms of Service are governed by and construed under the laws of the Republic of Kenya. Any disputes arising from or relating to the platform shall first undergo mediation through the Build Market Dispute Resolution process, and if unresolved, through binding arbitration in Nairobi.",
  },
];

export default function TermsOfServicePage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      {/* Hero badge */}
      <div className="flex justify-center mb-8">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          General Platform Terms
        </span>
      </div>

      {/* Title */}
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
          Terms of Service
        </h1>
        <p className="text-zinc-400 text-lg max-w-xl mx-auto">
          Clear, straightforward rules governing how homeowners, developers, and
          visitors interact with the Build Market platform.
        </p>
        <p className="text-xs text-zinc-500 mt-3 font-mono">
          Effective: September 2026 • Version 1.0
        </p>
      </div>

      {/* Sections Grid */}
      <div className="space-y-6">
        {termsSections.map((term) => (
          <div
            key={term.title}
            className="p-6 rounded-2xl bg-zinc-900/60 border border-white/5 hover:border-white/10 transition-colors"
          >
            <div className="flex items-start gap-4">
              <span className="text-2xl shrink-0 mt-0.5" aria-hidden="true">
                {term.icon}
              </span>
              <div>
                <h2 className="text-lg font-semibold text-white mb-2">
                  {term.title}
                </h2>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  {term.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Related Legal Policies */}
      <div className="mt-12 p-6 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 text-center">
        <h3 className="text-base font-semibold text-white mb-2">
          Are you a licensed professional or building material supplier?
        </h3>
        <p className="text-xs text-zinc-400 mb-4">
          Licensed practitioners and vendors are also governed by our dedicated
          Professional Services Agreement.
        </p>
        <div className="flex flex-wrap justify-center gap-3 text-xs">
          <Link
            href="/legal/professional-terms"
            className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
          >
            Professional Terms
          </Link>
          <Link
            href="/legal/privacy"
            className="px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            Privacy Policy
          </Link>
          <Link
            href="/legal/safety-and-verification"
            className="px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            Safety &amp; Verification
          </Link>
        </div>
      </div>
    </div>
  );
}
