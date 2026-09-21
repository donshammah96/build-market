import type { NextRequest } from "next/server";

declare module "@clerk/nextjs/server" {
  export type ClerkAuthResult = {
    userId?: string | null;
    sessionClaims?: unknown;
    [key: string]: unknown;
  };

  export type ClerkAuth = () => Promise<ClerkAuthResult>;

  export function auth(): Promise<ClerkAuthResult>;
  export function currentUser(): Promise<unknown>;
  export function clerkClient(): Promise<unknown>;

  export function createRouteMatcher(
    routes: ReadonlyArray<string>,
  ): (req: NextRequest) => boolean;

  export type ClerkMiddlewareOptions = {
    isSatellite?: boolean;
    domain?: string;
    signInUrl?: string;
    [key: string]: unknown;
  };

  export function clerkMiddleware(
    handler?: (
      auth: ClerkAuth,
      req: NextRequest,
    ) => Promise<Response> | Response,
    options?:
      ClerkMiddlewareOptions | ((req: NextRequest) => ClerkMiddlewareOptions),
  ): (req: NextRequest, event?: unknown) => Promise<Response> | Response;
}
