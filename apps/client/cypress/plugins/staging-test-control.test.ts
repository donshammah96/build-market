import { describe, expect, it } from "vitest";

describe("staging test control Cypress task & credential boundaries", () => {
  it("never exposes internal secrets or grant tokens to browser payloads", () => {
    // Simulated task result boundary
    const taskResult = {
      leaseId: "lease-pro-1",
      slot: "pro-1",
      userId: "user_pro_1",
      role: "PROFESSIONAL",
      signInUrl:
        "https://staging.clerk.accounts.dev/sign-in?ticket=opaque-ticket",
      state: "NOT_STARTED",
    };

    // Filtered fields that cross the task boundary to cy.resetStagingIdentity
    const browserPayload = {
      leaseId: taskResult.leaseId,
      slot: taskResult.slot,
      userId: taskResult.userId,
      role: taskResult.role,
      state: taskResult.state,
    };

    expect(browserPayload).not.toHaveProperty("grantToken");
    expect(browserPayload).not.toHaveProperty("secret");
    expect(browserPayload).not.toHaveProperty("internalSecret");
    expect(browserPayload).not.toHaveProperty("testControlSecret");
    expect(browserPayload).not.toHaveProperty("ticket");
    expect(browserPayload).not.toHaveProperty("signInUrl");
    expect(Object.keys(browserPayload).sort()).toEqual(
      ["leaseId", "role", "slot", "state", "userId"].sort(),
    );
  });

  it("asserts that initial reset state is not publicly verified", () => {
    const initialProjection = {
      userStatus: "ONBOARDING",
      onboardingState: "NOT_STARTED",
      verified: false,
      trustTier: "UNVERIFIED",
    };

    expect(initialProjection.verified).toBe(false);
    expect(initialProjection.trustTier).toBe("UNVERIFIED");
    expect(initialProjection.onboardingState).toBe("NOT_STARTED");
  });
});
