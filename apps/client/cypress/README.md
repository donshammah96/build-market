# Cypress E2E Tests

End-to-end tests for the Build Market client application.

## Setup

1. Install dependencies from the monorepo root:

   ```bash
   pnpm install
   ```

2. Make sure the development server can start:

   ```bash
   pnpm --filter client dev
   ```

## Running Tests

### Interactive Mode (Recommended for Development)

Opens the Cypress Test Runner UI:

```bash
pnpm --filter client cy:open
```

Or with the dev server auto-started:

```bash
pnpm --filter client test:e2e:open
```

### Headless Mode (CI/CD)

Runs all tests in headless mode:

```bash
pnpm --filter client test:e2e
```

### Browser-Specific

```bash
# Chrome
pnpm --filter client cy:run:chrome

# Firefox
pnpm --filter client cy:run:firefox

# Headed mode (see the browser)
pnpm --filter client cy:run:headed
```

## Test Structure

```

cypress/
├── e2e/                          # E2E test specs
│   └── professional-onboarding.cy.ts
├── fixtures/                     # Test data
│   └── professional-form.json
├── support/
│   ├── commands.ts              # Custom Cypress commands
│   ├── component.ts             # Component test setup
│   └── e2e.ts                   # E2E test setup
├── tsconfig.json                # TypeScript config for Cypress
└── README.md                    # This file
```

## Custom Commands

### Form Helpers

```typescript
// Fill the professional form
cy.fillProfessionalForm({
  profession: "Architect",
  companyName: "Test Company",
  licenseNumber: "NCA/1234",
});

// Select profession from combobox
cy.selectProfession("Interior Designer");

// Upload files
cy.uploadFiles('input[type="file"]', [
  { name: "cert.pdf", content: base64Content, mimeType: "application/pdf" },
]);

// Get form field by label
cy.getByLabel("Company Name").type("Test");

// Assert field has error
cy.hasFieldError("Company Name", "required");
```

### API Mocking

```typescript
// Mock onboarding API (success)
cy.mockOnboardingApi();

// Mock onboarding API (failure)
cy.mockOnboardingApi({ shouldFail: true });

// Mock with custom upload response
cy.mockOnboardingApi({
  uploadResponse: {
    certificates: ["https://example.com/cert.pdf"],
  },
});
```

### Toast Assertions

```typescript
// Wait for any toast
cy.waitForToast("Application received");

// Wait for specific toast type
cy.waitForToast("Failed", "error");
cy.waitForToast("Success", "success");
```

## Test Coverage

### Professional Onboarding Form

| Category             | Tests   |
| -------------------- | ------- |
| Form Rendering       | 3 tests |
| Profession Selection | 4 tests |
| Form Validation      | 5 tests |
| File Uploads         | 7 tests |
| Store Integration    | 5 tests |
| Form Submission      | 8 tests |
| Navigation           | 2 tests |
| Accessibility        | 4 tests |
| Responsive Design    | 2 tests |

## Writing New Tests

### Best Practices

1. **Use custom commands** for repetitive actions
2. **Mock API calls** with `cy.intercept()` or custom commands
3. **Use fixtures** for test data
4. **Add proper waits** using `cy.wait('@alias')` for API calls
5. **Test accessibility** - focus management, ARIA labels
6. **Test responsive** - use `cy.viewport()` for different sizes

### Example Test

```typescript
describe("My Feature", () => {
  beforeEach(() => {
    cy.mockOnboardingApi();
    cy.visit("/my-page");
  });

  it("should do something", () => {
    // Arrange
    cy.fixture("my-data").then((data) => {
      cy.fillForm(data);
    });

    // Act
    cy.contains("button", "Submit").click();

    // Assert
    cy.wait("@submitOnboarding");
    cy.contains("Success").should("be.visible");
  });
});
```

## Troubleshooting

### Tests failing intermittently

- Increase `defaultCommandTimeout` in `cypress.config.ts`
- Add explicit waits for async operations
- Check for race conditions with API mocks

### Cannot find elements

- Use `cy.debug()` or `cy.pause()` to inspect the DOM
- Check if elements are inside iframes or shadow DOM
- Verify selectors with `cy.get().should('exist')`

### Authentication issues

- The tests mock Clerk authentication
- For real auth testing, set up Clerk test mode
- See `commands.ts` for `mockClerkAuth` implementation

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Cypress tests
  uses: cypress-io/github-action@v6
  with:
    working-directory: apps/client
    start: pnpm dev
    wait-on: "http://localhost:3500"
    browser: chrome
    record: true
  env:
    CYPRESS_RECORD_KEY: ${{ secrets.CYPRESS_RECORD_KEY }}
```
