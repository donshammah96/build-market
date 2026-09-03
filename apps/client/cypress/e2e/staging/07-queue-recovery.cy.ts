describe("Staging E2E: bounded queue recovery", () => {
  beforeEach(() => cy.initStagingRun("queue-recovery", "cypress-queue-recovery-e2e"));
  afterEach(() => cy.cleanupStagingRun());

  it("injects one transient worker failure then records exactly one sink delivery", () => {
    cy.seedStagingScenario("queue-recovery").then(({ queueJobId }) => {
      expect(queueJobId).to.be.a("string");
      cy.getStagingProjection().should((projection) => {
        expect(projection.fixtures.outboundDeliveries).to.have.length(1);
        expect(projection.fixtures.outboundDeliveries[0].channel).to.eq("EMAIL");
      });
    });
  });
});
