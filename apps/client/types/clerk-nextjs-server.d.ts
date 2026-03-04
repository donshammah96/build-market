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

  export function clerkMiddleware(
    handler: (
      auth: ClerkAuth,
      req: NextRequest,
    ) => Promise<Response> | Response,
  ): (req: NextRequest, event?: unknown) => Promise<Response> | Response;
}
