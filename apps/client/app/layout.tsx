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

  // Fallback to undefined instead of an empty string to prevent invalid CSP attributes
  const nonce = rawNonce || undefined;

  const { auth } = await import("@clerk/nextjs/server");
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <ClerkProvider nonce={nonce} dynamic>
      <html lang="en" className={dmSans.variable}>
        <head>
          {/* Preconnect to critical third-party origins */}
          <link rel="preconnect" href="https://clerk.com" />
          <link rel="preconnect" href="https://images.unsplash.com" />
          <link rel="dns-prefetch" href="https://res.cloudinary.com" />
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
                <CookieConsentProvider isSignedIn={isSignedIn}>
                  <RouteFocusManager />
                  <div id="main-content" tabIndex={-1} className="outline-none">
                    {children}
                  </div>
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
