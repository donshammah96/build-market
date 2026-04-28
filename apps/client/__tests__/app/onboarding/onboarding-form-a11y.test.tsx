// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import HomeownerForm from "@/components/forms/HomeownerForm";
import DetailsStep from "@/components/forms/professional-wizard/DetailsStep";
import CredentialsStep from "@/components/forms/professional-wizard/CredentialsStep";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!globalThis.ResizeObserver) {
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: ResizeObserverMock,
  });
}

if (!HTMLElement.prototype.scrollIntoView) {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: () => {},
  });
}

const wizardStepBaseProps = {
  data: {},
  onUpdate: vi.fn(),
  onNext: vi.fn(),
  onBack: vi.fn(),
  goToStep: vi.fn(),
  isFirstStep: false,
  isLastStep: false,
  isSubmitting: false,
};

describe("Onboarding form a11y and invalid focus behavior", () => {
  it("focuses the county combobox first when homeowner submit is invalid", async () => {
    render(
      <HomeownerForm
        onBack={vi.fn()}
        onSubmit={vi.fn(async () => undefined)}
        onAuthSuccess={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      const countyField = document.getElementById("homeowner-county");
      expect(countyField).toHaveFocus();
      expect(countyField).toHaveAttribute("aria-invalid", "true");
      expect(countyField).toHaveAttribute(
        "aria-describedby",
        "homeowner-county-error",
      );
    });
  });

  it("focuses company name first on invalid professional details step submit", async () => {
    render(<DetailsStep {...wizardStepBaseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      const companyNameInput = document.getElementById("companyName");
      expect(companyNameInput).toHaveFocus();
      expect(companyNameInput).toHaveAttribute("aria-invalid", "true");
      expect(companyNameInput).toHaveAttribute(
        "aria-describedby",
        "companyName-error",
      );
    });
  });

  it("focuses board registration first on invalid credentials step submit", async () => {
    render(
      <CredentialsStep
        {...wizardStepBaseProps}
        data={{ profession: "ENGINEER" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /continue/i }));

    await waitFor(() => {
      const credentialsField = document.getElementById(
        "boardRegistrationNumber",
      );
      expect(credentialsField).toHaveFocus();
      expect(credentialsField).toHaveAttribute("aria-invalid", "true");
      expect(credentialsField).toHaveAttribute(
        "aria-describedby",
        "boardRegistrationNumber-error",
      );
    });
  });

  it("focuses custom project type when project type is other and field is first invalid", async () => {
    render(
      <HomeownerForm
        onBack={vi.fn()}
        onSubmit={vi.fn(async () => undefined)}
        onAuthSuccess={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    fireEvent.click(document.getElementById("homeowner-county")!);
    fireEvent.click(await screen.findByText("Nairobi"));

    fireEvent.click(document.getElementById("homeowner-project-type")!);
    fireEvent.click(await screen.findByText("Other (Please Specify)"));

    fireEvent.click(screen.getByRole("button", { name: /get started/i }));

    await waitFor(() => {
      const customProjectTypeField = document.getElementById(
        "homeowner-custom-project-type",
      );
      expect(customProjectTypeField).toHaveFocus();
      expect(customProjectTypeField).toHaveAttribute("aria-invalid", "true");
      expect(customProjectTypeField).toHaveAttribute(
        "aria-describedby",
        "homeowner-custom-project-type-error",
      );
    });
  });
});
