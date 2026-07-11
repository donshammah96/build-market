import { adminEnvConfig } from "@/lib/infrastructure/env";
import { redirect } from "next/navigation";

/**
 * Admin sign-in page.
 *
 * The admin app is a Clerk satellite. Authentication is always handled by
 * the primary app (buildmarket.app). This page exists only as a safety net
 * for direct navigation to /sign-in on the admin domain — the middleware
 * already intercepts unauthenticated requests and redirects them to the
 * primary sign-in URL with a `redirect_url` set. Anyone who reaches this
 * route directly (e.g. a saved bookmark) is forwarded to the primary sign-in
 * page immediately; no sign-in UI is rendered on the admin domain.
 *
 * No `redirect_url` forwarding is attempted here: by the time a user lands
 * on this page via direct navigation there is no meaningful admin URL to
 * return them to, and the primary app handles post-sign-in routing via
 * Clerk's own `afterSignInUrl` / `fallbackRedirectUrl` configuration.
 */
export default function SignInPage() {
  const destination =
    adminEnvConfig.NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL ||
    adminEnvConfig.NEXT_PUBLIC_CLERK_SIGN_IN_URL ||
    "/";

  redirect(destination);
}
