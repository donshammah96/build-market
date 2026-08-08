import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.accounts.dev https://img.clerk.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://img.clerk.com https://res.cloudinary.com; connect-src 'self' https://*.clerk.accounts.dev https://clerk.com; font-src 'self' data:; frame-ancestors 'none';",
          },
        ],
      },
    ];
  },

  transpilePackages: [
    "@build/ui",
    "@build/db",
    "@build/types",
    "@build/enums",
    "@build/nats",
    "@build/redis",
    "@build/resilience",
    "@build/auth-server",
    "@build/messaging-server",
    "@build/mail-server",
    "@build/queue-server",
    "@build/env-validation",
    "@build/security-clerk",
  ],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@clerk/nextjs",
      "date-fns",
      "@tanstack/react-query",
      "recharts",
    ],
  },
};

export default nextConfig;
