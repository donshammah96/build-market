import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { DM_Sans } from "next/font/google";
import { ToastContainer } from "react-toastify";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { CookieConsentProvider } from "@/components/providers/CookieConsentProvider";
import { PostHogProvider } from "@/app/providers/PostHogProvider";
import { CookieBanner } from "@/components/gdpr/CookieBanner";
import { AccessibilityProvider } from "@/components/accessibility";
import { RouteFocusManager } from "@/components/layout/RouteFocusManager";
import { Footer } from "@/components/layout/Footer";
import { env } from "@/app/lib/infrastructure/env"; // Added env import

// Single, distinctive font with multiple weights for better performance
// DM Sans is modern, geometric, and works well for both headings and body
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap", // Ensures text remains visible during font load
  variable: "--font-dm-sans",
  preload: true,
});

// Viewport configuration for mobile optimization
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#10b981", // Emerald-500 for mobile browser chrome
};

export const metadata: Metadata = {
  title: {
    default: "Build Market",
    template: "%s | Build Market",
  },
  description: "Find the best professionals for your building project in Kenya",

  metadataBase: new URL(env.appUrl ?? "http://localhost:3500"), // Added metadataBase for correct URL resolution
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Build Market",
    description: "Find the best professionals for your building project",
    url: env.appUrl ?? "http://localhost:3500",
    siteName: "Build Market",
    images: [
      {
        url: "/hero-desktop1.png",
        width: 1200,
        height: 630,
        alt: "Build Market - Connect with Kenya's top verified professionals",
      },
    ],
    locale: "en_KE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Build Market",
    description: "Find the best professionals for your building project",
    images: ["/hero-mobile.png"],
    creator: "@buildmarket",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const rawNonce = headersList.get("x-nonce");

  // Fail fast in non-prod if the nonce is missing using envConfig properties
  if (!rawNonce && !env.isProd) {
    throw new Error(
      "Missing 'x-nonce' header. Ensure middleware is correctly setting and forwarding the nonce to the request headers.",
    );
  }

  // In production this intentionally fails OPEN rather than throwing (a hard
  // crash on every page for a header-plumbing bug would be worse than a
  // degraded CSP). But failing open silently means a middleware matcher
  // regression — a route that stops going through middleware and so never
  // gets 'x-nonce' set — would be invisible until someone notices scripts or
  // styles failing to load. Log it loudly so it shows up in server logs
  // instead of only surfacing as a hard-to-diagnose client-side CSP failure.
  if (!rawNonce && env.isProd) {
    console.error(
      "[layout] Missing 'x-nonce' header in production. Clerk components " +
        "and any nonce-scoped scripts/styles on this request will fall back " +
        "to CSP's unsafe-inline path (if a browser still honors it) or fail " +
        "to load. This usually means middleware's matcher isn't covering " +
        "this route, or a proxy/edge layer is stripping the header before " +
        "it reaches this render.",
    );
  }

  // Fallback to undefined instead of an empty string to prevent invalid CSP attributes
  const nonce = rawNonce || undefined;

  let clerkOrigin: string | null = null;
  if (env.clerk.frontendApi) {
    try {
      clerkOrigin = new URL(env.clerk.frontendApi).origin;
    } catch {
      // safe fallback
    }
  }

  const siteUrl = env.appUrl ?? "http://localhost:3500";

  // Organization structured data — helps Google surface Build Market as a
  // known entity (knowledge panel, sitelinks) and is a near-zero-cost SEO
  // win that was previously entirely absent from the page's <head>. Kept
  // as a plain object (not user input) so JSON.stringify here is safe, and
  // nonce'd like every other injected script to satisfy the strict CSP
  // this app already enforces.
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Build Market",
    url: siteUrl,
    logo: `${siteUrl}/bm-logo-main.png`,
    description:
      "Build Market connects Kenyan homeowners with verified architects, engineers, contractors, and building suppliers.",
    areaServed: "KE",
  };

  return (
    <ClerkProvider
      publishableKey={env.clerk.publishableKey}
      nonce={nonce}
      {...(env.clerk.isSatellite
        ? {
            isSatellite: true,
            domain: env.clerk.domain,
            signInUrl: env.clerk.primarySignInUrl,
          }
        : {})}
    >
      <html lang="en" className={dmSans.variable} suppressHydrationWarning>
        <head>
          {/* Preconnect to Clerk FAPI dynamically configured by env */}
          {clerkOrigin && (
            <>
              <link
                rel="preconnect"
                href={clerkOrigin}
                crossOrigin="anonymous"
              />
              <link rel="dns-prefetch" href={clerkOrigin} />
            </>
          )}
          <link
            rel="preconnect"
            href="https://clerk-telemetry.com"
            crossOrigin="anonymous"
          />
          <link rel="dns-prefetch" href="https://clerk-telemetry.com" />
          <link rel="preconnect" href="https://images.unsplash.com" />
          <link rel="dns-prefetch" href="https://res.cloudinary.com" />

          {/* Organization structured data (see audit doc, SEO section) */}
          <script
            type="application/ld+json"
            nonce={nonce}
            // SECURITY_XSS_ALLOWLIST: Static schema.org organization metadata, safe JSON-LD without user input
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(organizationJsonLd),
            }}
          />

          {/* Pre-hydration theme application: prevents theme flash & supports ?theme=dark */}
          <script
            nonce={nonce}
            // SECURITY_XSS_ALLOWLIST: Static client-side theme initialization IIFE without user input
            // SECURITY_PERSISTENCE_ALLOWLIST: Reads non-sensitive accessibility theme preferences
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var p=new URLSearchParams(window.location.search).get('theme');var s=localStorage.getItem('accessibility-settings');var t=p||(s?JSON.parse(s).state?.theme:null);if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}else if(t==='light'){document.documentElement.classList.remove('dark');}}catch(e){}})();`,
            }}
          />
        </head>
        <body
          className={`${dmSans.className} antialiased bg-background text-foreground`}
          suppressHydrationWarning
        >
          <a
            href="#main-content"
            className="sr-only z-100 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
          >
            Skip to main content
          </a>

          {/* SVG Filters for Color Blind Modes */}
          <svg
            aria-hidden="true"
            style={{
              position: "absolute",
              width: 0,
              height: 0,
              overflow: "hidden",
            }}
          >
            <defs>
              {/* Protanopia (Red-blind) filter */}
              <filter id="protanopia-filter">
                <feColorMatrix
                  type="matrix"
                  values="0.567, 0.433, 0,     0, 0
                          0.558, 0.442, 0,     0, 0
                          0,     0.242, 0.758, 0, 0
                          0,     0,     0,     1, 0"
                />
              </filter>
              {/* Deuteranopia (Green-blind) filter */}
              <filter id="deuteranopia-filter">
                <feColorMatrix
                  type="matrix"
                  values="0.625, 0.375, 0,   0, 0
                          0.7,   0.3,   0,   0, 0
                          0,     0.3,   0.7, 0, 0
                          0,     0,     0,   1, 0"
                />
              </filter>
              {/* Tritanopia (Blue-blind) filter */}
              <filter id="tritanopia-filter">
                <feColorMatrix
                  type="matrix"
                  values="0.95, 0.05,  0,     0, 0
                          0,    0.433, 0.567, 0, 0
                          0,    0.475, 0.525, 0, 0
                          0,    0,     0,     1, 0"
                />
              </filter>
            </defs>
          </svg>

          <PostHogProvider>
            <QueryProvider>
              <AccessibilityProvider>
                <CookieConsentProvider>
                  <RouteFocusManager />
                  <div id="main-content" tabIndex={-1} className="outline-none">
                    {children}
                  </div>
                  {/*
                   * Moved here from being rendered ad hoc at the bottom of
                   * app/page.tsx. Legal/compliance links must be reachable
                   * from every route, not just the homepage — mounting
                   * Footer once in the root layout guarantees that instead
                   * of relying on every future page author to remember to
                   * add <Footer /> themselves. See the audit doc's "Legal
                   * routes" section for the reasoning.
                   */}
                  <Footer />
                  <CookieBanner />
                  <ToastContainer
                    position="bottom-right"
                    autoClose={4000}
                    hideProgressBar={false}
                    closeOnClick
                    pauseOnHover
                    limit={3}
                  />
                </CookieConsentProvider>
              </AccessibilityProvider>
            </QueryProvider>
          </PostHogProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
