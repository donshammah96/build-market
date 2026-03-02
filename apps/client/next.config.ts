import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable linting during build since turbo will handle it separately
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable type checking during build since turbo will handle it separately
  typescript: {
    ignoreBuildErrors: true,
  },

  // Enable React strict mode for better development experience
  reactStrictMode: true,

  // Automatically transpile and bundle workspace packages with SWC
  transpilePackages: [
    "@build/ui",
    "@build/db",
    "@build/types",
    "@build/enums",
    "@build/nats",
    "@build/redis",
    "@build/resilience",
  ],

  // Turbopack configuration (used in dev mode with --turbopack flag)
  turbopack: {
    // Turbopack will handle optimizations automatically
  },

  // Optimize images for faster loading
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
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "unsplash.com",
      },
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
    ],
    // Use modern image formats for better compression
    formats: ["image/avif", "image/webp"],
    // Optimize images at build time
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    // Image sizes for different layouts
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Enable experimental features for better performance
  experimental: {
    // Optimize package imports to reduce bundle size
    optimizePackageImports: [
      "lucide-react",
      "@clerk/nextjs",
      "framer-motion",
      "date-fns",
      "@tanstack/react-query",
      "recharts",
    ],
  },

  // Compiler options for production optimization
  compiler: {
    // Remove console.log in production (except errors)
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : false,
  },

  // Headers for performance and security
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
        ],
      },
      {
        // Cache static assets aggressively
        source: "/(.*)\\.(ico|png|jpg|jpeg|gif|webp|avif|svg|woff|woff2)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },

  // Redirects for SEO
  async redirects() {
    return [
      // Example redirect for old URLs
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
    ];
  },

  // Webpack optimization for production builds (not used with Turbopack in dev)
  webpack: (config) => {
    // Let Next.js and optimizePackageImports handle framer-motion optimization
    return config;
  },

  // Enable source maps in production for debugging (optional)
  productionBrowserSourceMaps: false,

  // Powered by header (can disable for security)
  poweredByHeader: false,

  // Compression is handled by Vercel, but enable for other deployments
  compress: true,
};

export default nextConfig;
