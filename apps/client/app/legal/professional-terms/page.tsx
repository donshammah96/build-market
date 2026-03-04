import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Professional Services Agreement",
  description:
    "Build Market Professional Services Agreement — terms for verified professionals on the platform.",
};

const plainEnglishTerms = [
  {
    icon: "🤝",
    title: "1. We are a Platform, Not Your Boss",
    description:
      "You are an independent professional, not an employee of Build Market. We provide the technology to connect you with clients, but you set your own hours, manage your own tools, and run your own business.",
  },
  {
    icon: "📋",
    title: "2. Your Licenses Must Be Real and Active",
    description:
      "Trust is everything. If you register as an Engineer, Architect, Valuer, or Contractor, your registration with your respective board (e.g., NCA, EBK, BORAQS, VRB, EPRA) must be valid. Uploading fake documents will result in an immediate ban and a report to the relevant authorities.",
  },
  {
    icon: "🛡️",
    title: "3. You Stand By Your Work (Liability)",
    description:
      "Because you are an independent business, you are entirely responsible for the quality and safety of your work. If a pipe bursts or a roof leaks due to poor workmanship, you are legally and financially responsible—not Build Market. Always follow the Kenya Building Code and maintain the necessary insurance.",
  },
  {
    icon: "🏢",
    title: "4. Keep Build Market Contracts on Build Market",
    description:
      'Our platform relies on trust and fairness. If you meet a client through Build Market, you agree to keep the contract and the payments on the platform. Taking clients offline to avoid platform fees is called "circumvention" and will result in permanent account suspension.',
  },
  {
    icon: "📑",
    title: "5. You Handle Your Own Taxes",
    description:
      "While we handle the payment routing and take our platform fee, you are fully responsible for declaring your income and paying your own taxes (like Income Tax or VAT) to the Kenya Revenue Authority (KRA).",
  },
  {
    icon: "🔒",
    title: "6. Respect Client Privacy",
    description:
      "You will receive sensitive client information (like home addresses and phone numbers) to complete your projects. You agree to use this data only for the project. You cannot sell their data or add them to your promotional SMS/marketing lists without their direct permission.",
  },
  {
    icon: "⚖️",
    title: "7. How We Handle Disputes",
    description:
      "If you have a disagreement with a client, we will provide tools to help mediate. If you ever have a severe legal dispute with Build Market, we agree to settle it professionally through binding arbitration in Nairobi, rather than going to court.",
  },
];

export default function ProfessionalTermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      {/* Hero badge */}
      <div className="flex justify-center mb-8">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20">
          📜 Professional Services Agreement
        </span>
      </div>

      {/* Title */}
      <h1 className="text-4xl md:text-5xl font-bold text-center leading-tight mb-6">
        The Rules of
        <br />
        <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
          Engagement.
        </span>
      </h1>

      {/* Plain English Guide */}
      <div className="mb-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            The Build Market Professional Agreement:{" "}
            <span className="text-amber-400">In Plain English</span>
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Welcome to Build Market! We&apos;ve provided this short summary to
            help you understand our rules quickly. Please remember that this is
            just a guide—the detailed, legally binding Terms of Service are
            printed below.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {plainEnglishTerms.map((term, i) => (
            <div
              key={i}
              className={`bg-white/[0.03] border border-white/10 rounded-2xl p-6 hover:bg-white/[0.05] transition-colors ${
                i === plainEnglishTerms.length - 1
                  ? "md:col-span-2 md:w-1/2 md:mx-auto"
                  : ""
              }`}
            >
              <div className="text-3xl mb-4">{term.icon}</div>
              <h3 className="text-lg font-semibold text-white mb-2">
                {term.title}
              </h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                {term.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Placeholder card */}
      <div className="relative group">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-orange-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

        <div className="relative bg-white/[0.03] backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12 space-y-8">
          {/* Construction emoji header */}
          <div className="text-center space-y-4">
            <div className="text-6xl">⚖️</div>
            <h2 className="text-2xl font-bold text-white">Being Lawyered Up</h2>
            <p className="text-zinc-400 max-w-md mx-auto leading-relaxed">
              Our legal eagles are crafting this document with the same
              precision you&apos;d use on a load-bearing wall. No cutting
              corners.
            </p>
          </div>

          {/* What the agreement will cover */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider text-center mb-4">
              What This Will Cover
            </h3>
            {[
              {
                emoji: "💰",
                title: "Commission & Fees",
                desc: "How the money moves. Spoiler: you keep most of it.",
              },
              {
                emoji: "🛡️",
                title: "Liability & Insurance",
                desc: "Who's responsible when things go sideways (not us if you skip the waterproofing).",
              },
              {
                emoji: "📋",
                title: "License Verification",
                desc: 'Why we check your credentials — because "trust me bro" isn\'t a regulatory framework.',
              },
              {
                emoji: "🤝",
                title: "Dispute Resolution",
                desc: "How we settle arguments that can't be solved with a spirit level.",
              },
              {
                emoji: "🚪",
                title: "Termination Clause",
                desc: "How to part ways gracefully. Like a breakup, but with more paperwork.",
              },
              {
                emoji: "📐",
                title: "Code of Conduct",
                desc: "Be excellent to each other. Yes, we quoted Bill & Ted. No, we're not sorry.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-4 bg-white/[0.02] border border-white/5 rounded-xl p-4 hover:border-amber-500/20 transition-colors"
              >
                <span className="text-2xl flex-shrink-0 mt-0.5">
                  {item.emoji}
                </span>
                <div>
                  <h4 className="font-semibold text-white text-sm">
                    {item.title}
                  </h4>
                  <p className="text-xs text-zinc-500 leading-relaxed mt-0.5">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Regulatory compliance badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-white/5">
            {[
              { flag: "🏛️", label: "NCA Aligned" },
              { flag: "⚙️", label: "EBK Standards" },
              { flag: "🇰🇪", label: "Kenyan Law" },
            ].map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/15"
              >
                <span className="text-xs">{badge.flag}</span>
                <span className="text-xs text-amber-400 font-medium">
                  {badge.label}
                </span>
              </div>
            ))}
          </div>

          {/* ETA note */}
          <p className="text-center text-xs text-zinc-600">
            The full agreement is being reviewed and will appear here shortly.
            Until then, the short version: build good things, be honest about
            your qualifications, and don&apos;t ghost your clients.
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="text-center mt-12 space-y-3">
        <p className="text-sm text-zinc-500">
          Questions about the professional agreement?
        </p>
        <div className="flex items-center justify-center gap-4">
          <a
            href="mailto:legal@buildmarket.co.ke"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors border border-amber-500/20"
          >
            ✉️ Contact Legal Team
          </a>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-zinc-400 text-sm hover:text-white transition-colors"
          >
            ← Back Home
          </Link>
        </div>
      </div>
    </div>
  );
}
