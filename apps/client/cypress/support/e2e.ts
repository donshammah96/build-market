// ***********************************************************
// This file runs before every E2E test file.
// It's a great place to put global configuration and behavior.
// https://on.cypress.io/configuration
// ***********************************************************

import "./commands";

// Prevent uncaught exceptions from failing tests
Cypress.on("uncaught:exception", (err) => {
  // Returning false prevents Cypress from failing the test
  // Ignore hydration errors and Next.js specific errors
  if (
    err.message.includes("Hydration") ||
    err.message.includes("NEXT_NOT_FOUND") ||
    err.message.includes("ResizeObserver")
  ) {
    return false;
  }
  return true;
});

// Log test name before each test
beforeEach(() => {
  cy.task("log", `Running: ${Cypress.currentTest.title}`);
});

// Clear cookies and local storage between tests
beforeEach(() => {
  cy.clearCookies();
  cy.clearLocalStorage();
});
