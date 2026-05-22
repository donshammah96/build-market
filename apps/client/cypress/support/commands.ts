// ***********************************************
// Custom Cypress Commands
// https://on.cypress.io/custom-commands
// ***********************************************

/// <reference types="cypress" />

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Fill the professional onboarding form
       */
      fillProfessionalForm(data: ProfessionalFormData): Chainable<any>;

      /**
       * Select a profession from the combobox
       */
      selectProfession(profession: string): Chainable<void>;

      /**
       * Upload files to a file input
       */
      uploadFiles(
        selector: string,
        files: Array<{ name: string; content: string; mimeType: string }>,
      ): Chainable<void>;

      /**
       * Wait for toast message
       */
      waitForToast(
        message: string,
        type?: "success" | "error",
      ): Chainable<void>;

      /**
       * Mock the onboarding API
       */
      mockOnboardingApi(options?: MockOnboardingOptions): Chainable<void>;

      /**
       * Mock Clerk authentication
       */
      mockClerkAuth(options?: MockClerkOptions): Chainable<void>;

      /**
       * Get form field by label
       */
      getByLabel(label: string): Chainable<JQuery<HTMLElement>>;

      /**
       * Assert form field has error
       */
      hasFieldError(fieldName: string, errorMessage?: string): Chainable<void>;
    }
  }
}

// Types for custom commands
interface ProfessionalFormData {
  profession?: string;
  companyName?: string;
  licenseNumber?: string;
  yearsExperience?: number;
  website?: string;
  bio?: string;
}

interface MockOnboardingOptions {
  shouldFail?: boolean;
  delay?: number;
  uploadResponse?: {
    certificates?: string[];
    idDocuments?: string[];
  };
}

interface MockClerkOptions {
  isSignedIn?: boolean;
  userId?: string;
}

// =============================================================================
// FORM HELPERS
// =============================================================================

Cypress.Commands.add("fillProfessionalForm", (data: ProfessionalFormData) => {
  if (data.profession) {
    cy.selectProfession(data.profession);
  }

  if (data.companyName) {
    cy.get('input[placeholder*="Legal Name"]').clear().type(data.companyName);
  }

  if (data.licenseNumber) {
    cy.get('input[placeholder*="NCA"]').clear().type(data.licenseNumber);
  }

  if (data.yearsExperience !== undefined) {
    cy.get('input[type="number"][placeholder*="5"]')
      .clear()
      .type(data.yearsExperience.toString());
  }

  if (data.website) {
    cy.get('input[type="url"]').clear().type(data.website);
  }

  if (data.bio) {
    cy.get("textarea").clear().type(data.bio);
  }
});

Cypress.Commands.add("selectProfession", (profession: string) => {
  // Click the combobox trigger
  cy.get('[role="combobox"]').click();

  // Wait for the popover to appear and search
  cy.get('[role="listbox"]').should("be.visible");

  // Type to search
  cy.get('input[placeholder*="search"]').type(profession);

  // Select the option
  cy.get('[role="option"]').contains(profession, { matchCase: false }).click();
});

Cypress.Commands.add(
  "uploadFiles",
  (
    selector: string,
    files: Array<{ name: string; content: string; mimeType: string }>,
  ) => {
    const dataTransfer = new DataTransfer();

    files.forEach(({ name, content, mimeType }) => {
      const blob = Cypress.Blob.base64StringToBlob(content, mimeType);
      const file = new File([blob], name, { type: mimeType });
      dataTransfer.items.add(file);
    });

    cy.get(selector).then((input) => {
      const inputEl = input[0] as HTMLInputElement;
      inputEl.files = dataTransfer.files;
      cy.wrap(input).trigger("change", { force: true });
    });
  },
);

Cypress.Commands.add(
  "waitForToast",
  (message: string, type?: "success" | "error") => {
    const toastSelector = type
      ? `[data-sonner-toast][data-type="${type}"]`
      : "[data-sonner-toast]";

    cy.get(toastSelector, { timeout: 10000 })
      .should("be.visible")
      .and("contain.text", message);
  },
);

Cypress.Commands.add("getByLabel", (label: string) => {
  return cy
    .contains("label", label, { matchCase: false })
    .parent()
    .find("input, textarea, select, [role='combobox']");
});

Cypress.Commands.add(
  "hasFieldError",
  (fieldName: string, errorMessage?: string) => {
    cy.contains("label", fieldName, { matchCase: false })
      .parent()
      .find(".text-red-400")
      .should("exist")
      .and(errorMessage ? "contain.text" : "be.visible", errorMessage);
  },
);

// =============================================================================
// API MOCKING
// =============================================================================

Cypress.Commands.add(
  "mockOnboardingApi",
  (options: MockOnboardingOptions = {}) => {
    const { shouldFail = false, delay = 100, uploadResponse } = options;

    // Mock file upload endpoint
    cy.intercept("POST", "**/api/onboarding/uploads", (req) => {
      if (shouldFail) {
        req.reply({
          statusCode: 500,
          body: { error: "Upload failed" },
          delay,
        });
      } else {
        req.reply({
          statusCode: 200,
          body: {
            uploaded: uploadResponse || {
              certificates: [
                { url: "https://example.com/cert1.pdf" },
                { url: "https://example.com/cert2.pdf" },
              ],
              idDocuments: [{ url: "https://example.com/id1.pdf" }],
            },
          },
          delay,
        });
      }
    }).as("uploadFiles");

    // Mock onboarding submission endpoint
    cy.intercept("POST", "**/api/onboarding", (req) => {
      if (shouldFail) {
        req.reply({
          statusCode: 400,
          body: { error: "Submission failed" },
          delay,
        });
      } else {
        req.reply({
          statusCode: 200,
          body: { success: true, message: "Application received" },
          delay,
        });
      }
    }).as("submitOnboarding");
  },
);

Cypress.Commands.add("mockClerkAuth", (options: MockClerkOptions = {}) => {
  const { isSignedIn = true, userId = "user_test123" } = options;

  const sessionId = "sess_test123";
  const clientResponse = isSignedIn
    ? {
        response: {
          client: {
            id: "client_test123",
            sessions: [
              {
                id: sessionId,
                status: "active",
                user: { id: userId },
              },
            ],
            active_sessions: [
              {
                id: sessionId,
                status: "active",
                user: { id: userId },
              },
            ],
            last_active_session_id: sessionId,
          },
        },
      }
    : {
        response: {
          client: {
            id: "client_test123",
            sessions: [],
            active_sessions: [],
            last_active_session_id: null,
          },
        },
      };

  // Intercept Clerk API calls
  cy.intercept("POST", "**/v1/dev_browser*", {
    statusCode: 200,
    body: { response: { id: "dev_browser_test" } },
  });

  cy.intercept("GET", "**/v1/environment*", {
    statusCode: 200,
    body: { response: { auth_config: {}, display_config: {} } },
  });

  cy.intercept("GET", "**/v1/client*", {
    statusCode: 200,
    body: clientResponse,
  });
});

export {};
