describe("Staging E2E: bounded queue recovery", () => {
  beforeEach(function () {
    cy.checkStagingQueueHealth().then((health) => {
      if (!health?.connected) {
        cy.task(
          "log",
          `[SKIP 07-queue-recovery] Queue backend disconnected: ${health?.error || "REDIS_URL unset"}`,
        );
        this.skip();
        return;
      }
      if (!health.consumerSeenAt) {
        cy.task(
          "log",
          "[SKIP 07-queue-recovery] No active queue consumer detected within recovery window; skipping queue recovery verification",
        );
        this.skip();
        return;
      }
    });

    cy.initStagingRun("queue-recovery", "cypress-queue-recovery-e2e");
  });

  afterEach(function () {
    cy.cleanupStagingRun();
  });

  it("injects one transient worker failure then records exactly one sink delivery", () => {
    cy.seedStagingScenario("queue-recovery").then(({ queueJobId }) => {
      expect(queueJobId).to.be.a("string");
      cy.pollStagingProjection(
        (projection) => {
          expect(projection.fixtures.outboundDeliveries).to.have.length(1);
          expect(projection.fixtures.outboundDeliveries[0].channel).to.eq(
            "EMAIL",
          );
        },
        { timeoutMs: 15000, intervalMs: 1000 },
      );
    });
  });
});
