// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AlertCircle } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OnboardingError from "@/app/onboarding/error";
import { RoleCard } from "@/app/onboarding/_components/RoleCard";

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

describe("Onboarding route UI contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders RoleCard with explicit focus-visible and helper semantics", () => {
    render(
      <RoleCard
        icon={<AlertCircle aria-hidden="true" />}
        title="I am a Professional"
        description="I am an Architect looking for quality leads."
        onClick={vi.fn()}
        delay={0}
        helperText="Build trust with verified credentials and grow your pipeline."
      />,
    );

    const button = screen.getByRole("button", {
      name: /i am a professional/i,
    });

    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button.className).toContain("focus-visible:outline-2");
    expect(button.className).toContain("active:scale-[0.98]");
    expect(
      screen.getByText(
        "Build trust with verified credentials and grow your pipeline.",
      ),
    ).toBeInTheDocument();
  });

  it("renders selected and error RoleCard state semantics", () => {
    const { rerender } = render(
      <RoleCard
        icon={<AlertCircle aria-hidden="true" />}
        title="I Am a Project Owner"
        description="I am planning a project and I need verified experts."
        onClick={vi.fn()}
        delay={0}
        isSelected
        helperText="Selection confirmed."
      />,
    );

    expect(
      screen.getByRole("button", { name: /project owner/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Selection confirmed.")).toBeInTheDocument();

    rerender(
      <RoleCard
        icon={<AlertCircle aria-hidden="true" />}
        title="I Am a Project Owner"
        description="I am planning a project and I need verified experts."
        onClick={vi.fn()}
        delay={0}
        isError
        helperText="This selection is currently unavailable."
      />,
    );

    const errorButton = screen.getByRole("button", { name: /project owner/i });
    expect(errorButton).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText("This selection is currently unavailable."),
    ).toBeInTheDocument();
  });

  it("disables RoleCard and exposes action-scoped loading text", () => {
    render(
      <RoleCard
        icon={<AlertCircle aria-hidden="true" />}
        title="I am a Professional"
        description="I am an Architect looking for quality leads."
        onClick={vi.fn()}
        delay={0}
        isLoading
      />,
    );

    const button = screen.getByRole("button", {
      name: /i am a professional/i,
    });

    expect(button).toBeDisabled();
    expect(screen.getByText("Loading selection...")).toBeInTheDocument();
  });

  it("uses navigation-based retry for onboarding error state", () => {
    render(
      <OnboardingError
        error={new Error("Load failure") as Error & { digest?: string }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(mockReplace).toHaveBeenCalledWith("/onboarding");
  });
});
