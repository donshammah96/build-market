// ***********************************************************
// This file runs before every component test.
// Configure component testing settings here.
// ***********************************************************

import "./commands";

// Import global styles for component tests
import "../../app/globals.css";

// Mount command for React components
import { mount } from "cypress/react";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add("mount", mount);
