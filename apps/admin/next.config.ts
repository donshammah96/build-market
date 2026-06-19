import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
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
