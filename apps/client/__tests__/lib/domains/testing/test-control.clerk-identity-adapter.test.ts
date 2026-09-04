import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IdentityLease } from "@/app/lib/domains/testing/test-control/identity-repository";

const mockPrisma = {
  stagingTestIdentityLease: {
    update: vi.fn(),
  },
};

vi.mock("@build/db", () => ({
  prisma: mockPrisma,
}));

const mockClerkUser = {
  id: "clerk_pro_1",
  emailAddresses: [
    { id: "email_1", emailAddress: "e2e_pro_1@staging.buildmarket.app" },
  ],
  primaryEmailAddressId: "email_1",
};

const mockGetUser = vi.fn().mockResolvedValue(mockClerkUser);
const mockUpdateUserMetadata = vi.fn().mockResolvedValue(mockClerkUser);
const mockGetSessionList = vi.fn().mockResolvedValue({
  data: [
    { id: "sess_1", status: "active" },
    { id: "sess_2", status: "active" },
  ],
});
const mockRevokeSession = vi.fn().mockResolvedValue({});

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn().mockResolvedValue({
    users: {
      getUser: mockGetUser,
      updateUserMetadata: mockUpdateUserMetadata,
    },
    sessions: {
      getSessionList: mockGetSessionList,
      revokeSession: mockRevokeSession,
    },
  }),
}));

const { restoreClerkIdentityBaseline } =
  await import("@/app/lib/domains/testing/test-control/clerk-identity-adapter");

describe("clerk-identity-adapter", () => {
  const lease: IdentityLease = {
    id: "lease-1",
    stagingTestRunId: "run-1",
    slot: "pro-1",
    role: "PROFESSIONAL",
    userId: "user_pro_1",
    clerkId: "clerk_pro_1",
    state: "RESETTING",
    leaseExpiresAt: new Date(Date.now() + 300000),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue(mockClerkUser);
    mockUpdateUserMetadata.mockResolvedValue(mockClerkUser);
    mockGetSessionList.mockResolvedValue({
      data: [
        { id: "sess_1", status: "active" },
        { id: "sess_2", status: "active" },
      ],
    });
    mockRevokeSession.mockResolvedValue({});
  });

  it("updates metadata strictly to documented baseline and revokes active sessions", async () => {
    const result = await restoreClerkIdentityBaseline(lease);

    expect(result.ok).toBe(true);

    // Exact metadata check
    expect(mockUpdateUserMetadata).toHaveBeenCalledWith("clerk_pro_1", {
      publicMetadata: {
        role: "PROFESSIONAL",
        onboardingComplete: false,
      },
      unsafeMetadata: {},
    });

    // Session revocation check
    expect(mockGetSessionList).toHaveBeenCalledWith({ userId: "clerk_pro_1" });
    expect(mockRevokeSession).toHaveBeenCalledWith("sess_1");
    expect(mockRevokeSession).toHaveBeenCalledWith("sess_2");
  });

  it("rejects non-pool Clerk identity and never updates metadata", async () => {
    mockGetUser.mockResolvedValueOnce({
      id: "clerk_foreign",
      emailAddresses: [
        { id: "email_foreign", emailAddress: "real_customer@gmail.com" },
      ],
      primaryEmailAddressId: "email_foreign",
    });

    const result = await restoreClerkIdentityBaseline({
      ...lease,
      clerkId: "clerk_foreign",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("NON_POOL_CLERK_USER");
    }
    expect(mockUpdateUserMetadata).not.toHaveBeenCalled();
    expect(mockRevokeSession).not.toHaveBeenCalled();
  });

  it("marks lease FAILED and returns error when Clerk API throws", async () => {
    mockUpdateUserMetadata.mockRejectedValueOnce(
      new Error("Clerk API timeout"),
    );

    const result = await restoreClerkIdentityBaseline(lease);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("CLERK_BASELINE_RESET_FAILED");
    }

    expect(mockPrisma.stagingTestIdentityLease.update).toHaveBeenCalledWith({
      where: { id: lease.id },
      data: { state: "FAILED" },
    });
  });
});
