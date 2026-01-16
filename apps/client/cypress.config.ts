import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3500",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 30000,
    retries: {
      runMode: 2,
      openMode: 0,
    },
    env: {
      // Test environment variables
      API_URL: "http://localhost:3500/api",
    },
    setupNodeEvents(
      on: Cypress.PluginEvents,
      config: Cypress.PluginConfigOptions
    ) {
      // Implement node event listeners here
      on("task", {
        log(message: string) {
          console.log(message);
          return null;
        },
      });
      return config;
    },
  },
  component: {
    devServer: {
      framework: "next",
      bundler: "webpack",
    },
    supportFile: "cypress/support/component.ts",
    specPattern: "cypress/component/**/*.cy.{js,jsx,ts,tsx}",
  },
});
