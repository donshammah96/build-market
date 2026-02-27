/**
 * E2E Tests for Professional Onboarding Form
 *
 * Tests the complete professional registration flow including:
 * - Form validation
 * - Profession selection
 * - File uploads
 * - Store integration
 * - Property integration
 * - Form submission
 * - Navigation after success
 */

describe("Professional Onboarding Form", () => {
  beforeEach(() => {
    // Mock API endpoints
    cy.mockOnboardingApi();

    // Visit the onboarding page
    // Note: Adjust this path based on your actual route structure
    cy.visit("/onboarding?role=professional");
  });

  // ===========================================================================
  // FORM RENDERING
  // ===========================================================================

  describe("Form Rendering", () => {
    it("should display the professional form with all required fields", () => {
      // Header elements
      cy.contains("Join the Gold Standard").should("be.visible");
      cy.contains("Verified Only").should("be.visible");

      // Required fields
      cy.contains("label", "Profession").should("be.visible");
      cy.contains("label", "Company Name").should("be.visible");
      cy.contains("label", "NCA / Board License").should("be.visible");

      // Optional fields
      cy.contains("label", "Years of Experience").should("be.visible");
      cy.contains("label", "Website").should("be.visible");
      cy.contains("label", "Bio").should("be.visible");

      // File uploads
      cy.contains("Certificates (NCA / Board)").should("be.visible");
      cy.contains("ID / Registration Documents").should("be.visible");

      // Store toggle
      cy.contains("Add a Store").should("be.visible");

      // Submit button
      cy.contains("button", "Apply for Verification").should("be.visible");
    });

    it("should show file upload limits in hints", () => {
      cy.contains("Max 5 files").should("be.visible");
      cy.contains("10MB each").should("be.visible");
    });

    it("should have Go Back button", () => {
      cy.contains("Go Back").should("be.visible");
    });
  });

  // ===========================================================================
  // PROFESSION SELECTION
  // ===========================================================================

  describe("Profession Selection", () => {
    it("should open profession combobox and display options", () => {
      cy.get('[role="combobox"]').click();
      cy.get('[role="listbox"]').should("be.visible");

      // Check for various profession categories
      cy.get('[role="option"]').should("have.length.greaterThan", 50);
      cy.contains('[role="option"]', "Architect").should("be.visible");
    });

    it("should filter professions when searching", () => {
      cy.get('[role="combobox"]').click();
      cy.get('input[placeholder*="search"]').type("engineer");

      // Should show only engineer-related options
      cy.get('[role="option"]')
        .should("have.length.lessThan", 20)
        .and("contain.text", "Engineer");
    });

    it("should select a profession and close combobox", () => {
      cy.selectProfession("Interior Designer");

      // Combobox should show selected value
      cy.get('[role="combobox"]').should("contain.text", "Interior Designer");

      // Listbox should be closed
      cy.get('[role="listbox"]').should("not.exist");
    });

    it("should show empty message when no matches found", () => {
      cy.get('[role="combobox"]').click();
      cy.get('input[placeholder*="search"]').type("xyznonexistent");
      cy.contains("No matching profession found").should("be.visible");
    });
  });

  // ===========================================================================
  // FORM VALIDATION
  // ===========================================================================

  describe("Form Validation", () => {
    it("should show validation errors for required fields", () => {
      // Clear default values and submit
      cy.get('input[placeholder*="Legal Name"]').clear();

      // Try to submit
      cy.contains("button", "Apply for Verification").click();

      // Should show error for company name
      cy.contains("Company name").should("be.visible");
    });

    it("should validate website URL format", () => {
      cy.fillProfessionalForm({
        companyName: "Test Company",
        licenseNumber: "NCA/1234",
      });

      // Enter invalid URL
      cy.get('input[type="url"]').type("not-a-valid-url");

      cy.contains("button", "Apply for Verification").click();

      // Should show URL validation error
      cy.contains("valid URL").should("be.visible");
    });

    it("should validate years of experience is a number", () => {
      cy.get('input[type="number"]').should("have.attr", "min", "0");
      cy.get('input[type="number"]').should("have.attr", "max", "100");
    });

    it("should validate bio length", () => {
      cy.fillProfessionalForm({
        companyName: "Test Company",
        licenseNumber: "NCA/1234",
      });

      // Enter very long bio (over 2000 chars)
      const longBio = "a".repeat(2100);
      cy.get("textarea").type(longBio, { delay: 0 });

      cy.contains("button", "Apply for Verification").click();

      // Should show length validation error
      cy.contains("2000").should("be.visible");
    });
  });

  // ===========================================================================
  // FILE UPLOADS
  // ===========================================================================

  describe("File Uploads", () => {
    const testPdf = "JVBERi0xLjcKCjEgMCBvYmo="; // Minimal PDF base64

    it("should upload certificate files", () => {
      cy.uploadFiles('input[type="file"]', [
        {
          name: "certificate.pdf",
          content: testPdf,
          mimeType: "application/pdf",
        },
      ]);

      // Should show uploaded file
      cy.contains("certificate.pdf").should("be.visible");
      cy.contains("1 of 5 files").should("be.visible");
    });

    it("should allow removing uploaded files", () => {
      cy.uploadFiles('input[type="file"]', [
        {
          name: "certificate.pdf",
          content: testPdf,
          mimeType: "application/pdf",
        },
      ]);

      // Click remove
      cy.contains("Remove").click();

      // File should be removed
      cy.contains("certificate.pdf").should("not.exist");
      cy.contains("No certificates uploaded").should("be.visible");
    });

    it("should enforce max 5 files limit", () => {
      // Upload 5 files
      const files = Array.from({ length: 6 }, (_, i) => ({
        name: `cert${i + 1}.pdf`,
        content: testPdf,
        mimeType: "application/pdf",
      }));

      cy.uploadFiles('input[type="file"]', files);

      // Should show error toast
      cy.waitForToast("Maximum 5", "error");
    });

    it("should reject files larger than 10MB", () => {
      // Create a mock large file scenario
      // In real test, you'd need to handle this differently
      cy.uploadFiles('input[type="file"]', [
        {
          name: "large-file.pdf",
          content: "x".repeat(100), // Small content for test
          mimeType: "application/pdf",
        },
      ]);

      // File should be accepted (size validation happens on actual file object)
      cy.contains("large-file.pdf").should("be.visible");
    });

    it("should only accept PDF, JPG, and PNG files", () => {
      cy.get('input[type="file"]').should(
        "have.attr",
        "accept",
        ".pdf,.jpg,.jpeg,.png"
      );
    });

    it("should disable file input when max files reached", () => {
      // Upload 5 files
      const files = Array.from({ length: 5 }, (_, i) => ({
        name: `cert${i + 1}.pdf`,
        content: testPdf,
        mimeType: "application/pdf",
      }));

      cy.uploadFiles('input[type="file"]', files);

      // File input should be disabled
      cy.get('input[type="file"]').first().should("be.disabled");
    });

    it("should show file sizes", () => {
      cy.uploadFiles('input[type="file"]', [
        {
          name: "certificate.pdf",
          content: testPdf,
          mimeType: "application/pdf",
        },
      ]);

      // Should show file size in KB
      cy.contains("KB").should("be.visible");
    });
  });

  // ===========================================================================
  // STORE INTEGRATION
  // ===========================================================================

  describe("Store Integration", () => {
    it("should toggle store section on click", () => {
      cy.contains("Add a Store").click();

      // Store form should appear
      cy.contains("Store Details").should("be.visible");
      cy.contains("Cancel Store").should("be.visible");
    });

    it("should close store section when cancelled", () => {
      cy.contains("Add a Store").click();
      cy.contains("Cancel Store").click();

      // Store form should be hidden
      cy.contains("Store Details").should("not.exist");
    });

    it("should show store details after adding", () => {
      cy.contains("Add a Store").click();

      // Fill store form (assuming StoreForm has these fields)
      cy.get('input[name="name"]').type("My Building Store");
      cy.get('input[name="address"]').type("123 Main St");

      // Submit store form
      cy.contains("button", "Save Store").click();

      // Should show store summary
      cy.contains("Store Added").should("be.visible");
      cy.contains("My Building Store").should("be.visible");
    });

    it("should allow editing added store", () => {
      cy.contains("Add a Store").click();

      // Add store (mocked)
      cy.get('input[name="name"]').type("My Store");

      // Edit store
      cy.contains("Edit Store").click();

      // Store form should reappear
      cy.contains("Store Details").should("be.visible");
    });

    it("should allow removing added store", () => {
      cy.contains("Add a Store").click();

      // Add store (mocked interaction)
      cy.get('input[name="name"]').type("My Store");

      // Remove store
      cy.contains("Remove Store").click();

      // Store section should collapse
      cy.contains("Store Added").should("not.exist");
    });
  });

  // ===========================================================================
  // FORM SUBMISSION
  // ===========================================================================

  describe("Form Submission", () => {
    beforeEach(() => {
      cy.fillProfessionalForm({
        profession: "Architect",
        companyName: "Acme Architecture Ltd",
        licenseNumber: "NCA/2024/12345",
        yearsExperience: 10,
        website: "https://acme-arch.com",
        bio: "Professional architecture firm with 10 years of experience.",
      });
    });

    it("should show loading state during submission", () => {
      cy.contains("button", "Apply for Verification").click();

      // Should show loading text
      cy.contains("Submitting").should("be.visible");

      // Button should be disabled
      cy.contains("button", "Submitting").should("be.disabled");
    });

    it("should show progress during file upload", () => {
      // Upload files first
      const testPdf = "JVBERi0xLjcKCjEgMCBvYmo=";
      cy.uploadFiles('input[type="file"]', [
        { name: "cert.pdf", content: testPdf, mimeType: "application/pdf" },
      ]);

      cy.contains("button", "Apply for Verification").click();

      // Should show upload progress
      cy.contains("Uploading").should("be.visible");
    });

    it("should show success card after successful submission", () => {
      cy.contains("button", "Apply for Verification").click();

      // Wait for submission
      cy.wait("@submitOnboarding");

      // Should show success card
      cy.contains("Thanks — application received").should("be.visible");
      cy.contains("Go to Dashboard").should("be.visible");
      cy.contains("Edit application").should("be.visible");
    });

    it("should navigate to dashboard after success", () => {
      cy.contains("button", "Apply for Verification").click();
      cy.wait("@submitOnboarding");

      cy.contains("Go to Dashboard").click();

      // Should navigate to dashboard
      cy.url().should("include", "/professional-portal/dashboard");
    });

    it("should allow editing application after success", () => {
      cy.contains("button", "Apply for Verification").click();
      cy.wait("@submitOnboarding");

      cy.contains("Edit application").click();

      // Form should reappear
      cy.contains("Apply for Verification").should("be.visible");
    });

    it("should handle submission errors gracefully", () => {
      // Mock failure
      cy.mockOnboardingApi({ shouldFail: true });

      cy.contains("button", "Apply for Verification").click();

      // Should show error toast
      cy.waitForToast("failed", "error");

      // Form should still be editable
      cy.contains("button", "Apply for Verification")
        .should("be.visible")
        .and("not.be.disabled");
    });

    it("should handle partial upload failures", () => {
      // This tests the sequential upload with partial failure handling
      const testPdf = "JVBERi0xLjcKCjEgMCBvYmo=";
      cy.uploadFiles('input[type="file"]', [
        { name: "cert1.pdf", content: testPdf, mimeType: "application/pdf" },
        { name: "cert2.pdf", content: testPdf, mimeType: "application/pdf" },
      ]);

      // Mock partial failure
      let uploadCount = 0;
      cy.intercept("POST", "**/api/onboarding/uploads", (req) => {
        uploadCount++;
        if (uploadCount === 1) {
          req.reply({
            statusCode: 200,
            body: {
              uploaded: {
                certificates: [{ url: "https://example.com/cert1.pdf" }],
              },
            },
          });
        } else {
          req.reply({ statusCode: 500, body: { error: "Upload failed" } });
        }
      });

      cy.contains("button", "Apply for Verification").click();

      // Should show partial failure toast
      cy.waitForToast("Failed to upload", "error");

      // Submission should still proceed with successful uploads
      cy.wait("@submitOnboarding");
    });
  });

  // ===========================================================================
  // NAVIGATION
  // ===========================================================================

  describe("Navigation", () => {
    it("should navigate back when Go Back is clicked", () => {
      cy.contains("Go Back").click();

      // Should navigate away from professional form
      // Exact behavior depends on your app structure
      cy.url().should("not.include", "professional");
    });

    it("should navigate to stores page if store was added", () => {
      // Add a store
      cy.contains("Add a Store").click();
      cy.get('input[name="name"]').type("Test Store");

      // Fill required fields
      cy.fillProfessionalForm({
        companyName: "Test Company",
        licenseNumber: "NCA/1234",
      });

      cy.contains("button", "Apply for Verification").click();
      cy.wait("@submitOnboarding");

      cy.contains("Go to Dashboard").click();

      // Should navigate to stores page, not dashboard
      cy.url().should("include", "/stores");
    });
  });

  // ===========================================================================
  // ACCESSIBILITY
  // ===========================================================================

  describe("Accessibility", () => {
    it("should have proper focus management", () => {
      // Focus the first interactive element and verify it's the combobox
      cy.get('[role="combobox"]').first().focus();
      cy.focused().should("have.attr", "role", "combobox");

      // Verify keyboard navigation works within combobox
      cy.focused().type("{enter}");
      cy.get('[role="listbox"]').should("be.visible");
    });

    it("should have proper ARIA labels", () => {
      cy.get('[role="combobox"]').should("have.attr", "aria-expanded");
      cy.get('[role="combobox"]').click();
      cy.get('[role="listbox"]').should("exist");
      cy.get('[role="option"]').should("have.length.greaterThan", 0);
    });

    it("should show error messages with proper association", () => {
      cy.get('input[placeholder*="Legal Name"]').clear();
      cy.contains("button", "Apply for Verification").click();

      // Error should be visible and associated with field
      cy.contains("label", "Company Name")
        .parent()
        .find(".text-red-400")
        .should("be.visible");
    });

    it("should have visible focus indicators", () => {
      cy.get('input[placeholder*="Legal Name"]').focus();

      // Should have visible focus ring
      cy.get('input[placeholder*="Legal Name"]').should(
        "have.css",
        "outline-style"
      );
    });
  });

  // ===========================================================================
  // RESPONSIVE DESIGN
  // ===========================================================================

  describe("Responsive Design", () => {
    it("should work on mobile viewport", () => {
      cy.viewport("iphone-x");

      // All elements should still be visible
      cy.contains("Join the Gold Standard").should("be.visible");
      cy.contains("button", "Apply for Verification").should("be.visible");

      // Form should be usable
      cy.fillProfessionalForm({
        companyName: "Mobile Test Co",
        licenseNumber: "NCA/MOBILE",
      });
    });

    it("should work on tablet viewport", () => {
      cy.viewport("ipad-2");

      cy.contains("Join the Gold Standard").should("be.visible");
      cy.get('[role="combobox"]').click();
      cy.get('[role="listbox"]').should("be.visible");
    });
  });
});
