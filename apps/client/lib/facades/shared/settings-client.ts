/**
 * Settings Client
 *
 * Client-side fetch for public system settings.
 */
import { z } from "zod";
import { API_ROUTES } from "@/lib/routes";

export const PublicSettingsSchema = z.object({
  maintenanceMode: z.boolean().catch(false),
  maintenanceMessage: z.string().nullable().catch(null),
  allowedIPs: z.array(z.string()).default([]),
  publicSignup: z.boolean().default(true),
  allowProfessionalSignup: z.boolean().default(true),
  featureFlags: z.record(z.string(), z.unknown()).default({}),
  supportEmail: z.string().email().catch("support@buildmarket.co.ke"),
  supportPhone: z.string().nullable(),
  whatsappNumber: z.string().nullable(),
});

export type PublicSettings = z.infer<typeof PublicSettingsSchema>;

/**
 * Module-level memoization of settings promise.
 *
 * ⚠️  SSR WARNING: This is a process-global singleton. When called from
 * server components or middleware, this will be shared across ALL requests
 * and users. Only use `settingsClient` from client components ('use client').
 */
let settingsPromise: Promise<PublicSettings> | null = null;

async function fetchPublicSettings(): Promise<PublicSettings> {
  if (typeof window === "undefined") {
    // SSR guard: do not attempt relative fetch on server, return safe defaults
    return PublicSettingsSchema.parse({});
  }

  try {
    const res = await fetch(API_ROUTES.settingsPublic, {
      // Use 'next' or 'cache' options if using Next.js 13+
      next: { revalidate: 60 },
    });

    if (!res.ok) throw new Error(`HTTP_${res.status}`);

    const rawData = await res.json();

    // .parse ensures that if the API sends garbage, we fall back to safe defaults
    return PublicSettingsSchema.parse(rawData);
  } catch (error) {
    console.warn(
      "[SettingsClient] Failed to fetch or validate settings:",
      error,
    );

    // Fallback: Ensure the app can still boot even if the API is down
    return PublicSettingsSchema.parse({});
  }
}

export const settingsClient = {
  /**
   * Returns a memoized promise of the public settings.
   */
  getPublic: (): Promise<PublicSettings> => {
    if (!settingsPromise) {
      settingsPromise = fetchPublicSettings();
    }
    return settingsPromise;
  },

  /**
   * Clears the cache (e.g., after an admin update)
   */
  clearCache: () => {
    settingsPromise = null;
  },
};
