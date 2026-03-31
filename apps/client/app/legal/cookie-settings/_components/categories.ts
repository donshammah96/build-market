import type { CookieConsent } from "@/components/providers/CookieConsentProvider";

export interface CookieDetail {
  name: string;
  purpose: string;
  expiry: string;
}

export interface CategoryConfig {
  key: "necessary" | keyof Omit<CookieConsent, "necessary">;
  label: string;
  description: string;
  locked: boolean;
  emoji: string;
  borderColor: string;
  cookies: CookieDetail[];
}

export const CATEGORIES: CategoryConfig[] = [
  {
    key: "necessary",
    label: "Strictly Necessary",
    description:
      "These cookies are essential for the website to function. They enable core features like authentication, security, and accessibility. You cannot disable them — and honestly, you wouldn't want to.",
    locked: true,
    emoji: "🔒",
    borderColor: "border-zinc-500/30",
    cookies: [
      {
        name: "__clerk_session",
        purpose: "Authentication session management",
        expiry: "Session",
      },
      {
        name: "__clerk_db_jwt",
        purpose: "Secure authentication token",
        expiry: "7 days",
      },
      {
        name: "bm_cookie_consent",
        purpose: "Stores your cookie preferences",
        expiry: "1 year",
      },
    ],
  },
  {
    key: "analytics",
    label: "Analytics & Performance",
    description:
      "These cookies help us understand how visitors interact with Build Market. They collect anonymous data so we can improve the user experience. No personal data is shared with third parties.",
    locked: false,
    emoji: "📊",
    borderColor: "border-emerald-500/20",
    cookies: [
      {
        name: "_ga / _ga_*",
        purpose: "Google Analytics — page views and user journeys",
        expiry: "2 years",
      },
      {
        name: "_gid",
        purpose: "Google Analytics — session tracking",
        expiry: "24 hours",
      },
      {
        name: "bm_ab_group",
        purpose: "A/B testing group assignment",
        expiry: "30 days",
      },
    ],
  },
  {
    key: "marketing",
    label: "Marketing & Advertising",
    description:
      "These cookies are used to deliver relevant ads and measure campaign performance. We don't sell your data — we just want to stop showing you ads for things you've already bought.",
    locked: false,
    emoji: "📣",
    borderColor: "border-amber-500/20",
    cookies: [
      {
        name: "_fbp",
        purpose: "Facebook Pixel — ad targeting",
        expiry: "3 months",
      },
      {
        name: "_gcl_au",
        purpose: "Google Ads — conversion tracking",
        expiry: "3 months",
      },
    ],
  },
  {
    key: "functional",
    label: "Functional & Preferences",
    description:
      "These cookies remember your preferences so the site works better for you. Think of them as the site's short-term memory — without them, it's like meeting someone who forgot your name. Every. Single. Time.",
    locked: false,
    emoji: "⚙️",
    borderColor: "border-cyan-500/20",
    cookies: [
      {
        name: "bm_theme",
        purpose: "Remembers dark/light mode preference",
        expiry: "1 year",
      },
      {
        name: "bm_locale",
        purpose: "Language and region preference",
        expiry: "1 year",
      },
    ],
  },
];
