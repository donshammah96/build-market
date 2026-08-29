import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import "@/app/globals.css";
import { envConfig } from "@/lib/infrastructure/env";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Verification Operations Center — BuildMarket",
  description:
    "Dedicated operational surface for statutory regulator license verification",
};

/**
 * Strip any scheme prefix from a Clerk domain so it is always a bare
 * host. Mirrors the identical helper in apps/admin's layout.tsx and this
 * app's own middleware.ts — all must be kept in sync. Example:
 * "https://verification.buildmarket.app" → "verification.buildmarket.app".
 */
function normalizeClerkDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).host || null;
    } catch {
      return null;
    }
  }
  return trimmed;
}

export default function VerificationOpsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { publishableKey, isSatellite, domain, primarySignInUrl, signInUrl } =
    envConfig.clerk;

  // Same invariant enforced in apps/admin's layout.tsx: a satellite app
  // with no absolute primary sign-in URL configured is a guaranteed
  // infinite redirect loop the first time an unauthenticated request
  // hits it (middleware redirects to the primary, primary can't route
  // back correctly), not a soft-degrade case — fail fast at boot instead
  // of shipping that loop to users.
  if (isSatellite && !primarySignInUrl) {
    throw new Error(
      "NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL is required when NEXT_PUBLIC_CLERK_IS_SATELLITE is true to prevent infinite redirect loops.",
    );
  }

  const normalizedDomain = normalizeClerkDomain(domain);

  const providerProps = {
    publishableKey,
    isSatellite,
    ...(normalizedDomain ? { domain: normalizedDomain } : {}),
    // For satellite apps, signInUrl MUST be the primary domain's absolute
    // URL (e.g. https://buildmarket.app/sign-in) — a relative path here
    // causes Clerk to route auth to this satellite itself, producing an
    // infinite redirect loop (see apps/admin's layout.tsx for the full
    // writeup). `primarySignInUrl` (NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL)
    // holds that absolute URL; `signInUrl`
    // (NEXT_PUBLIC_CLERK_SIGN_IN_URL, default "/sign-in") is the local
    // route used only by middleware.ts and the sign-in redirect page.
    ...(primarySignInUrl
      ? { signInUrl: primarySignInUrl }
      : signInUrl
        ? { signInUrl }
        : {}),
    // Deliberately NOT setting `syncOnLoad`. Clerk's satellite default is
    // `syncOnLoad: false`: a cold page load only performs the
    // cross-domain auth sync round trip when the user actually arrives
    // via a Clerk-issued handshake from the primary domain, not
    // proactively on every load. verification-ops is a low-traffic
    // internal tool reached via a deliberate click — the client-app
    // shadow-mode banner, or a direct bookmark — rather than cold
    // organic traffic, so there's no meaningful population of "landed
    // here without coming from the primary, but still holds a valid
    // session" visitors to justify forcing `syncOnLoad: true` and paying
    // its extra round trip on every load. Revisit if this surface ever
    // gets organic/cold traffic (e.g. a public regulator-facing page).
  };

  return (
    <ClerkProvider {...providerProps}>
      <html lang="en" className="h-full bg-zinc-900">
        <body
          className={`${inter.className} h-full text-zinc-100 antialiased`}
          suppressHydrationWarning
        >
          <div className="min-h-full flex flex-col">{children}</div>
        </body>
      </html>
    </ClerkProvider>
  );
}
