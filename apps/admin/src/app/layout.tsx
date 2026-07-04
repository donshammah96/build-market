import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { adminEnvConfig } from "@/lib/infrastructure/env";

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

  const providerProps = {
    publishableKey: clerkPublishableKey,
    isSatellite: adminEnvConfig.NEXT_PUBLIC_CLERK_IS_SATELLITE,
    ...(adminEnvConfig.NEXT_PUBLIC_CLERK_DOMAIN
      ? { domain: adminEnvConfig.NEXT_PUBLIC_CLERK_DOMAIN }
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
