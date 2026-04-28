// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";

describe("Button asChild slot contracts", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders asChild content without forwarding props into React.Fragment", () => {
    const errorSpy = vi.spyOn(console, "error");

    const { container } = render(
      <Button asChild isLoading loadingText="Saving">
        <a href="/target">Submit</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: /saving/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/target");
    expect(container.querySelectorAll("a")).toHaveLength(1);

    const emittedErrors = errorSpy.mock.calls
      .flat()
      .map((value) => String(value))
      .join("\n");

    expect(emittedErrors).not.toContain(
      "Invalid prop `data-slot` supplied to `React.Fragment`",
    );
    expect(emittedErrors).not.toContain(
      "In HTML, <a> cannot be a descendant of <a>",
    );
  });

  it("falls back to a native button when asChild receives a fragment", () => {
    render(
      <Button asChild>
        <>
          <span>Click me</span>
        </>
      </Button>,
    );

    expect(
      screen.getByRole("button", { name: /click me/i }),
    ).toBeInTheDocument();
  });
});
