describe("staging release capability rollback", () => {
  before(function () {
    if (Cypress.env("STAGING_RELEASE_E2E") !== true) {
      this.skip();
    }

    if (Cypress.config("baseUrl") === "http://localhost:3500") {
      throw new Error("STAGING_E2E_BASE_URL must target the staging deployment");
    }
  });

  it("keeps deferred materials commerce hidden after the rollback switch", () => {
    cy.request({
      url: "/api/stores",
      failOnStatusCode: false,
    })
      .its("status")
      .should("eq", 404);

    cy.request({
      url: "/stores",
      failOnStatusCode: false,
    })
      .its("status")
      .should("eq", 404);
  });
});
