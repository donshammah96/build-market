import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Safety & Verification Standards | Build Market",
  description:
    "How Build Market verifies contractors, validates statutory licenses, and protects clients and builders.",
};

export default function SafetyAndVerificationPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 md:py-16 space-y-12">
      {/* Header */}
      <div className="space-y-4 border-b border-white/10 pb-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Trust &amp; Verification Protocol
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            ADR-006 • ADR-010
          </span>
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
          Safety &amp; Verification Standards
        </h1>
        <p className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-3xl">
          Build Market separates trust into three transparent signals: statutory
          license verification, measured platform responsiveness, and
          verified-client reviews. We show exactly what was verified, by whom,
          and when.
        </p>
      </div>

      {/* The 3 Trust Signals */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🔍</span> 1. The Three Distinct Trust Signals
        </h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Rather than awarding a generic &ldquo;verified&rdquo; badge, every
          professional profile on Build Market displays granular, auditable
          trust credentials:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-xl border border-white/10 bg-white/5 space-y-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg">
              📜
            </div>
            <h3 className="text-base font-bold text-white">
              Statutory Verification
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Validation of professional trade registrations against Kenyan
              statutory authorities including the National Construction
              Authority (NCA), Engineers Board of Kenya (EBK), and BORAQS.
            </p>
            <div className="pt-2 text-[11px] text-zinc-500 border-t border-white/5 space-y-1">
              <span className="block font-semibold text-zinc-400">
                Public Receipt Details:
              </span>
              <span>
                Regulator name, registration number, category class, and
                verification expiry.
              </span>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-white/10 bg-white/5 space-y-3">
            <div className="h-9 w-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-lg">
              📊
            </div>
            <h3 className="text-base font-bold text-white">
              Platform Performance
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Objective, algorithmic metrics measured directly from platform
              interactions without manual interference or marketing inflation.
            </p>
            <div className="pt-2 text-[11px] text-zinc-500 border-t border-white/5 space-y-1">
              <span className="block font-semibold text-zinc-400">
                Public Receipt Details:
              </span>
              <span>
                Median response time, quote acceptance rate, completed projects,
                and dispute frequency.
              </span>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-white/10 bg-white/5 space-y-3">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg">
              ⭐
            </div>
            <h3 className="text-base font-bold text-white">
              Verified Reputation
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Customer feedback restricted to authenticated, verified hires who
              initiated and concluded projects on the Build Market platform.
            </p>
            <div className="pt-2 text-[11px] text-zinc-500 border-t border-white/5 space-y-1">
              <span className="block font-semibold text-zinc-400">
                Public Receipt Details:
              </span>
              <span>
                Project linkage, verified hire timestamp, moderation state, and
                contractor response.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Verification Lifecycle & Non-Custodial Role */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🛡️</span> 2. Verification Integrity &amp; Limitations
        </h2>
        <div className="p-6 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-4">
          <h3 className="text-base font-semibold text-amber-300">
            What Verification Does and Does Not Mean
          </h3>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Statutory verification confirms that a professional held a valid
            registration with the relevant statutory body at the date of review.
            It does <strong className="text-white">not</strong> constitute a
            financial guarantee, insurance underwriting, or structural warranty
            by Build Market.
          </p>
          <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside">
            <li>
              <strong className="text-white">Independent Contractors:</strong>{" "}
              All professionals operating on Build Market are independent
              entities. Homeowners contract directly with the builder or
              professional.
            </li>
            <li>
              <strong className="text-white">
                Non-Custodial Marketplace (P0-7):
              </strong>{" "}
              Build Market does not hold funds in escrow or provide custodial
              financial accounts. Milestone payments and transactions are agreed
              directly between clients and contractors.
            </li>
            <li>
              <strong className="text-white">On-Site Due Diligence:</strong>{" "}
              Clients must always inspect physical site credentials, verify
              current municipal building permits, and ensure appropriate
              contractor insurance policies are in place before commencing
              construction.
            </li>
          </ul>
        </div>
      </section>

      {/* Contact & Reporting */}
      <section className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>🚨</span> 3. Reporting Suspected Impersonation or Fraud
        </h2>
        <p className="text-xs text-zinc-300 leading-relaxed">
          If you encounter forged credentials, contractor impersonation, or
          safety violations on Build Market, report it immediately to our trust
          operations desk:
        </p>
        <div className="flex flex-wrap gap-4 text-xs font-mono">
          <a
            href="mailto:safety@buildmarket.app"
            className="px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
          >
            safety@buildmarket.app
          </a>
          <a
            href="mailto:privacy@buildmarket.app"
            className="px-4 py-2 rounded-lg bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10 transition-colors"
          >
            privacy@buildmarket.app
          </a>
        </div>
      </section>
    </div>
  );
}
