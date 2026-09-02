import { existsSync } from "node:fs";
import { resolve } from "node:path";
import dns from "node:dns";

// Ensure IPv4 resolution takes precedence in containerized environments (Render/Docker)
// where outbound IPv6 routes may be unreachable (ENETUNREACH).
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

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
