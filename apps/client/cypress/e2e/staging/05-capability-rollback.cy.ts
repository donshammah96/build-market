describe("Staging E2E: capability rollback", () => {
  beforeEach(() => {
    cy.initStagingRun("capability-rollback", "cypress-capability-rollback-e2e");
  });

  afterEach(() => {
    cy.cleanupStagingRun();
  });

  it("keeps deferred materials commerce unavailable at both page and API boundaries", () => {
    cy.request({ url: "/stores", failOnStatusCode: false })
      .its("status")
      .should("eq", 404);
    cy.request({ url: "/api/stores", failOnStatusCode: false })
      .its("status")
      .should("eq", 404);
    cy.getStagingProjection()
      .its("run.scenario")
      .should("eq", "capability-rollback");
  });
});
