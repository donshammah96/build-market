import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Founding Professional Terms & Commercial Policy | Build Market",
  description:
    "Official terms, duration, commercial valuation, no-surprise billing policy, and non-custodial disclosures for the Build Market Founding Professional Program.",
};

export default function FoundingProTermsPage() {
  return (
    <article className="max-w-4xl mx-auto px-6 py-12 space-y-12">
      {/* Header */}
      <header className="space-y-4 border-b border-white/10 pb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
          Commercial Policy v1.0
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
          Founding Professional Program Terms
        </h1>
        <p className="text-zinc-400 text-sm">
          Effective Date: September 20, 2026 &bull; Scope: Kenya Pilot Launch
          Cohort
        </p>
      </header>

      {/* 1. Program Definition & Scope */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          1. Program Definition &amp; Purpose
        </h2>
        <p className="text-zinc-300 leading-relaxed">
          The Build Market Founding Professional Program is an exclusive
          early-adopter commercial initiative designed to seed high-trust,
          verified architectural, engineering, quantity surveying, and
          contracting supply across the Nairobi Metropolitan and Kiambu launch
          corridors.
        </p>
        <p className="text-zinc-300 leading-relaxed">
          Eligibility is awarded exclusively to practitioners and firms that
          successfully complete statutory credential verification (NCA, BORAQS,
          or EBK/IEK accreditation) during the active marketplace pilot intake
          phase.
        </p>
      </section>

      {/* 2. Comped Duration & Commercial Valuation */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          2. Comped Duration &amp; Commercial Valuation
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
              100% Comped Period
            </h3>
            <p className="text-2xl font-bold text-white">180 Days (6 Months)</p>
            <p className="text-xs text-zinc-400">
              Commences immediately on the date credential verification is
              approved by verification operations.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
              Commercial Valuation
            </h3>
            <p className="text-2xl font-bold text-white">
              KES 21,000 Total Value
            </p>
            <p className="text-xs text-zinc-400">
              Equivalent to KES 3,500/month standard Pro subscription. Zero
              monetary consideration is required during this term.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Explicit Non-Custodial Disclosure */}
      <section className="space-y-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-6">
        <h2 className="text-xl font-semibold text-emerald-400">
          3. Statutory Non-Custodial Boundary
        </h2>
        <p className="text-zinc-200 leading-relaxed text-sm">
          <strong>Direct Settlement Architecture:</strong> Build Market is an
          online discovery, credential-verification, and communications
          platform. Build Market does not hold, pool, safeguard, or escrow
          homeowner or contractor funds for building projects. All project
          milestone disbursements, materials procurement, and professional fees
          are settled directly between homeowner and professional off-platform
          (e.g. via direct bank transfer or contractor merchant paybills).
        </p>
        <p className="text-zinc-300 leading-relaxed text-sm">
          Build Market&apos;s payment systems (M-Pesa Daraja STK Push) process
          strictly and solely direct platform service fees (such as subscription
          renewals or optional lead credits) paid to Build Market Technologies
          Ltd. The platform does not operate as a Payment Service Provider (PSP)
          or custodial trust bank under the Central Bank of Kenya (CBK) National
          Payment System Act (Cap 491C).
        </p>
      </section>

      {/* 4. No-Surprise Expiry & Degradation Policy */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          4. Expiry Cadence &amp; No-Surprise Conversion
        </h2>
        <p className="text-zinc-300 leading-relaxed">
          Build Market enforces a strict{" "}
          <strong>zero-unsolicited-charge invariant</strong>:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-zinc-300 text-sm">
          <li>
            <strong>Notice Cadence:</strong> Automated notifications will be
            transmitted via SMS and Email at{" "}
            <strong>Day −30, Day −14, Day −7, and Day −1</strong> prior to the
            conclusion of your 180-day comped period.
          </li>
          <li>
            <strong>Zero Auto-Billing:</strong> When your comped period expires,
            the platform will <strong>never</strong> automatically initiate an
            M-Pesa STK push or charge your mobile account.
          </li>
          <li>
            <strong>Graceful Free-Tier Degradation:</strong> If you choose not
            to renew, your account automatically transitions to the standard
            Basic tier. Your public profile, portfolio photos, completed
            projects, and verified reviews remain intact and visible.
          </li>
          <li>
            <strong>Affirmative Initiation Required:</strong> Moving to a paid
            Pro interval requires you to log in, navigate to billing settings,
            select your preferred interval, and affirmatively authorize an
            M-Pesa prompt with your personal PIN.
          </li>
        </ul>
      </section>

      {/* 5. Post-Comp Privilege */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          5. Lifetime Founding Pro Discount
        </h2>
        <p className="text-zinc-300 leading-relaxed">
          Professionals who maintain good standing during the Founding Pro
          period retain a <strong>lifetime 15% discount</strong> on all
          subsequent Build Market Pro subscription renewals, applicable to both
          monthly and annual billing cycles.
        </p>
      </section>

      {/* 6. Involuntary Removal & Termination */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">
          6. Involuntary Removal &amp; Policy Enforcement
        </h2>
        <p className="text-zinc-300 leading-relaxed">
          Founding Pro status is a revocable privilege tied to professional
          integrity. Build Market reserves the right to immediately terminate
          comped access without prior notice if:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-zinc-300 text-sm">
          <li>
            Regulatory credentials (NCA licence, BORAQS registration, EBK
            status) are revoked, suspended, or discovered to be forged or
            misattributed.
          </li>
          <li>
            The professional engages in fraudulent project conduct, fee
            extortion, or harassment of clients or other platform members.
          </li>
          <li>
            The professional attempts to create multiple duplicate profiles or
            circumvent account limits.
          </li>
        </ul>
        <p className="text-zinc-400 text-xs mt-2">
          Revocation of Founding Pro status carries no cash refund, cash
          equivalent, or commercial indemnity.
        </p>
      </section>

      {/* 7. Billing Support, Refunds & Recourse */}
      <section className="space-y-4 border-t border-white/10 pt-8">
        <h2 className="text-xl font-semibold text-white">
          7. Billing Support, Duplicate Charge Refunds &amp; Contact
        </h2>
        <p className="text-zinc-300 leading-relaxed">
          For any billing inquiries, subscription assistance, or payment
          disputes:
        </p>
        <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
          <p className="text-sm text-zinc-200">
            <strong>Dedicated Billing Support:</strong>{" "}
            <a
              href="mailto:billing@buildmarket.app"
              className="text-emerald-400 hover:underline font-mono"
            >
              billing@buildmarket.app
            </a>
          </p>
          <div className="text-xs text-zinc-400 space-y-1">
            <p>
              &bull; <strong>Duplicate STK Push Resolution:</strong> Same
              business day (target &lt;24 hours) via direct Safaricom M-Pesa B2C
              float refund.
            </p>
            <p>
              &bull; <strong>Disputed Charges SLA:</strong> Formal investigation
              and resolution within 72 hours.
            </p>
            <p>
              &bull; <strong>Governing Law:</strong> Laws of the Republic of
              Kenya.
            </p>
          </div>
        </div>
      </section>

      {/* Navigation Footer */}
      <footer className="border-t border-white/10 pt-6 flex flex-wrap items-center justify-between text-xs text-zinc-500">
        <Link
          href="/legal/professional-terms"
          className="text-emerald-400 hover:underline"
        >
          &larr; Standard Professional Terms
        </Link>
        <Link
          href="/legal/safety-and-verification"
          className="text-emerald-400 hover:underline"
        >
          Safety &amp; Verification Disclosures &rarr;
        </Link>
      </footer>
    </article>
  );
}
