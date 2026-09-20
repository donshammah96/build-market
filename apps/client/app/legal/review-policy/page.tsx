import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Review & Rating Integrity Policy | Build Market",
  description:
    "Build Market review and rating policy — verified hire requirements, moderation, and anti-astroturfing standards.",
};

export default function ReviewPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 md:py-16 space-y-12">
      <div className="space-y-4 border-b border-white/10 pb-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Reputation Governance
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            ADR-006 • Houzz Integrity Standard
          </span>
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
          Review &amp; Rating Policy
        </h1>
        <p className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-3xl">
          Client reviews must reflect genuine first-hand experiences. Build
          Market strictly prohibits fake ratings, compensated reviews, and
          review manipulation.
        </p>
      </div>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🛡️</span> 1. The Verified Hire Requirement
        </h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Unlike unverified directories where anyone can leave anonymous
          ratings, Build Market enforces the Verified Hire standard:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
            <h3 className="font-bold text-emerald-300">
              ✅ Eligible for Public Review
            </h3>
            <ul className="text-zinc-400 space-y-1.5 list-disc list-inside">
              <li>
                Homeowners with a confirmed project contract initiated on Build
                Market.
              </li>
              <li>
                Completed milestone delivery or substantiated project
                termination.
              </li>
              <li>
                Authenticated identity with verified phone and email records.
              </li>
            </ul>
          </div>
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-2">
            <h3 className="font-bold text-red-400">
              ❌ Ineligible / Prohibited Reviews
            </h3>
            <ul className="text-zinc-400 space-y-1.5 list-disc list-inside">
              <li>
                Reviews submitted by contractors for their own profiles or
                competitors.
              </li>
              <li>Friends, relatives, or employees of the professional.</li>
              <li>
                Incentivized or paid feedback (discounts in exchange for 5
                stars).
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>⚖️</span> 2. Content Standards &amp; Moderation
        </h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Reviews are subjected to automated abuse filtering and manual trust
          review before publication. Reviews will be immediately taken down if
          they contain:
        </p>
        <ul className="text-xs text-zinc-400 space-y-2 list-disc list-inside">
          <li>Defamatory, abusive, obscene, or threatening language.</li>
          <li>
            Class A or Class B private personal data (national ID numbers,
            private addresses, personal phone numbers).
          </li>
          <li>Commercial solicitations, spam, or external website links.</li>
          <li>
            Disputes actively subject to pending court litigation or formal
            criminal investigation.
          </li>
        </ul>
      </section>

      <section className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>💬</span> 3. Contractor Right of Reply &amp; Dispute Appeals
        </h2>
        <p className="text-xs text-zinc-300 leading-relaxed">
          Verified contractors hold the right to post a professional public
          response to any review displayed on their profile. If a contractor
          believes a review violates our policies or represents a fraudulent
          claim, they may submit an appeal:
        </p>
        <div className="pt-2 text-xs font-mono text-zinc-400">
          <span>Appeals &amp; Moderation Inquiries: </span>
          <a
            href="mailto:reviews@buildmarket.app"
            className="text-emerald-400 hover:underline"
          >
            reviews@buildmarket.app
          </a>
        </div>
      </section>
    </div>
  );
}
