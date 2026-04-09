import type { NextConfig } from "next";
import { readNextConfigEnv } from "./next-config-env";

const configEnv = readNextConfigEnv();

const toOrigin = (value?: string): string | null => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const appOrigin = toOrigin(configEnv.appUrl) ?? "http://localhost:3500";
const apiOrigin = toOrigin(configEnv.apiUrl) ?? `${appOrigin}/api`;
const clerkFrontendApiOrigin = toOrigin(configEnv.clerkFrontendApi);
const analyticsOrigin = toOrigin(configEnv.analyticsPosthogHost);

const selfAndFirstParty = Array.from(new Set(["'self'", appOrigin, apiOrigin]));

const connectOrigins = Array.from(
  new Set(
    [
      ...selfAndFirstParty,
      // Third-party (identity): Clerk frontend API for auth/session operations.
      clerkFrontendApiOrigin,
      // Third-party (analytics): PostHog ingestion/query endpoint.
      analyticsOrigin,
      // Dev-only HMR websocket endpoint; no wildcard host.
      configEnv.nodeEnv === "development"
        ? appOrigin.replace(/^http/, "ws")
        : null,
    ].filter((origin): origin is string => Boolean(origin)),
  ),
);

const scriptOrigins = Array.from(
  new Set(
    [
      ...selfAndFirstParty,
      // Third-party (identity): Clerk hosted assets for client auth widgets.
      "https://clerk.buildmarket.co.ke",
      "https://cdn.jsdelivr.net",
      "https://img.clerk.com",
      // Third-party (analytics): PostHog web SDK assets.
      analyticsOrigin,
    ].filter((origin): origin is string => Boolean(origin)),
  ),
);

const styleOrigins = Array.from(
  new Set([
    "'self'",
    // Next.js and some UI libraries inject inline style attributes at runtime.
    "'unsafe-inline'",
    // Third-party (typography): Google Fonts stylesheet host.
    "https://fonts.googleapis.com",
  ]),
);

const imageOrigins = Array.from(
  new Set([
    "'self'",
    "data:",
    "blob:",
    // Third-party (identity avatars): Clerk image CDN.
    "https://img.clerk.com",
    // Third-party (media hosting): Cloudinary.
    "https://res.cloudinary.com",
    // Third-party (image catalog): Unsplash and related hostnames.
    "https://images.unsplash.com",
    "https://unsplash.com",
    // Third-party (placeholder avatars): Pravatar.
    "https://i.pravatar.cc",
  ]),
);

const fontOrigins = Array.from(
  new Set([
    "'self'",
    "data:",
    // Third-party (typography): Google Fonts file host.
    "https://fonts.gstatic.com",
  ]),
);

const cspValue = [
  "default-src 'self'",
  `script-src ${scriptOrigins.join(" ")}`,
  `style-src ${styleOrigins.join(" ")}`,
  `img-src ${imageOrigins.join(" ")}`,
  `font-src ${fontOrigins.join(" ")}`,
  `connect-src ${connectOrigins.join(" ")}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

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
    "@build/auth-server",
    "@build/messaging-server",
    "@build/mail-server",
    "@build/queue-server",
  ],

  // Turbopack configuration (used in dev mode with --turbopack flag)
  turbopack: {
    // Turbopack will handle optimizations automatically
    // If you need custom loaders in the future (e.g., for SVGs), you can configure them here:
    // rules: {
    //   "*.svg": {
    //     loaders: ["@svgr/webpack"],
    //     as: "*.js",
    //   }
    // }
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
      configEnv.nodeEnv === "production"
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
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: cspValue,
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
