import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Build Market Privacy Policy — how we collect, use, and protect your data.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      {/* Hero badge */}
      <div className="flex justify-center mb-8">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          🔒 Privacy Policy
        </span>
      </div>

      {/* Title */}
      <h1 className="text-4xl md:text-5xl font-bold text-center leading-tight mb-6">
        Your Data Is Safe.
        <br />
        <span className="bg-linear-to-r from-emerald-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
          Pinky Promise.
        </span>
      </h1>

      {/* Comic relief intro */}
      <p className="text-center text-zinc-400 text-lg max-w-xl mx-auto mb-12">
        We&apos;re still teaching our lawyers to translate from
        &ldquo;legalese&rdquo; into &ldquo;human.&rdquo; They&apos;re making
        progress — they only used &ldquo;hereinafter&rdquo; twice today.
      </p>

      {/* Placeholder card */}
      <div className="relative group">
        {/* Glow effect */}
        <div className="absolute -inset-1 bg-linear-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

        <div className="relative bg-white/3 backdrop-blur-sm border border-white/10 rounded-2xl p-8 md:p-12 space-y-8">
          {/* Construction emoji header */}
          <div className="text-center space-y-4">
            <div className="text-6xl">🏗️</div>
            <h2 className="text-2xl font-bold text-white">
              Under Construction
            </h2>
            <p className="text-zinc-400 max-w-md mx-auto leading-relaxed">
              Our privacy policy is being drafted by real humans (and one very
              opinionated AI that kept insisting we add a clause about robot
              rights).
            </p>
          </div>

          {/* What to expect list */}
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                emoji: "📦",
                title: "What We Collect",
                desc: "Basically what you tell us, nothing from your diary.",
              },
              {
                emoji: "🔐",
                title: "How We Store It",
                desc: "Encrypted tighter than your grandma's cookie recipe.",
              },
              {
                emoji: "🤝",
                title: "Who We Share With",
                desc: "Nobody shady. We don't even share with our mothers.",
              },
              {
                emoji: "🗑️",
                title: "Your Right to Delete",
                desc: "Say the word and it's gone. Like your ex's photos.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white/3 border border-white/5 rounded-xl p-5 hover:border-emerald-500/20 transition-colors"
              >
                <div className="text-2xl mb-2">{item.emoji}</div>
                <h3 className="font-semibold text-white text-sm mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Compliance badge */}
          <div className="flex items-center justify-center gap-3 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/15">
              <span className="text-xs">🇰🇪</span>
              <span className="text-xs text-emerald-400 font-medium">
                Kenya Data Protection Act Compliant
              </span>
            </div>
          </div>

          {/* ETA note */}
          <p className="text-center text-xs text-zinc-600">
            The full policy will materialize here soon. In the meantime, rest
            assured we treat your data like a plumber treats a leaky pipe — with
            urgency and professionalism.
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="text-center mt-12 space-y-3">
        <p className="text-sm text-zinc-500">Have questions about your data?</p>
        <div className="flex items-center justify-center gap-4">
          <a
            href="mailto:privacy@buildmarket.app"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
          >
            ✉️ Contact Privacy Team
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
