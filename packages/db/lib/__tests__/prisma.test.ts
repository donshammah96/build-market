import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { resolveDatabaseUrl } from "../connection-url";

describe("resolveDatabaseUrl", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_PRISMA_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.SUPABASE_DATABASE_URL;
    delete process.env.DATABSE_URL;
    delete process.env.VERCEL;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("resolves primary DATABASE_URL when configured", () => {
    process.env.DATABASE_URL =
      "postgresql://postgres:pass@aws-1.pooler.supabase.com:5432/postgres";
    const result = resolveDatabaseUrl();
    expect(result).toBe(
      "postgresql://postgres:pass@aws-1.pooler.supabase.com:5432/postgres",
    );
  });

  it("resolves fallback aliases when DATABASE_URL is unset", () => {
    process.env.POSTGRES_PRISMA_URL =
      "postgresql://postgres:pass@aws-1.pooler.supabase.com:5432/postgres?pgbouncer=true";
    expect(resolveDatabaseUrl()).toBe(
      "postgresql://postgres:pass@aws-1.pooler.supabase.com:5432/postgres?pgbouncer=true",
    );

    delete process.env.POSTGRES_PRISMA_URL;
    process.env.SUPABASE_DATABASE_URL =
      "postgresql://postgres:pass@aws-supabase:5432/postgres";
    expect(resolveDatabaseUrl()).toBe(
      "postgresql://postgres:pass@aws-supabase:5432/postgres",
    );
  });

  it("recovers gracefully from common DATABSE_URL typo with a warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.DATABSE_URL =
      "postgresql://postgres:pass@aws-1.pooler.supabase.com:5432/postgres";

    const result = resolveDatabaseUrl();
    expect(result).toBe(
      "postgresql://postgres:pass@aws-1.pooler.supabase.com:5432/postgres",
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("DATABSE_URL"),
    );
    warnSpy.mockRestore();
  });

  it("throws descriptive error when no database URL is present", () => {
    expect(() => resolveDatabaseUrl()).toThrowError(
      "[@build/db] DATABASE_URL is not set",
    );
  });

  it("rejects loopback/localhost URLs in Vercel or production hosted environments", () => {
    process.env.VERCEL = "1";
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5432/buildmarket";

    expect(() => resolveDatabaseUrl()).toThrowError(
      /DATABASE_URL points to loopback host 'localhost' in a hosted environment/,
    );

    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@127.0.0.1:5432/buildmarket";
    expect(() => resolveDatabaseUrl()).toThrowError(
      /DATABASE_URL points to loopback host '127.0.0.1' in a hosted environment/,
    );
  });

  it("allows loopback/localhost URLs in local development", () => {
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL =
      "postgresql://postgres:postgres@localhost:5432/buildmarket";

    expect(resolveDatabaseUrl()).toBe(
      "postgresql://postgres:postgres@localhost:5432/buildmarket",
    );
  });
});
