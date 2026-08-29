import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { adminEnvConfig } from "@/lib/infrastructure/env";

/**
 * Strip any scheme prefix from a Clerk domain so it is always a bare
 * host. Mirrors the same helper in middleware.ts — both must be kept
 * in sync. Example: "https://admin.buildmarket.app" → "admin.buildmarket.app".
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

export const metadata: Metadata = {
  title: "Build Market",
  description: "Find the best professionals for your building project",
  metadataBase: new URL("https://buildmarket.app"),
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Build Market",
    description: "Find the best professionals for your building project",
    url: "https://buildmarket.app",
    siteName: "Build Market",
    images: [
      {
        url: "/hero-desktop1.png",
        width: 1200,
        height: 630,
        alt: "Build Market",
      },
    ],
    locale: "en-KE",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Build Market",
    description: "Find the best professionals for your building project",
    images: ["/hero-mobile.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clerkPublishableKey = adminEnvConfig.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!clerkPublishableKey) {
    return (
      <html lang="en" suppressHydrationWarning>
        <body className="antialiased" suppressHydrationWarning>
          {children}
        </body>
      </html>
    );
  }

  if (
    adminEnvConfig.NEXT_PUBLIC_CLERK_IS_SATELLITE &&
    !adminEnvConfig.NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL
  ) {
    throw new Error(
      "NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL is required when NEXT_PUBLIC_CLERK_IS_SATELLITE is true to prevent infinite redirect loops.",
    );
  }

  const providerProps = {
    publishableKey: clerkPublishableKey,
    isSatellite: adminEnvConfig.NEXT_PUBLIC_CLERK_IS_SATELLITE,
    ...(normalizeClerkDomain(adminEnvConfig.NEXT_PUBLIC_CLERK_DOMAIN)
      ? {
          domain: normalizeClerkDomain(
            adminEnvConfig.NEXT_PUBLIC_CLERK_DOMAIN,
          )!,
        }
      : {}),
    // For satellite apps, signInUrl MUST be the primary domain's absolute URL
    // (e.g. https://buildmarket.app/sign-in). A relative path causes Clerk to
    // route auth to the satellite itself, producing an infinite redirect loop.
    // NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL holds the absolute primary URL;
    // NEXT_PUBLIC_CLERK_SIGN_IN_URL is the local satellite route (/sign-in)
    // used only by the middleware and internal routing.
    ...(adminEnvConfig.NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL
      ? { signInUrl: adminEnvConfig.NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL }
      : adminEnvConfig.NEXT_PUBLIC_CLERK_SIGN_IN_URL
        ? { signInUrl: adminEnvConfig.NEXT_PUBLIC_CLERK_SIGN_IN_URL }
        : {}),
  };

  return (
    <ClerkProvider {...providerProps}>
      <html lang="en" suppressHydrationWarning>
        <body className="antialiased" suppressHydrationWarning>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
