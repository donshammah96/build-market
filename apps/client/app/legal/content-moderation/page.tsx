import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Content Moderation & Acceptable Use | Build Market",
  description:
    "Build Market content standards, prohibited listings, and moderation enforcement policies.",
};

export default function ContentModerationPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 md:py-16 space-y-12">
      <div className="space-y-4 border-b border-white/10 pb-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Platform Safety
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            ADR-ADMIN-008 • ADR-008
          </span>
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
          Content Moderation &amp; Acceptable Use
        </h1>
        <p className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-3xl">
          Build Market maintains high standards for construction listings,
          portfolio photos, and commercial claims to protect Kenyan property
          owners from fraudulent or hazardous practices.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🚫</span> 1. Prohibited Listings &amp; Claims
        </h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          The following activities, listings, and claims are strictly prohibited
          and result in immediate account suspension:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-2">
            <h3 className="font-bold text-red-400">
              Unlicensed Regulated Works
            </h3>
            <p className="text-zinc-400 leading-relaxed">
              Offering structural engineering, architectural design, electrical
              installations, or environmental impact assessments without active
              statutory registration (EBK, BORAQS, EPRA, NEMA).
            </p>
          </div>
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-2">
            <h3 className="font-bold text-red-400">
              Counterfeit Materials &amp; Standards
            </h3>
            <p className="text-zinc-400 leading-relaxed">
              Listing building materials failing Kenya Bureau of Standards
              (KEBS) specifications or advertising substandard structural steel
              or cement.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-2">
            <h3 className="font-bold text-red-400">
              Copyright Infringement &amp; Stolen Portfolios
            </h3>
            <p className="text-zinc-400 leading-relaxed">
              Uploading architectural renderings or project photographs from
              other contractors or external websites without authorized proof of
              authorship.
            </p>
          </div>
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-2">
            <h3 className="font-bold text-red-400">Deceptive Circumvention</h3>
            <p className="text-zinc-400 leading-relaxed">
              Embedding phone numbers, external website URLs, or payment QR
              codes directly into public listing photos to bypass platform
              communication safeguards.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>⚡</span> 2. Enforcement &amp; Takedown SLA
        </h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Our automated screening algorithms and human trust moderators enforce
          the following response commitments:
        </p>
        <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside">
          <li>
            <strong className="text-white">Emergency Safety Reports:</strong>{" "}
            Reports involving immediate structural hazards or active criminal
            impersonation are actioned within{" "}
            <strong className="text-white">4 hours</strong>.
          </li>
          <li>
            <strong className="text-white">
              Copyright &amp; Portfolio Takedowns:
            </strong>{" "}
            Infringing media is removed within{" "}
            <strong className="text-white">24 hours</strong> of verified
            copyright holder notification.
          </li>
          <li>
            <strong className="text-white">Statutory Board Reporting:</strong>{" "}
            Confirmed fraudulent professional credentials are forwarded to the
            Directorate of Criminal Investigations (DCI) and relevant
            professional registration boards (NCA, EBK).
          </li>
        </ul>
      </section>

      <section className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>🛡️</span> 3. Notice &amp; Takedown Contact
        </h2>
        <p className="text-xs text-zinc-300 leading-relaxed">
          To submit a formal notice of infringement, prohibited listing report,
          or content appeal:
        </p>
        <div className="flex flex-wrap gap-4 text-xs font-mono pt-2">
          <a
            href="mailto:moderation@buildmarket.app"
            className="px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
          >
            moderation@buildmarket.app
          </a>
          <span className="text-zinc-500 flex items-center">
            Target review: &le; 24 business hours
          </span>
        </div>
      </section>
    </div>
  );
}
