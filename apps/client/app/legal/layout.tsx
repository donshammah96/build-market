import type { Metadata } from "next";
import Link from "next/link";

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
          <div className="flex items-center gap-6 text-sm text-zinc-400">
            <Link
              href="/legal/privacy"
              className="hover:text-white transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/legal/professional-terms"
              className="hover:text-white transition-colors"
            >
              Professional Terms
            </Link>
            <Link
              href="/legal/cookie-settings"
              className="hover:text-white transition-colors"
            >
              Cookies
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
