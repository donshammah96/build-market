import type { Metadata } from "next";
import "./globals.css";
import {
  ClerkProvider
} from '@clerk/nextjs'
import { Inter, Roboto} from 'next/font/google'
import { ToastContainer } from 'react-toastify';

const inter = Inter({ subsets: ["latin"] });
const roboto = Roboto({ subsets: ["latin"], weight: "400" });


export const metadata: Metadata = {
  title: 'Build Market',
  description: 'Find the best professionals for your building project',
  metadataBase: new URL('https://build-market.vercel.app'),
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'Build Market',
    description: 'Find the best professionals for your building project',
    url: 'https://build-market.vercel.app',
    siteName: 'Build Market',
    images: [
      {
        url: '/hero-desktop1.png',
        width: 1200,
        height: 630,
        alt: 'Build Market',
      },
    ],
    locale: 'en-KE',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Build Market',
    description: 'Find the best professionals for your building project',
    images: ['/hero-mobile.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
      <body className={`${inter.className} ${roboto.className} antialiased bg-white`}>
          {children}
          <ToastContainer position="bottom-right" />
      </body>
    </html>
    </ClerkProvider>
  );
}
