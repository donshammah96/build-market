describe("Staging E2E: routed lead contact disclosure", () => {
  beforeEach(() => {
    cy.initStagingRun("lead-routing", "cypress-routing-e2e");
  });

  afterEach(() => {
    cy.cleanupStagingRun();
  });

  it("keeps a routed lead masked until the professional accepts it", () => {
    cy.seedStagingScenario("lead-routing").then(({ routingEventId }) => {
      cy.loginStagingUser("PROFESSIONAL");

      cy.request("/api/leads/qualification/routing").then((response) => {
        expect(response.status).to.eq(200);
        // The professional inbox may identify the lead but must not disclose
        // the staging client's email/phone before the explicit accept action.
        expect(JSON.stringify(response.body)).not.to.contain(
          "e2e_client_1@staging.buildmarket.app",
        );
      });

      cy.request({
        method: "POST",
        url: `/api/leads/qualification/routing/${routingEventId}/accept`,
        headers: { "Idempotency-Key": `staging-accept-${routingEventId}` },
      })
        .its("status")
        .should("eq", 200);

      cy.getStagingProjection().then((projection) => {
        const fixture = projection.fixtures.marketplaceLeads[0];
        expect(fixture.id).to.be.a("string");
        expect(fixture.routingEvents[0].contactDisclosedAt).to.be.a("string");
      });
    });
  });
});
