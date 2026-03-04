import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { logMiddlewareDecision } from "@/app/lib/security/middleware/decision-log";

describe("middleware decision log", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits stable middleware event payload", () => {
    const infoSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    const req = new NextRequest("http://localhost:3500/dashboard");

    logMiddlewareDecision(req, "mw_redirect_signin", {
      routeClass: "protected",
    });

    expect(infoSpy).toHaveBeenCalledWith(
      "[MiddlewareDecision]",
      expect.objectContaining({
        event: "mw_redirect_signin",
        pathname: "/dashboard",
        method: "GET",
        routeClass: "protected",
      }),
    );
  });
});
