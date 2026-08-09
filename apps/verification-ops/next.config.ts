import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // FIX: @build/enums is a declared dependency (package.json) but was
  // missing here. If it ships untranspiled TS source (same source-first
  // pattern as the other @build/* packages), omitting it either breaks the
  // build or silently works only by accident depending on how it's
  // published — add it so this isn't dependent on luck.
  transpilePackages: [
    "@build/ui",
    "@build/verification-domain",
    "@build/db",
    "@build/types",
    "@build/enums",
    "@build/env-validation",
    "@build/security-clerk",
  ],
  // Don't advertise the framework on a compliance-sensitive internal tool.
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Applies to every route in this app - there is no public/marketing
        // surface here that would want a looser policy.
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            // HSTS only makes sense once this is actually served over
            // HTTPS everywhere (prod). Leave the includeSubDomains/preload
            // decision to whoever owns the domain - flagged here rather
            // than silently opted into preload, which is hard to undo.
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
