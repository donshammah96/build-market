/**
 * Load .env before any Prisma/database imports.
 * Must be imported first in seed.ts so DATABASE_URL is available.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const currentDir =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const envPath = path.resolve(currentDir, "..", ".env");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  envConfig.split("\n").forEach((line) => {
    const parts = line.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts
        .slice(1)
        .join("=")
        .trim()
        .replace(/(^"|"$)/g, "");
      if (key && !process.env[key]) process.env[key] = value;
    }
  });
}
