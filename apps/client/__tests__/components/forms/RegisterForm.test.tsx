// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RegisterForm, {
  RegisterFormSkeleton,
} from "@/components/forms/RegisterForm";

vi.mock("@clerk/nextjs", () => ({
  SignUp: () => (
    <div data-testid="clerk-sign-up-widget">Clerk SignUp Widget</div>
  ),
}));

describe("RegisterForm component SSR & client mount safety", () => {
  it("renders the skeleton during SSR / static string rendering without executing Clerk SignUp", () => {
    const ssrHtml = renderToString(<RegisterForm />);

    expect(ssrHtml).toContain('data-testid="register-form-skeleton"');
    expect(ssrHtml).not.toContain('data-testid="clerk-sign-up-widget"');
  });

  it("renders a lightweight skeleton on initial pre-mount render and mounts Clerk SignUp on client", () => {
    const { container } = render(<RegisterForm />);

    expect(screen.getByTestId("clerk-sign-up-widget")).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="register-form-container"]'),
    ).toBeInTheDocument();
  });

  it("renders RegisterFormSkeleton directly with pulse animations and accessible loading status", () => {
    render(<RegisterFormSkeleton />);

    const skeleton = screen.getByTestId("register-form-skeleton");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute("role", "status");
  });
});
