export interface SecurityHeader {
  key: string;
  value: string;
}

export const ADMIN_SECURITY_HEADERS: SecurityHeader[] = [
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
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
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
];

export function getAdminSecurityHeaders(): SecurityHeader[] {
  return ADMIN_SECURITY_HEADERS;
}
