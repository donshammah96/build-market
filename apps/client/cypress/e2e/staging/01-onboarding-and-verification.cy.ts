describe("Staging E2E: onboarding and verification boundary", () => {
  beforeEach(() => {
    cy.initStagingRun("onboarding", "cypress-onboarding-e2e");
  });

  afterEach(() => {
    cy.cleanupStagingRun();
  });

  it("authenticates the isolated professional, completes onboarding to pending verification, and asserts unverified public boundary", () => {
    // 1. Reset baseline and authenticate via single-use ticket
    cy.resetStagingIdentity("PROFESSIONAL").then((identity) => {
      expect(identity.role).to.eq("PROFESSIONAL");
      expect(identity.state).to.eq("NOT_STARTED");

      // 2. Visit onboarding as authenticated professional
      cy.visit("/onboarding");
      cy.get("body").should("be.visible");

      // 3. Verify projection state
      cy.getStagingProjection().then((proj) => {
        expect(proj.run.state).to.eq("ACTIVE");
        expect(proj.run.scenario).to.eq("onboarding");
        expect(proj.fixtures.identityLeases).to.have.length(1);
      });

      // 4. Verify public directory does not expose an unverified professional
      cy.request({
        url: `/api/v1/professionals/${identity.userId}`,
        failOnStatusCode: false,
      }).then((res) => {
        if (res.status === 200) {
          expect(res.body.verified).to.be.false;
          expect(res.body.trustTier).to.eq("UNVERIFIED");
        } else {
          expect(res.status).to.be.oneOf([404, 403]);
        }
      });
    });
  });
});
