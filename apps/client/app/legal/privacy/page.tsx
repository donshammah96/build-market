import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Build Market",
  description:
    "Build Market Privacy Policy — how we collect, use, and protect your personal data under the Kenya Data Protection Act 2019.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 md:py-16 space-y-12">
      {/* Header */}
      <div className="space-y-4 border-b border-white/10 pb-8">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Kenya DPA 2019 &amp; GDPR Compliant
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            v1.0-interim • Effective Sept 2026
          </span>
        </div>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white">
          Privacy Policy
        </h1>
        <p className="text-zinc-400 text-base md:text-lg leading-relaxed max-w-3xl">
          Build Market Technologies Ltd (&ldquo;Build Market&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;) is committed to protecting the
          privacy, security, and integrity of your personal data. This Privacy
          Policy details our handling of personal information collected from
          homeowners, building professionals, contractors, and site visitors in
          compliance with the Kenya Data Protection Act 2019 and applicable data
          protection regulations.
        </p>
      </div>

      {/* Controller & DPO Contact */}
      <section className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span>🏢</span> 1. Data Controller &amp; Privacy Contact
        </h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          The legal entity responsible for the collection and processing of your
          personal data is:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-zinc-300">
          <div className="bg-black/30 p-3 rounded-lg border border-white/5">
            <span className="text-zinc-500 block uppercase font-semibold text-[10px]">
              Data Controller
            </span>
            <span className="text-white font-medium">
              Build Market Technologies Ltd
            </span>
            <span className="block text-zinc-400 mt-1">Nairobi, Kenya</span>
          </div>
          <div className="bg-black/30 p-3 rounded-lg border border-white/5">
            <span className="text-zinc-500 block uppercase font-semibold text-[10px]">
              Privacy &amp; DPO Inquiries
            </span>
            <span className="text-emerald-400 font-medium">
              privacy@buildmarket.app
            </span>
            <span className="block text-zinc-400 mt-1">
              Response window: &le; 48 business hours
            </span>
          </div>
        </div>
      </section>

      {/* Categories of Data Processed */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>📋</span> 2. Categories of Personal Data We Process
        </h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          We collect and classify data in accordance with our strict data
          classification standards (ADR-006) to enforce minimum-necessary access
          and enhanced security controls:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 space-y-2">
            <span className="text-xs font-bold text-red-400 uppercase tracking-wide flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400"></span> Class A:
              Restricted Data
            </span>
            <p className="text-xs text-zinc-400 leading-relaxed">
              KRA PINs, payment transaction metadata, authentication tokens, and
              credential hashes.
            </p>
            <p className="text-[11px] text-zinc-500 font-mono">
              Protection: Encrypted at rest (AES-256), never logged, never
              stored in browser storage.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400"></span> Class
              B: Sensitive &amp; Identity Data
            </span>
            <p className="text-xs text-zinc-400 leading-relaxed">
              National identity documents, statutory trade licenses (NCA, EBK,
              BORAQS), physical project locations, phone numbers, and direct
              messages.
            </p>
            <p className="text-[11px] text-zinc-500 font-mono">
              Protection: Masked routing, access-controlled document storage,
              PII-redacted operational logs.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-2">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wide flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-400"></span> Class
              C: Internal Operational Data
            </span>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Correlation IDs, timestamps, pseudonymized user IDs, request
              durations, and security telemetry.
            </p>
            <p className="text-[11px] text-zinc-500 font-mono">
              Protection: Retained in tamper-evident structured logs for
              security and performance audits.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>{" "}
              Class D: Public Profile Information
            </span>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Public contractor profile names, business biographies, verified
              credential badges, portfolio images, and verified client ratings.
            </p>
            <p className="text-[11px] text-zinc-500 font-mono">
              Protection: Publicly discoverable; protected against automated
              scraping and abuse.
            </p>
          </div>
        </div>
      </section>

      {/* Lawful Bases */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>⚖️</span> 3. Lawful Bases for Processing (DPA Section 30)
        </h2>
        <ul className="space-y-3 text-sm text-zinc-300 leading-relaxed list-disc list-inside">
          <li>
            <strong className="text-white">Contractual Performance:</strong>{" "}
            Processing project quotes, matchmaking homeowners with verified
            professionals, and delivering communication across our platform.
          </li>
          <li>
            <strong className="text-white">
              Legal &amp; Statutory Obligation:
            </strong>{" "}
            Retaining financial transaction ledgers and tax records for 7 years
            as mandated by the Kenya Tax Procedures Act and Companies Act.
          </li>
          <li>
            <strong className="text-white">Explicit Consent:</strong> Sending
            non-essential marketing notifications, processing optional
            location-based discovery, and cookie preferences.
          </li>
          <li>
            <strong className="text-white">Legitimate Interests:</strong>{" "}
            Preventing fraud, detecting counterfeit contractor credentials,
            securing platform infrastructure, and maintaining tamper-evident
            audit records.
          </li>
        </ul>
      </section>

      {/* Masked Communications */}
      <section className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
        <h2 className="text-xl font-bold text-emerald-300 flex items-center gap-2">
          <span>🛡️</span> 4. Masked Communications &amp; Lead Protection
        </h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          To prevent harassment and unsolicited marketing, Build Market protects
          homeowner personal contacts:
        </p>
        <ul className="space-y-2 text-xs text-zinc-400 list-disc list-inside">
          <li>
            Homeowner phone numbers and exact physical addresses remain{" "}
            <strong className="text-white">completely masked</strong> to
            contractors during initial quote requests and project inquiries.
          </li>
          <li>
            Direct contact information is disclosed only when a homeowner
            explicitly accepts a proposal or books an on-site consultation.
          </li>
          <li>
            Contractors are strictly prohibited from harvesting contact details
            to circumvent the platform or adding consumers to third-party SMS
            marketing lists.
          </li>
        </ul>
      </section>

      {/* Subprocessors & Cross-Border Transfers */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🌐</span> 5. Subprocessors &amp; Cross-Border Transfers
        </h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          In compliance with Kenya DPA Sections 48 and 49, all transfers of
          personal data outside Kenya occur pursuant to valid Data Processing
          Agreements (DPAs) with Standard Contractual Clauses (SCCs) and
          appropriate technical safeguards (encryption at rest and in transit):
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-zinc-300 border border-white/10 rounded-lg overflow-hidden">
            <thead className="bg-white/5 text-zinc-400 uppercase font-semibold text-[10px]">
              <tr>
                <th className="p-3">Subprocessor</th>
                <th className="p-3">Purpose</th>
                <th className="p-3">Location</th>
                <th className="p-3">Safeguard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="p-3 font-medium text-white">Clerk Inc.</td>
                <td className="p-3">
                  Identity management &amp; authentication
                </td>
                <td className="p-3">United States</td>
                <td className="p-3 font-mono">DPA with SCCs, SOC2 Type II</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-white">
                  Amazon Web Services (AWS)
                </td>
                <td className="p-3">
                  Encrypted document &amp; database storage
                </td>
                <td className="p-3">US / Global</td>
                <td className="p-3 font-mono">KMS AES-256, ISO 27001</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-white">
                  Safaricom PLC (Daraja)
                </td>
                <td className="p-3">M-Pesa payment validation</td>
                <td className="p-3">Kenya</td>
                <td className="p-3 font-mono">
                  Domestic, Central Bank Regulated
                </td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-white">Resend Inc.</td>
                <td className="p-3">Transactional email delivery</td>
                <td className="p-3">United States</td>
                <td className="p-3 font-mono">Commercial DPA with SCCs</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-white">
                  Africa&apos;s Talking Ltd
                </td>
                <td className="p-3">Transactional SMS notifications</td>
                <td className="p-3">Kenya</td>
                <td className="p-3 font-mono">Domestic processing</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Data Subject Rights */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>✋</span> 6. Your Statutory Rights (Kenya DPA &amp; GDPR)
        </h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          You hold enforceable statutory rights regarding your personal
          information:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-1">
            <h3 className="font-semibold text-white text-sm">
              Right to Access &amp; Portability
            </h3>
            <p className="text-xs text-zinc-400">
              Download a machine-readable JSON archive of all personal data held
              about you via our automated export service.
            </p>
            <p className="text-xs text-emerald-400 font-mono pt-1">
              Endpoint:{" "}
              <code className="bg-black/40 px-1 py-0.5 rounded">
                /api/user/export
              </code>
            </p>
          </div>

          <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-1">
            <h3 className="font-semibold text-white text-sm">
              Right to Rectification
            </h3>
            <p className="text-xs text-zinc-400">
              Update inaccurate profile details or request administrative
              correction of verified trade qualifications.
            </p>
            <p className="text-xs text-emerald-400 font-mono pt-1">
              Endpoint:{" "}
              <code className="bg-black/40 px-1 py-0.5 rounded">
                /api/user/rectification
              </code>
            </p>
          </div>

          <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-1">
            <h3 className="font-semibold text-white text-sm">
              Right to Erasure (&ldquo;To Be Forgotten&rdquo;)
            </h3>
            <p className="text-xs text-zinc-400">
              Request permanent account erasure with a 30-day grace period.
              Tax-mandated financial ledgers are retained for 7 years in
              anonymized form.
            </p>
            <p className="text-xs text-emerald-400 font-mono pt-1">
              Endpoint:{" "}
              <code className="bg-black/40 px-1 py-0.5 rounded">
                /api/user/deletion
              </code>
            </p>
          </div>

          <div className="p-4 rounded-xl border border-white/10 bg-white/5 space-y-1">
            <h3 className="font-semibold text-white text-sm">
              Right to Object &amp; Withdraw Consent
            </h3>
            <p className="text-xs text-zinc-400">
              Opt out of marketing communications, location routing, or
              analytics at any time through account settings.
            </p>
            <p className="text-xs text-emerald-400 font-mono pt-1">
              Manage via: Account Settings or Cookie Settings
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2 mt-4">
          <h3 className="font-semibold text-amber-300 text-sm">
            Right to Lodge a Complaint with the ODPC
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed">
            If you believe Build Market has failed to uphold your privacy
            rights, you have the statutory right under Section 56 of the Kenya
            Data Protection Act to lodge a formal complaint with the Office of
            the Data Protection Commissioner:
          </p>
          <div className="text-xs font-mono text-zinc-300 space-y-0.5 pt-1">
            <p>Office of the Data Protection Commissioner (ODPC)</p>
            <p>
              Email:{" "}
              <a
                href="mailto:info@odpc.go.ke"
                className="text-amber-400 hover:underline"
              >
                info@odpc.go.ke
              </a>{" "}
              | Portal:{" "}
              <a
                href="https://dataportal.odpc.go.ke"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:underline"
              >
                dataportal.odpc.go.ke
              </a>
            </p>
            <p>
              Britam Tower, 12th Floor, Hospital Road, Upper Hill, Nairobi,
              Kenya
            </p>
          </div>
        </div>
      </section>

      {/* Security & 72-Hour Breach Commitment */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <span>🚨</span> 7. Data Security &amp; 72-Hour Breach Notification
        </h2>
        <p className="text-sm text-zinc-300 leading-relaxed">
          Build Market maintains strict organizational, operational, and
          cryptographic controls to prevent unauthorized access, loss, or
          disclosure. Pursuant to Section 43 of the Kenya Data Protection Act:
        </p>
        <ul className="space-y-2 text-xs text-zinc-400 list-disc list-inside">
          <li>
            In the event of a confirmed security incident creating a real risk
            of harm to affected data subjects, we notify the Data Commissioner
            within <strong className="text-white">72 hours</strong> of
            confirmation.
          </li>
          <li>
            Affected data subjects receive prompt, actionable communication
            detailing the nature of the breach and mitigation steps via
            automated notification relays.
          </li>
          <li>
            All security incidents are investigated under our formal 72-hour
            incident response playbook with immutable forensic audit logging.
          </li>
        </ul>
      </section>

      {/* Footer Contact */}
      <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
        <p>Build Market Technologies Ltd • Privacy Governance</p>
        <div className="flex items-center gap-4">
          <a
            href="mailto:privacy@buildmarket.app"
            className="text-emerald-400 hover:underline font-medium"
          >
            privacy@buildmarket.app
          </a>
          <Link
            href="/legal/cookie-settings"
            className="hover:text-zinc-300 transition-colors"
          >
            Cookie Settings
          </Link>
          <Link
            href="/legal/professional-terms"
            className="hover:text-zinc-300 transition-colors"
          >
            Professional Terms
          </Link>
        </div>
      </div>
    </div>
  );
}
