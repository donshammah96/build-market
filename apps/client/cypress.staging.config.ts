import { defineConfig } from "cypress";
import baseConfig from "./cypress.config";

export default defineConfig({
  ...baseConfig,
  e2e: {
    ...baseConfig.e2e,
    specPattern: "cypress/e2e/staging/**/*.cy.{js,jsx,ts,tsx}",
    redirectionLimit: 5,
    retries: {
      runMode: 1,
      openMode: 0,
    },
    video: true,
  },
});
