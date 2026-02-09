// @vitest-environment node
import { describe, it, expect } from "vitest";
import { PrismaClient } from "@build/db";

describe("Database Schema Sanity", () => {
  it("should have expected models on PrismaClient", () => {
    const client = new PrismaClient();
    expect(client).toHaveProperty("user");
    expect(client).toHaveProperty("project");
    expect(client).toHaveProperty("messageThread");
    expect(client).toHaveProperty("message");
    expect(client).toHaveProperty("professionalProfile");
  });
});
