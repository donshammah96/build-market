import { envConfig } from "@/lib/infrastructure/env";
import { redirect } from "next/navigation";

/**
 * verification-ops sign-in page.
 *
 * This app is now a Clerk satellite (see layout.tsx / middleware.ts) —
 * authentication is always handled by the primary app (buildmarket.app,
 * apps/client). This page exists only as a safety net for direct
 * navigation to /sign-in on this app's domain — middleware.ts already
 * intercepts unauthenticated requests to every other route and redirects
 * them to the primary sign-in URL with a `redirect_url` set. Anyone who
 * reaches this route directly (e.g. a saved bookmark, or the client-app
 * shadow-mode banner link before a session exists) is forwarded to the
 * primary sign-in page immediately; no sign-in UI is rendered on this
 * domain any more.
 *
 * Mirrors apps/admin's equivalent page.tsx — keep both in sync.
 *
 * No additional `redirect_url` construction is attempted here beyond
 * whatever query params the caller already provided: by the time a user
 * lands on this page via direct navigation there's no meaningful
 * verification-ops URL to reconstruct beyond what's already in the query
 * string, and the primary app handles post-sign-in routing via Clerk's
 * own `afterSignInUrl` / `fallbackRedirectUrl` configuration.
 *
 * REMOVED: this route previously rendered a full dark-themed <SignIn />
 * component directly (see CHANGELOG). That UI is gone — this app no
 * longer has its own sign-in surface at all, by design, now that it
 * delegates to the primary's canonical session.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const params = await searchParams;
  const target =
    envConfig.clerk.primarySignInUrl || envConfig.clerk.signInUrl || "/";

  const isAbsolute =
    target.startsWith("http://") || target.startsWith("https://");
  const destination = isAbsolute
    ? new URL(target)
    : new URL(target, "http://n");

  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) {
        if (Array.isArray(v)) {
          destination.searchParams.delete(k);
          v.forEach((val) => destination.searchParams.append(k, val));
        } else {
          destination.searchParams.set(k, v);
        }
      }
    });
  }

  const redirectUrl = isAbsolute
    ? destination.toString()
    : `${destination.pathname}${destination.search}`;

  redirect(redirectUrl);
}
