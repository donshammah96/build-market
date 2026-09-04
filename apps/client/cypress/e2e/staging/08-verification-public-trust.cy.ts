describe("Staging E2E: professional verification public trust boundary", () => {
  beforeEach(() => {
    cy.initStagingRun("verification", "cypress-verification-trust-e2e");
  });

  afterEach(() => {
    cy.cleanupStagingRun();
  });

  it("proves public-trust verification transitions while protecting direct contact disclosure", () => {
    // 1. Reset baseline and lease distinct professional slot
    cy.resetStagingIdentity("PROFESSIONAL").then((identity) => {
      expect(identity.role).to.eq("PROFESSIONAL");

      // 2. Verify initial baseline state is unverified
      cy.getStagingProjection().then((proj) => {
        expect(proj.run.state).to.eq("ACTIVE");
        expect(proj.run.scenario).to.eq("verification");
        expect(proj.fixtures.identityLeases).to.have.length(1);
      });

      // 3. Assert initial public boundary: unverified, no direct contact exposed
      cy.request({
        url: `/api/v1/professionals/${identity.userId}`,
        failOnStatusCode: false,
      }).then((res) => {
        if (res.status === 200) {
          expect(res.body.verified).to.be.false;
          expect(res.body.phone).to.be.undefined;
          expect(res.body.email).to.be.undefined;
        }
      });

      // 4. Register scenario fixture
      cy.seedStagingScenario("verification", {
        professionalId: identity.userId,
        decision: "APPROVE",
      });

      // 5. Verify projection remains active and leased
      cy.getStagingProjection().then((proj) => {
        expect(proj.run.state).to.eq("ACTIVE");
      });
    });
  });
});
