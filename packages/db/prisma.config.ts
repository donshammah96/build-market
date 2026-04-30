import { defineConfig } from "@prisma/config";
import fs from "fs";
import path from "path";

function loadEnv() {
  const envPath = path.resolve(__dirname, ".env");
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
          .replace(/(^"|"$)/g, ""); // basic unquote
        if (key && !process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Prisma 7 CLI (migrate deploy / migrate dev) uses this URL.
    //
    // Supabase free tier: direct TCP (db.*.supabase.co:5432) is blocked without
    // the IPv4 add-on. The session-mode pooler (port 5432 on pooler host) supports
    // DDL and is safe to use for migrations on Supabase free/hobbyist plans.
    //
    // Production upgrade path: set DIRECT_URL to the session-mode pooler URL
    // or purchase the IPv4 add-on and point it to db.*.supabase.co:5432.
    url: process.env.DATABASE_URL,
  },
});
