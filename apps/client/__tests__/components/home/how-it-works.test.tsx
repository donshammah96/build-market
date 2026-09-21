// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";

import { HowItWorks } from "@/components/home/HowItWorks";

beforeEach(() => {
  global.IntersectionObserver = class IntersectionObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;

  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;

  window.matchMedia =
    window.matchMedia ||
    (function () {
      return {
        matches: false,
        addListener: function () {},
        removeListener: function () {},
        addEventListener: function () {},
        removeEventListener: function () {},
        dispatchEvent: function () {
          return false;
        },
      };
    } as any);
});

describe("HowItWorks Accessibility and Non-Custodial Copy", () => {
  it("uses button group toggle semantics (role=group, aria-pressed) instead of incomplete tablist semantics", () => {
    const { container } = render(<HowItWorks />);

    // Incomplete tablist/tab pattern must not be present
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(container.querySelector('[role="tab"]')).toBeNull();

    // Group with aria-label and buttons with aria-pressed must be present
    const group = screen.getByRole("group", { name: /view how it works for/i });
    expect(group).toBeInTheDocument();

    const clientBtn = screen.getByRole("button", { name: /for clients/i });
    const proBtn = screen.getByRole("button", { name: /for professionals/i });

    expect(clientBtn).toHaveAttribute("aria-pressed", "true");
    expect(proBtn).toHaveAttribute("aria-pressed", "false");

    // Switching toggle updates pressed state
    fireEvent.click(proBtn);
    expect(clientBtn).toHaveAttribute("aria-pressed", "false");
    expect(proBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("does not contain prohibited custodial disbursement or milestone protection claims in client copy", () => {
    render(<HowItWorks />);

    // Prohibited client claims
    expect(screen.queryByText(/milestone protection/i)).toBeNull();
    expect(
      screen.queryByText(/never pay for work that hasn't been done/i),
    ).toBeNull();
    expect(
      screen.queryByText(/release payment as each milestone is approved/i),
    ).toBeNull();

    // Compliant non-custodial copy for clients
    expect(screen.getByText(/sign-offs/i)).toBeInTheDocument();
  });

  it("does not contain prohibited fund release or disbursement claims in professional copy", () => {
    render(<HowItWorks />);

    const proBtn = screen.getByRole("button", { name: /for professionals/i });
    fireEvent.click(proBtn);

    // Prohibited pro claims
    expect(screen.queryByText(/disbursed as work is approved/i)).toBeNull();
    expect(screen.queryByText(/disbursed/i)).toBeNull();

    // Compliant non-custodial copy for pros
    expect(
      screen.getByText(/direct stage/i, { exact: false }) ||
        screen.getByText(/recorded approvals/i, { exact: false }),
    ).toBeTruthy();
  });
});
