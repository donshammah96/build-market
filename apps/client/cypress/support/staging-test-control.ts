/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Initializes a durable staging test run and authenticates staging edge proxy.
       */
      initStagingRun(
        scenario: string,
        actorLabel?: string,
      ): Chainable<{ runId: string; grantToken: string }>;

      /**
       * Mints a Clerk single-use testing ticket and visits the staging sign-in URL,
       * allowing Clerk to set native __session cookies.
       */
      loginStagingUser(
        role: "CLIENT" | "PROFESSIONAL",
      ): Chainable<{ userId: string; email: string }>;

      /**
       * Leases a dedicated identity, resets its Clerk metadata and database records
       * to the baseline, and establishes an active browser session via a single-use ticket.
       * Only opaque fields cross the task boundary.
       */
      resetStagingIdentity(role: "CLIENT" | "PROFESSIONAL"): Chainable<{
        leaseId: string;
        slot: string;
        userId: string;
        role: "CLIENT" | "PROFESSIONAL";
        state: string;
      }>;

      /**
       * Seeds a pending M-Pesa transaction owned by the current staging test run.
       */
      seedStagingMpesa(params: {
        amount: number;
        phoneNumber: string;
        checkoutRequestId?: string;
        merchantRequestId?: string;
      }): Chainable<{
        transactionId: string;
        checkoutRequestId: string;
        merchantRequestId: string;
      }>;

      /** Creates a run-owned cross-service fixture and returns opaque IDs only. */
      seedStagingScenario(
        scenario: string,
        payload?: Record<string, unknown>,
      ): Chainable<Record<string, string>>;

      /**
       * Retrieves the current entity projection for the active staging test run.
       */
      getStagingProjection(): Chainable<any>;

      /**
       * Triggers clean dependency-ordered deletion of all fixtures owned by the staging run.
       */
      cleanupStagingRun(): Chainable<{ cleaned: true }>;
    }
  }
}

Cypress.Commands.add(
  "initStagingRun",
  (scenario: string, actorLabel = "cypress-e2e") => {
    // Set staging protection bypass cookie if configured
    cy.task("stagingTestControl:getStagingAuthCookie").then((cookie: any) => {
      if (cookie?.name && cookie?.value) {
        cy.setCookie(cookie.name, cookie.value);
      }
    });

    return cy
      .task("stagingTestControl:createRun", { scenario, actorLabel })
      .then((res: any) => {
        if (!res || !res.runId) {
          throw new Error(
            "Failed to initialize staging test run via node task",
          );
        }
        return res;
      });
  },
);

Cypress.Commands.add("loginStagingUser", (role: "CLIENT" | "PROFESSIONAL") => {
  return cy
    .task("stagingTestControl:issueSession", { role })
    .then((res: any) => {
      if (!res || !res.signInUrl) {
        throw new Error(`Failed to mint Clerk session for role ${role}`);
      }

      // Visit the Clerk ticket URL to set official session cookies
      cy.visit(res.signInUrl);
      // Allow Clerk authentication redirection to settle
      cy.location("pathname", { timeout: 15000 }).should(
        "not.include",
        "/sign-in",
      );

      return res;
    });
});

Cypress.Commands.add(
  "resetStagingIdentity",
  (role: "CLIENT" | "PROFESSIONAL") => {
    return cy
      .task("stagingTestControl:resetIdentityBaseline", { role })
      .then((res: any) => {
        if (!res || !res.signInUrl) {
          throw new Error(
            `Failed to reset staging identity baseline for role ${role}`,
          );
        }

        // Visit the Clerk ticket URL to establish session cookies
        cy.visit(res.signInUrl);
        // Allow Clerk authentication redirection to settle
        cy.location("pathname", { timeout: 15000 }).should(
          "not.include",
          "/sign-in",
        );

        return {
          leaseId: res.leaseId,
          slot: res.slot,
          userId: res.userId,
          role: res.role,
          state: res.state,
        };
      });
  },
);

Cypress.Commands.add("seedStagingMpesa", (params) => {
  return cy.task("stagingTestControl:seedMpesa", params).then((res: any) => {
    if (!res || !res.checkoutRequestId) {
      throw new Error("Failed to seed pending M-Pesa transaction");
    }
    return res;
  });
});

Cypress.Commands.add("seedStagingScenario", (scenario, payload = {}) => {
  return cy
    .task("stagingTestControl:seedScenario", { scenario, payload })
    .then((res: any) => {
      if (!res || typeof res !== "object") {
        throw new Error(`Failed to seed staging scenario ${scenario}`);
      }
      return res;
    });
});

Cypress.Commands.add("getStagingProjection", () => {
  return cy.task("stagingTestControl:getProjection").then((res: any) => {
    return res;
  });
});

Cypress.Commands.add("cleanupStagingRun", () => {
  return cy.task("stagingTestControl:cleanup").then((res: any) => {
    return res;
  });
});

export {};
