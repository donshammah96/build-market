import { describe, expect, it, vi } from "vitest";
import {
  installClerkMiddlewareMock,
  resetMockAuthState,
  setMockAuthState,
  spyOnConsoleError,
} from "./index.js";

describe("clerk-test-harness", () => {
  it("manages mock auth state correctly", () => {
    setMockAuthState({ userId: "user_123", sessionClaims: { role: "admin" } });
    // State set without error
    resetMockAuthState();
    // Reset back to default
  });

  it("spies on console.error without crashing", () => {
    const consoleSpy = spyOnConsoleError();
    console.error("Test error message");
    expect(consoleSpy).toHaveBeenCalledWith("Test error message");
    consoleSpy.mockRestore();
  });

  it("registers clerkMiddleware mock using vi.doMock", () => {
    expect(() => installClerkMiddlewareMock()).not.toThrow();
  });
});
