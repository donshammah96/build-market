/**
 * Admin Actions - Backward Compatibility Re-exports
 *
 * This file maintains backward compatibility with existing imports.
 * All actions are now organized in the `admin/` subdirectory by domain:
 *
 * - admin/shared.ts      - Types, schemas, and middleware
 * - admin/dashboard.ts   - Dashboard statistics
 * - admin/users.ts       - User management
 * - admin/professionals.ts - Professional management
 * - admin/projects.ts    - Project management
 * - admin/settings.ts    - System settings
 *
 * For new code, prefer importing from "@/actions/admin" directly
 * which maps to admin/index.ts
 */

export * from "./admin/index";

// Re-export SystemSettingsInput type for existing imports
export type { SystemSettingsInput } from "./admin/shared";
