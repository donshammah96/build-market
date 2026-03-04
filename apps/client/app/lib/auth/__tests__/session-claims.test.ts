import { describe, expect, it } from "vitest";
import { parseMiddlewareSessionMetadata } from "../session-claims";

describe("parseMiddlewareSessionMetadata", () => {
  it("parses valid role and onboarding flags", () => {
    const parsed = parseMiddlewareSessionMetadata({
      metadata: { role: "professional", isOnboarded: true },
    });

    expect(parsed).toEqual({ role: "professional", isOnboarded: true });
  });

  it("returns undefined for missing metadata object", () => {
    expect(parseMiddlewareSessionMetadata(undefined)).toBeUndefined();
    expect(parseMiddlewareSessionMetadata({})).toBeUndefined();
  });

  it("drops invalid metadata value types", () => {
    const parsed = parseMiddlewareSessionMetadata({
      metadata: { role: 123, isOnboarded: "true" },
    });

    expect(parsed).toEqual({ role: undefined, isOnboarded: undefined });
  });
});
