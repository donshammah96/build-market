import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/internal/test-control/route";
import { testControlService } from "@/app/lib/domains/testing/test-control/service";
import { ok } from "@/app/lib/errors/result";
import { signStagingGrant } from "@/app/lib/domains/testing/test-control/contracts";

// Mock internal secret validation
vi.mock("@/app/lib/security/internal-secret", () => ({
  ensureValidInternalSecret: vi.fn((secret: string | null) => {
    if (secret === "valid-internal-secret") return null;
    return { error: "INVALID_SECRET", status: 401 };
  }),
  timingSafeEqualStrings: vi.fn((a: string, b: string) => a === b),
}));

describe("POST /api/internal/test-control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when x-internal-secret is invalid or missing", async () => {
    const req = new NextRequest(
      "http://localhost:3500/api/internal/test-control",
      {
        method: "POST",
        headers: {
          "x-internal-secret": "wrong-secret",
        },
        body: JSON.stringify({
          action: "create-run",
          scenario: "onboarding",
          actorLabel: "test",
        }),
      },
    );

    const response = await POST(req);
    expect(response.status).toBe(404);
  });

  it("creates a staging run and issues grant on valid create-run action", async () => {
    vi.spyOn(testControlService, "createRun").mockResolvedValue(
      ok({ runId: "test-run-123", grantToken: "signed-grant-token" }) as any,
    );

    const req = new NextRequest(
      "http://localhost:3500/api/internal/test-control",
      {
        method: "POST",
        headers: {
          "x-internal-secret": "valid-internal-secret",
        },
        body: JSON.stringify({
          action: "create-run",
          scenario: "onboarding",
          actorLabel: "cypress-runner",
        }),
      },
    );

    const response = await POST(req);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.runId).toBe("test-run-123");
    expect(body.grantToken).toBe("signed-grant-token");
  });

  it("returns 404 for protected action if grant token is missing or invalid", async () => {
    const req = new NextRequest(
      "http://localhost:3500/api/internal/test-control",
      {
        method: "POST",
        headers: {
          "x-internal-secret": "valid-internal-secret",
        },
        body: JSON.stringify({
          action: "issue-session-handoff",
          runId: "run-123",
          role: "PROFESSIONAL",
        }),
      },
    );

    const response = await POST(req);
    expect(response.status).toBe(404);
  });

  it("processes protected action when valid grant token is provided", async () => {
    const grant = signStagingGrant(
      {
        runId: "run-123",
        scenario: "onboarding",
        actions: ["issue-session-handoff", "cleanup-run"],
      },
      "staging-control-secret",
      300,
    );

    vi.spyOn(
      testControlService,
      "issueBrowserSessionHandoff",
    ).mockResolvedValue(
      ok({
        userId: "user_pro_1",
        email: "e2e_pro_1@staging.buildmarket.app",
        ticket: "valid_ticket",
        signInUrl:
          "https://staging.clerk.accounts.dev/sign-in?ticket=valid_ticket",
      }) as any,
    );

    const req = new NextRequest(
      "http://localhost:3500/api/internal/test-control",
      {
        method: "POST",
        headers: {
          "x-internal-secret": "valid-internal-secret",
          "x-test-control-grant": grant,
        },
        body: JSON.stringify({
          action: "issue-session-handoff",
          runId: "run-123",
          role: "PROFESSIONAL",
        }),
      },
    );

    const response = await POST(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ticket).toBe("valid_ticket");
  });

  it("creates actual scenario fixtures through the protected seed action", async () => {
    const grant = signStagingGrant(
      {
        runId: "run-123",
        scenario: "lead-routing",
        actions: ["seed-scenario"],
      },
      "staging-control-secret",
      300,
    );
    vi.spyOn(testControlService, "seedScenario").mockResolvedValue(
      ok({ marketplaceLeadId: "lead_1", routingEventId: "route_1" }) as any,
    );

    const req = new NextRequest(
      "http://localhost:3500/api/internal/test-control",
      {
        method: "POST",
        headers: {
          "x-internal-secret": "valid-internal-secret",
          "x-test-control-grant": grant,
        },
        body: JSON.stringify({
          action: "seed-scenario",
          runId: "run-123",
          scenario: "lead-routing",
          payload: {},
        }),
      },
    );

    const response = await POST(req);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      marketplaceLeadId: "lead_1",
      routingEventId: "route_1",
    });
  });

  it("dispatches reset-identity-baseline with grant verification for onboarding scenario", async () => {
    const grant = signStagingGrant(
      {
        runId: "run-123",
        scenario: "onboarding",
        actions: ["reset-identity-baseline" as any],
      },
      "staging-control-secret",
      300,
    );

    vi.spyOn(testControlService, "resetIdentityBaseline").mockResolvedValue(
      ok({
        leaseId: "lease-1",
        slot: "pro-1",
        userId: "user_pro_1",
        role: "PROFESSIONAL",
        ticket: "ticket_reset_123",
        signInUrl:
          "https://staging.clerk.accounts.dev/sign-in?ticket=ticket_reset_123",
      }) as any,
    );

    const req = new NextRequest(
      "http://localhost:3500/api/internal/test-control",
      {
        method: "POST",
        headers: {
          "x-internal-secret": "valid-internal-secret",
          "x-test-control-grant": grant,
        },
        body: JSON.stringify({
          action: "reset-identity-baseline",
          runId: "run-123",
          role: "PROFESSIONAL",
        }),
      },
    );

    const response = await POST(req);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ticket).toBe("ticket_reset_123");
    expect(body.slot).toBe("pro-1");
  });

  it("rejects reset-identity-baseline if the grant scenario is not onboarding or verification", async () => {
    const grant = signStagingGrant(
      {
        runId: "run-123",
        scenario: "messaging",
        actions: ["reset-identity-baseline" as any],
      },
      "staging-control-secret",
      300,
    );

    const req = new NextRequest(
      "http://localhost:3500/api/internal/test-control",
      {
        method: "POST",
        headers: {
          "x-internal-secret": "valid-internal-secret",
          "x-test-control-grant": grant,
        },
        body: JSON.stringify({
          action: "reset-identity-baseline",
          runId: "run-123",
          role: "PROFESSIONAL",
        }),
      },
    );

    const response = await POST(req);
    expect(response.status).toBe(404);
  });
});
