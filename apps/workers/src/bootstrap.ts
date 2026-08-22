import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Bootstrap environment variables before any application or third-party modules are evaluated.
 * In local development, loads .env followed by .env.local with override semantics.
 * In production/containerized environments, existing process.env variables are preserved.
 */
const cwd = process.cwd();
const defaultEnvPath = resolve(cwd, ".env");
const localEnvPath = resolve(cwd, ".env.local");

if (typeof process.loadEnvFile === "function") {
  if (existsSync(defaultEnvPath)) {
    try {
      process.loadEnvFile(defaultEnvPath);
    } catch {
      // Ignore in non-local environments
    }
  }
  if (existsSync(localEnvPath)) {
    try {
      process.loadEnvFile(localEnvPath);
    } catch {
      // Ignore in non-local environments
    }
  }
}
