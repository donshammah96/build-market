describe("Staging E2E: project-linked review eligibility", () => {
  beforeEach(() => {
    cy.initStagingRun("review-eligibility", "cypress-reviews-e2e");
  });

  afterEach(() => {
    cy.cleanupStagingRun();
  });

  it("permits one review for the run-owned completed project and rejects replay", () => {
    cy.seedStagingScenario("review-eligibility").then(({ projectId }) => {
      cy.loginStagingUser("CLIENT");
      const body = { projectId, rating: 5, comment: "Completed staging project" };
      cy.request({ method: "POST", url: "/api/reviews", body }).its("status").should("eq", 201);
      cy.request({ method: "POST", url: "/api/reviews", body, failOnStatusCode: false })
        .its("status")
        .should("eq", 403);
      cy.getStagingProjection().its("fixtures.reviews").should("have.length", 1);
    });
  });
});
