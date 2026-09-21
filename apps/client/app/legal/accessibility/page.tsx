import type { Metadata } from "next";
import { Eye, Keyboard, Sparkles, Sliders } from "lucide-react";

export const metadata: Metadata = {
  title: "Accessibility Statement | Build Market",
  description:
    "Build Market Accessibility Statement — our commitment to digital inclusion, WCAG 2.1 AA conformance, and assistive tools for Kenyan construction marketplace users.",
};

export default function AccessibilityPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      {/* Hero badge */}
      <div className="flex justify-center mb-8">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Digital Inclusion
        </span>
      </div>

      {/* Title */}
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
          Accessibility Statement
        </h1>
        <p className="text-zinc-400 text-lg max-w-xl mx-auto">
          Build Market is dedicated to ensuring digital accessibility for all
          homeowners, professionals, and partners across Kenya.
        </p>
      </div>

      {/* Standards & Commitment */}
      <div className="space-y-6">
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-white/5">
          <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
            <span>🎯</span> Conformance Standard
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed mb-3">
            We target conformance with the Web Content Accessibility Guidelines
            (WCAG) 2.1 Level AA. These guidelines outline how to make digital
            experiences more accessible to people with diverse visual, auditory,
            motor, and cognitive abilities.
          </p>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Our interfaces are engineered to work with modern assistive
            technologies, screen readers, keyboard navigation, and custom
            display settings.
          </p>
        </div>

        {/* Built-in Features */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-4">
          <h2 className="text-xl font-semibold text-white mb-2">
            Built-in Accessibility Features
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <Sliders className="h-4 w-4" />
                <span>Accessibility Panel</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                A dedicated modal accessible from both the Navbar and Footer to
                tailor contrast, font size, and motion.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <Eye className="h-4 w-4" />
                <span>Color-Blind Filters</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Native SVG matrix filters for Protanopia, Deuteranopia, and
                Tritanopia vision profiles.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <Keyboard className="h-4 w-4" />
                <span>Keyboard Navigation</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Skip-to-content links, visible focus rings, and trapped focus
                within drawers and modals.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <Sparkles className="h-4 w-4" />
                <span>Reduced Motion</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Respects system &amp; user preferences for reduced motion,
                suppressing disruptive transitions.
              </p>
            </div>
          </div>
        </div>

        {/* Feedback & Accommodations */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-white/5">
          <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
            <span>📬</span> Feedback &amp; Assistance
          </h2>
          <p className="text-sm text-zinc-300 leading-relaxed mb-4">
            If you encounter any accessibility barriers while using Build Market
            or require accommodations to access professional services, please
            reach out directly to our engineering team:
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center text-xs font-mono">
            <a
              href="mailto:accessibility@buildmarket.app"
              className="inline-flex items-center px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
            >
              accessibility@buildmarket.app
            </a>
            <span className="text-zinc-500">
              Response window: within 2 business days
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
