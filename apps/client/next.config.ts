import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
// bootstrap-only: Next.js config runs before the module graph is initialized.
// Direct env reads via next-config-env.ts are intentional per ADR-004.
// Variables accessed here are inventoried in app/lib/infrastructure/env.ts.
import { readNextConfigEnv } from "./next-config-env";
import { buildCspValue } from "./next-config-csp";

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

const nextConfig: NextConfig = {
  // ---------------------------------------------------------------------------
  // TypeScript
  // Type checking is performed by the Turbo `check-types` pipeline task
  // (turbo.json → "check-types"). This flag suppresses duplicate checking
  // during `next build` when invoked through Turbo.
  // INVARIANT: `pnpm turbo check-types` MUST run before any production deploy.
  // Running `next build` directly without Turbo will silently skip type errors.
  // ---------------------------------------------------------------------------
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
    "@build/env-validation",
    "@build/security-clerk",
    "@build/media",
    "@build/telemetry",
    "@build/lead-qualification",
  ],

  // Turbopack configuration (used in dev mode with --turbopack flag)
  turbopack: {
    // Turbopack handles optimizations automatically.
    // Custom loaders (e.g. SVGs via @svgr/webpack) can be added here when needed.
    // rules: { "*.svg": { loaders: ["@svgr/webpack"], as: "*.js" } }
  },

  // Optimize images for faster loading (unoptimized for Cloudflare Workers V8 isolate)
  images: {
    unoptimized: true,
    qualities: [75, 85],
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "unsplash.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
    ],
    // Use modern image formats for better compression
    formats: ["image/avif", "image/webp"],
    // 30-day CDN TTL for optimized images
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Optimize package imports to reduce bundle size (experimental)
  experimental: {
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
    // Remove console.log statements in production (keep error + warn for observability)
    removeConsole:
      readNextConfigEnv().nodeEnv === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },

  // ---------------------------------------------------------------------------
  // Security & performance headers (ADR-008 §4 baseline)
  // CSP is assembled inside this function — not at module-load/build time — so
  // origin values reflect the deployment's runtime env, not the build snapshot.
  // ---------------------------------------------------------------------------
  async headers() {
    // bootstrap-only: env access is intentional per ADR-004
    const configEnv = readNextConfigEnv();
    const appOrigin = toOrigin(configEnv.appUrl) ?? "http://localhost:3500";
    const apiOrigin = toOrigin(configEnv.apiUrl) ?? `${appOrigin}/api`;

    const cspValue = buildCspValue({
      appOrigin,
      apiOrigin,
      clerkFrontendApiOrigin: toOrigin(configEnv.clerkFrontendApi),
      analyticsOrigin: toOrigin(configEnv.analyticsPosthogHost),
      isDev: configEnv.nodeEnv === "development",
    });

    return [
      {
        // ADR-008 §4 security header baseline — applied to all routes.
        source: "/:path*",
        headers: [
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
            // Deny all high-risk browser capabilities not needed by this app.
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()",
          },
          {
            // HSTS: 2-year max-age with subdomains.
            // To add preload, submit buildmarket.live to hstspreload.org first.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            // CSP: assembled at config-evaluation time from env-derived origins.
            // Exception justifications are co-located in next-config-csp.ts.
            key: "Content-Security-Policy",
            value: cspValue,
          },
        ],
      },
      {
        // Immutable cache for fingerprinted static assets.
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

  // SEO redirects
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
    ];
  },

  // Source maps: disabled in production browser bundle.
  // If using Sentry or another error tracker, upload maps at build time instead.
  productionBrowserSourceMaps: false,

  // Remove X-Powered-By header (minor security hardening)
  poweredByHeader: false,

  // Gzip compression — Vercel handles this natively; retained for other deployments.
  compress: true,
};

// ---------------------------------------------------------------------------
// Bundle analyzer — conditional wrapper (dev tool, not part of runtime config)
// Apply only when ANALYZE=true so the base config remains directly inspectable.
// Usage: ANALYZE=true pnpm --filter client build
// ---------------------------------------------------------------------------
export default process.env.ANALYZE === "true"
  ? bundleAnalyzer({ enabled: true })(nextConfig)
  : nextConfig;
