import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Complaints & Dispute Resolution | Build Market",
  description:
    "How Build Market mediates disagreements, handles consumer complaints, and resolves marketplace disputes.",
};

export default function DisputesAndComplaintsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 md:py-16 space-y-12">
      <div className="space-y-4 border-b border-white/10 pb-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Consumer Protection
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            ADR-ADMIN-014 • DPA 2019
          </span>
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
          Complaints &amp; Dispute Resolution
        </h1>
        <p className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-3xl">
          We are committed to fair, transparent resolution when challenges arise
          between homeowners and verified building professionals on Build
          Market.
        </p>
      </div>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>⚖️</span> 1. The Three-Stage Dispute Resolution Process
        </h2>

        <div className="space-y-4">
          <div className="p-5 rounded-xl border border-white/10 bg-white/5 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
              <span>Stage 1</span> Direct Party Communication
            </div>
            <h3 className="text-base font-semibold text-white">
              Direct Good-Faith Negotiation
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Most issues stem from misaligned timelines or scope changes.
              Parties are required to attempt good-faith communication via the
              in-app messaging thread to reach mutual agreement before
              requesting formal mediation.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-white/10 bg-white/5 space-y-2">
            <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider">
              <span>Stage 2</span> Platform Conciliation
            </div>
            <h3 className="text-base font-semibold text-white">
              Build Market Marketplace Mediation
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              If direct negotiation stalls after 5 business days, either party
              may escalate the matter to our trust operations team. Build Market
              reviews written quote scopes, message histories, and project
              photos to propose non-binding conciliation terms.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-white/10 bg-white/5 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <span>Stage 3</span> Independent Arbitration
            </div>
            <h3 className="text-base font-semibold text-white">
              Binding Arbitration (Nairobi, Kenya)
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              For unresolved structural or high-value contractual disputes,
              disputes are referred to binding arbitration under the Nairobi
              Centre for International Arbitration (NCIA) Rules or relevant
              statutory tribunals (such as the National Construction Appeals
              Board).
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-6">
        <h2 className="text-xl font-bold text-amber-300 flex items-center gap-2">
          <span>⚠️</span> 2. Non-Custodial Limitation of Liability (P0-7)
        </h2>
        <p className="text-xs text-zinc-300 leading-relaxed">
          Build Market operates solely as a discovery, credential-verification,
          and communications technology platform. Build Market does{" "}
          <strong className="text-white">not</strong> act as a general
          contractor, insurer, bank, or payment custodian:
        </p>
        <ul className="text-xs text-zinc-400 space-y-1.5 list-disc list-inside">
          <li>
            We do not hold funds in escrow or freeze private commercial payments
            between parties.
          </li>
          <li>
            We cannot compel physical work completion or refund monies paid
            directly off-platform.
          </li>
          <li>
            Liability for defective construction, code violations, or breach of
            contract rests solely with the independent professional.
          </li>
        </ul>
      </section>

      <section className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>📩</span> 3. Lodging a Formal Complaint
        </h2>
        <p className="text-xs text-zinc-300 leading-relaxed">
          To open a formal dispute or report professional misconduct, submit
          project details, correspondence logs, and evidence photos to:
        </p>
        <div className="flex flex-wrap gap-4 text-xs font-mono pt-2">
          <a
            href="mailto:disputes@buildmarket.app"
            className="px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
          >
            disputes@buildmarket.app
          </a>
          <span className="text-zinc-500 flex items-center">
            Target initial response: &le; 24 business hours
          </span>
        </div>
      </section>
    </div>
  );
}
