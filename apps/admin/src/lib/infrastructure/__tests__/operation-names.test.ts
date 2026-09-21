import { describe, it, expect } from "vitest";
import {
  AdminOperationName,
  isRegisteredOperationName,
  type AdminOperationName as AdminOperationNameType,
} from "../operation-names";

// ---------------------------------------------------------------------------
// Registry shape
// ---------------------------------------------------------------------------

describe("AdminOperationName registry", () => {
  it("exports a non-empty const object", () => {
    expect(Object.keys(AdminOperationName).length).toBeGreaterThan(0);
  });

  it("all values are lower_snake_case strings", () => {
    for (const [key, value] of Object.entries(AdminOperationName)) {
      expect(typeof value).toBe("string");
      expect(value).toMatch(/^[a-z][a-z0-9_]*$/);
      // No capital letters in values
      expect(value).toBe(value.toLowerCase());
      void key; // suppress unused warning
    }
  });

  it("all values are unique (no duplicate operation names)", () => {
    const values = Object.values(AdminOperationName);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("all values follow <verb>_<resource> format (contain at least one underscore)", () => {
    for (const value of Object.values(AdminOperationName)) {
      expect(value).toContain("_");
    }
  });

  // ---- Required domain coverage -------------------------------------------

  it("covers required user operations", () => {
    expect(AdminOperationName.DELETE_USER).toBe("delete_user");
    expect(AdminOperationName.BULK_DELETE_USERS).toBe("bulk_delete_users");
    expect(AdminOperationName.INVITE_USER).toBe("invite_user");
    expect(AdminOperationName.RESET_CREDENTIALS).toBe("reset_credentials");
    expect(AdminOperationName.ASSIGN_ROLE).toBe("assign_role");
  });

  it("covers required verification operations", () => {
    expect(AdminOperationName.VERIFY_ENTITY).toBe("verify_entity");
    expect(AdminOperationName.VERIFY_DOCUMENT).toBe("verify_document");
    expect(AdminOperationName.BATCH_VERIFY_DOCUMENTS).toBe(
      "batch_verify_documents",
    );
    expect(AdminOperationName.BATCH_VERIFY_ENTITIES).toBe(
      "batch_verify_entities",
    );
  });

  it("covers required audit operations", () => {
    expect(AdminOperationName.QUERY_AUDIT_LOG).toBe("query_audit_log");
    expect(AdminOperationName.GET_AUDIT_STATS).toBe("get_audit_stats");
    expect(AdminOperationName.EXPORT_AUDIT_LOG).toBe("export_audit_log");
  });

  it("covers required finance operations", () => {
    expect(AdminOperationName.GET_FINANCE_OVERVIEW).toBe(
      "get_finance_overview",
    );
  });

  // ---- Type assignability -------------------------------------------------

  it("all values are assignable to AdminOperationNameType", () => {
    // Compile-time check via assignment — if this compiles, the type is correct
    const sample: AdminOperationNameType = AdminOperationName.DELETE_USER;
    expect(sample).toBe("delete_user");
  });
});

// ---------------------------------------------------------------------------
// isRegisteredOperationName
// ---------------------------------------------------------------------------

describe("isRegisteredOperationName", () => {
  it("returns true for every registered value", () => {
    for (const value of Object.values(AdminOperationName)) {
      expect(isRegisteredOperationName(value)).toBe(true);
    }
  });

  it("returns false for an unregistered string", () => {
    expect(isRegisteredOperationName("not_a_real_op")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isRegisteredOperationName("")).toBe(false);
  });

  it("returns false for a partial match (prefix of a real name)", () => {
    // "delete" is not registered, "delete_user" is
    expect(isRegisteredOperationName("delete")).toBe(false);
  });

  it("is case-sensitive — upper-case variant is not registered", () => {
    expect(isRegisteredOperationName("DELETE_USER")).toBe(false);
  });
});
