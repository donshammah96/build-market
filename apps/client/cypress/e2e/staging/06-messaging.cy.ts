describe("Staging E2E: eligible participant messaging", () => {
  beforeEach(() => cy.initStagingRun("messaging", "cypress-messaging-e2e"));
  afterEach(() => cy.cleanupStagingRun());

  it("delivers a message only through the seeded participant thread", () => {
    cy.seedStagingScenario("messaging").then(({ threadId }) => {
      cy.loginStagingUser("CLIENT");
      const content = `staging-message-${threadId}`;
      cy.request({
        method: "POST",
        url: "/api/messaging/messages",
        body: { threadId, content },
      })
        .its("status")
        .should("eq", 201);
      cy.loginStagingUser("PROFESSIONAL");
      cy.request(`/api/messaging/messages/conversation/${threadId}`).then(
        (response) => {
          expect(JSON.stringify(response.body)).to.contain(content);
        },
      );
      cy.getStagingProjection()
        .its("fixtures.messageThreads.0.messages")
        .should("have.length", 1);
    });
  });
});
