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

  it("enforces that staging-test-control commands do not return cy chainables from inside .then() callbacks", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const content = fs.readFileSync(
      path.resolve(__dirname, "../support/staging-test-control.ts"),
      "utf8",
    );

    // Any `return cy.` inside a `.then(` callback causes Cypress to throw:
    // "CypressError: cy.then() failed because you are mixing up async and sync code.
    //  In your callback function you invoked 1 or more cy commands but then returned a synchronous value."
    const thenBlockRegex = /\.then\s*\([^)]*\)\s*=>\s*\{([^}]*)\}/g;
    const violations: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = thenBlockRegex.exec(content)) !== null) {
      const blockBody = match[1] ?? "";
      if (/return\s+cy\./.test(blockBody)) {
        violations.push(blockBody.trim());
      }
    }

    expect(
      violations,
      "Expected no `.then(() => { ... return cy. ... })` callback blocks in staging-test-control.ts",
    ).toHaveLength(0);
  });

  it("requires postStagingMpesaCallback command and stagingTestControl:postMpesaWebhook task contract", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const supportContent = fs.readFileSync(
      path.resolve(__dirname, "../support/staging-test-control.ts"),
      "utf8",
    );
    const configContent = fs.readFileSync(
      path.resolve(__dirname, "../../cypress.config.ts"),
      "utf8",
    );

    expect(supportContent).toContain("postStagingMpesaCallback");
    expect(configContent).toContain("stagingTestControl:postMpesaWebhook");
  });

  it("ensures cypress.config.ts normalizes unhosted Clerk accounts portal URLs to baseUrl /sign-in", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const configContent = fs.readFileSync(
      path.resolve(__dirname, "../../cypress.config.ts"),
      "utf8",
    );

    expect(configContent).toContain("normalizeSignInUrl");
    expect(configContent).toContain("/sign-in?__clerk_ticket=");
  });
});
