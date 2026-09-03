describe("Staging E2E: onboarding and verification boundary", () => {
  beforeEach(() => {
    cy.initStagingRun("onboarding", "cypress-onboarding-e2e");
  });

  afterEach(() => {
    cy.cleanupStagingRun();
  });

  it("authenticates the isolated professional and never asserts a premature public trust signal", () => {
    cy.loginStagingUser("PROFESSIONAL");

    cy.visit("/onboarding");
    cy.get("body").should("be.visible");
    cy.getStagingProjection().then((proj) => {
      expect(proj.run.state).to.eq("ACTIVE");
      expect(proj.run.scenario).to.eq("onboarding");
      // Identity mutation is intentionally excluded until a resettable,
      // per-run Clerk/DB bootstrap adapter exists. This is a boundary smoke
      // test, not completion evidence.
    });
  });
});
