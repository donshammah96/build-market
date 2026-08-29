import { prisma } from "@build/db";
import { SystemSettingsSchema, type SystemSettings } from "@build/types";

/**
 * Persistence-only repository for system settings.
 * Manages low-level database queries with fail-fast timeout and P2022 raw query fallback.
 * No business logic, no in-memory cache, no HTTP/transport concerns.
 */
export const settingsRepository = {
  /**
   * Fetch the global system settings row with a 3,000ms fail-fast timeout.
   */
  async findGlobalWithTimeout(
    timeoutMs = 3000,
  ): Promise<SystemSettings | null> {
    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      const queryPromise = prisma.systemSettings.findUnique({
        where: { id: "global" },
      });
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () =>
            reject(
              Object.assign(
                new Error(`DB query timed out after ${timeoutMs}ms`),
                {
                  code: "ETIMEDOUT",
                },
              ),
            ),
          timeoutMs,
        );
      });

      const row = await Promise.race([queryPromise, timeoutPromise]);
      if (!row) return null;
      return SystemSettingsSchema.parse(row);
    } catch (error) {
      const prismaCode =
        error instanceof Error &&
        "code" in error &&
        typeof (error as Record<string, unknown>)["code"] === "string"
          ? (error as Record<string, unknown>)["code"]
          : "UNKNOWN";

      // Defensive fallback for P2022 (Column missing in DB table due to pending migration)
      if (prismaCode === "P2022") {
        try {
          const rawRows = await prisma.$queryRawUnsafe<
            Record<string, unknown>[]
          >(`SELECT * FROM "SystemSettings" WHERE id = 'global' LIMIT 1`);
          const rawRow = rawRows && rawRows.length > 0 ? rawRows[0] : null;
          if (rawRow) {
            console.warn(
              JSON.stringify({
                event: "system_settings_schema_drift",
                severity: "WARN",
                prismaCode,
                message:
                  "SystemSettings table missing columns (P2022) — loaded raw row with defaults; deploy prisma migration",
              }),
            );
            return SystemSettingsSchema.parse(rawRow);
          }
        } catch {
          // Fall through to re-throw error for service-layer fallback
        }
      }

      throw error;
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  },
};
