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

      /**
       * Dispatches an M-Pesa STK callback via authenticated node task,
       * preserving secret boundary and mirroring asynchronous provider delivery.
       */
      postStagingMpesaCallback(payload: Record<string, unknown>): Chainable<{
        status: number;
        body: any;
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
       * Polls the staging entity projection until the predicate succeeds or timeout is reached.
       * Essential for observing asynchronous background workers (e.g. BullMQ retries, webhooks).
       */
      pollStagingProjection(
        predicate: (projection: any) => boolean | void,
        options?: { timeoutMs?: number; intervalMs?: number },
      ): Chainable<any>;

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
  let sessionResult: { userId: string; email: string };

  return cy
    .task("stagingTestControl:issueSession", { role })
    .then((res: any) => {
      if (!res || !res.signInUrl) {
        throw new Error(`Failed to mint Clerk session for role ${role}`);
      }
      sessionResult = res;

      // Visit the Clerk ticket URL to set official session cookies and settle
      cy.visit(res.signInUrl);
      cy.location("pathname", { timeout: 15000 }).should((pathname) => {
        expect(pathname).not.to.include("/sign-in");
        expect(pathname).not.to.include("/auth-callback");
      });
      cy.getCookies().should((cookies) => {
        expect(cookies.some((c) => c.name.startsWith("__session"))).to.be.true;
      });
    })
    .then(() => {
      return sessionResult;
    });
});

Cypress.Commands.add(
  "resetStagingIdentity",
  (role: "CLIENT" | "PROFESSIONAL") => {
    let identityResult: {
      leaseId: string;
      slot: string;
      userId: string;
      role: "CLIENT" | "PROFESSIONAL";
      state: string;
    };

    return cy
      .task("stagingTestControl:resetIdentityBaseline", { role })
      .then((res: any) => {
        if (!res || !res.signInUrl) {
          throw new Error(
            `Failed to reset staging identity baseline for role ${role}`,
          );
        }
        identityResult = {
          leaseId: res.leaseId,
          slot: res.slot,
          userId: res.userId,
          role: res.role,
          state: res.state,
        };

        // Visit the Clerk ticket URL to establish session cookies and settle
        cy.visit(res.signInUrl);
        cy.location("pathname", { timeout: 15000 }).should((pathname) => {
          expect(pathname).not.to.include("/sign-in");
          expect(pathname).not.to.include("/auth-callback");
        });
        cy.getCookies().should((cookies) => {
          expect(cookies.some((c) => c.name.startsWith("__session"))).to.be
            .true;
        });
      })
      .then(() => {
        return identityResult;
      });
  },
);

Cypress.Commands.add(
  "postStagingMpesaCallback",
  (payload: Record<string, unknown>) => {
    return cy
      .task<{ status: number; body: any }>(
        "stagingTestControl:postMpesaWebhook",
        { payload },
      )
      .then((res) => {
        return res;
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

Cypress.Commands.add(
  "pollStagingProjection",
  (
    predicate: (projection: any) => boolean | void,
    options: { timeoutMs?: number; intervalMs?: number } = {},
  ) => {
    const timeoutMs = options.timeoutMs ?? 15000;
    const intervalMs = options.intervalMs ?? 500;
    const startTime = Date.now();

    function poll(): Cypress.Chainable<any> {
      return cy
        .task("stagingTestControl:getProjection")
        .then((projection: any) => {
          let passed = false;
          let lastError: unknown = null;
          try {
            const res = predicate(projection);
            if (res !== false) {
              passed = true;
            }
          } catch (err) {
            lastError = err;
          }

          if (passed) {
            return projection;
          }

          if (Date.now() - startTime >= timeoutMs) {
            if (lastError) throw lastError;
            throw new Error(
              `Timed out after ${timeoutMs}ms waiting for staging projection predicate`,
            );
          }

          cy.wait(intervalMs, { log: false });
          return poll();
        });
    }

    return poll();
  },
);

Cypress.Commands.add("cleanupStagingRun", () => {
  return cy.task("stagingTestControl:cleanup").then((res: any) => {
    return res;
  });
});

export {};
