import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Legal",
  description: "Build Market legal documents and policies",
};

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-linear-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white">
      {/* Subtle animated background grain */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Nav bar */}
      <nav className="relative z-10 border-b border-white/5 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold bg-linear-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent hover:from-emerald-300 hover:to-emerald-200 transition-all"
          >
            Build Market
          </Link>
          <div className="flex flex-wrap items-center gap-4 md:gap-6 text-xs md:text-sm text-zinc-400">
            <Link
              href={LEGAL_ROUTES.privacy}
              className="hover:text-white transition-colors"
            >
              Privacy
            </Link>
            <Link
              href={LEGAL_ROUTES.safetyAndVerification}
              className="hover:text-white transition-colors"
            >
              Safety &amp; Trust
            </Link>
            <Link
              href={LEGAL_ROUTES.reviewPolicy}
              className="hover:text-white transition-colors"
            >
              Reviews
            </Link>
            <Link
              href={LEGAL_ROUTES.disputesAndComplaints}
              className="hover:text-white transition-colors"
            >
              Disputes
            </Link>
            <Link
              href={LEGAL_ROUTES.contentModeration}
              className="hover:text-white transition-colors"
            >
              Moderation
            </Link>
            <Link
              href={LEGAL_ROUTES.foundingProTerms}
              className="hover:text-white transition-colors"
            >
              Founding Pro
            </Link>
            <Link
              href={LEGAL_ROUTES.professionalTerms}
              className="hover:text-white transition-colors"
            >
              Terms
            </Link>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="relative z-10">{children}</main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 mt-20">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center text-sm text-zinc-500">
          <p>
            &copy;{" "}
            <span suppressHydrationWarning>{new Date().getFullYear()}</span>{" "}
            Build Market. All rights reserved.
          </p>
          <p className="mt-1">
            Questions? Reach us at{" "}
            <a
              href="mailto:legal@buildmarket.app"
              className="text-emerald-400 hover:underline"
            >
              legal@buildmarket.app
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
