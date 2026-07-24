import { describe, it, expect } from "vitest";
import {
  validateJobPayload,
  QUEUE_REGISTRY,
} from "@/lib/queues/queue-registry";

describe("BullMQ Queue Payload Registry & Guards", () => {
  const validExportData = {
    exportId: "22222222-2222-4222-8222-222222222222",
    userId: "33333333-3333-4333-8333-333333333333",
    ipAddress: "127.0.0.1",
    userAgent: "Mozilla/5.0",
  };

  const validIncidentData = {
    incidentId: "44444444-4444-4444-8444-444444444444",
    type: "EMERGENCY_PROTOCOL",
    severity: "CRITICAL",
    metadata: {
      protectiveMeasures: ["LOCK_USER"],
    },
  };

  it("should validate registered queueNames and jobNames successfully with valid payloads", () => {
    // Test by queueName fallback
    expect(() => {
      validateJobPayload("gdpr-data-export", "process-export", validExportData);
    }).not.toThrow();

    // Test by jobName match
    expect(() => {
      validateJobPayload("maintenance-jobs", "cleanup-expired", {
        triggeredManually: true,
      });
    }).not.toThrow();

    // Test union schemas
    expect(() => {
      validateJobPayload(
        "security-incidents",
        "trigger-emergency",
        validIncidentData,
      );
    }).not.toThrow();
  });

  it("should throw error for unregistered queue and job names", () => {
    expect(() => {
      validateJobPayload("unknown-queue", "unknown-job", {});
    }).toThrow("Neither job unknown-job nor queue unknown-queue is registered");
  });

  it("should fail validation and throw when schema properties are malformed (fail-closed)", () => {
    const invalidExportData = {
      ...validExportData,
      exportId: "not-a-uuid", // Invalid UUID
    };

    expect(() => {
      validateJobPayload(
        "gdpr-data-export",
        "process-export",
        invalidExportData,
      );
    }).toThrow("Payload validation failed for job process-export");

    const invalidIncidentData = {
      ...validIncidentData,
      type: "UNKNOWN_TYPE", // Discriminated union key violation
    };

    expect(() => {
      validateJobPayload(
        "security-incidents",
        "trigger-emergency",
        invalidIncidentData,
      );
    }).toThrow("Payload validation failed for job trigger-emergency");
  });

  it("should verify registry metadata values are correctly structured", () => {
    const registryEntry = QUEUE_REGISTRY["security-incidents"];
    expect(registryEntry).toBeDefined();
    if (!registryEntry) return;
    expect(registryEntry.queueName).toBe("security-incidents");
    expect(registryEntry.maxAttempts).toBe(5);
    expect(registryEntry.onCallOwner).toBe("Compliance Team");
  });
});
