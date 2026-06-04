import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { adminEnvConfig } from "@/lib/infrastructure/env";

export const metadata: Metadata = {
  title: "Build Market",
  description: "Find the best professionals for your building project",
  metadataBase: new URL("https://build-market.vercel.app"),
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Build Market",
    description: "Find the best professionals for your building project",
    url: "https://build-market.vercel.app",
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
        <body className="antialiased">{children}</body>
      </html>
    );
  }
  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <html lang="en" suppressHydrationWarning>
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
