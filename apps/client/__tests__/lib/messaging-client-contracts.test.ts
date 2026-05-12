import { afterEach, describe, expect, it, vi } from "vitest";
import { messagingClient } from "@/lib/facades/messaging-client";

describe("messaging client contracts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses conversation messages endpoint for list queries", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { messages: [], hasMore: false } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await messagingClient.getMessages("thread-123", {
      limit: 20,
      direction: "before",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstArg = fetchMock.mock.calls[0]?.[0];
    expect(String(firstArg)).toContain(
      "/api/messaging/messages/conversation/thread-123?",
    );
    expect(String(firstArg)).not.toContain("threadId=");
  });
});
