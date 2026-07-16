/**
 * apps/client/lib/links.ts
 *
 * Backward-compatibility re-export barrel.
 * Legacy files importing from `@/lib/links` will be routed here.
 * New code must import directly from `@/lib/routes` (barrel index or domain-specific files).
 */

export * from "./routes";
