import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  startVerificationEmailConsumer,
  stopVerificationEmailConsumer,
} from "../internal/verification-email.worker";

const subscribeMock = vi.fn();
const connectMock = vi.fn();
const disconnectMock = vi.fn();

vi.mock("@build/nats", () => ({
  createConsumer: vi.fn(() => ({
    connect: connectMock,
    disconnect: disconnectMock,
    subscribe: subscribeMock,
  })),
  initializeStreams: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/infrastructure/mailer", () => ({
  sendEmail: vi.fn().mockResolvedValue({ id: "email-id" }),
}));

vi.mock("@/lib/infrastructure/env", () => ({
  adminEnvConfig: {
    NATS_URL: "nats://localhost:4222",
    RESEND_API_KEY: "re_key_123",
  },
}));

vi.mock("@build/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    professionalDocument: {
      findUnique: vi.fn(),
    },
    professionalLicense: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("../repository", () => ({
  verificationRepository: {
    findStoreOwnerId: vi.fn(),
    findPropertyOwnerId: vi.fn(),
  },
}));

describe("Verification Email NATS Consumer Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should connect, subscribe to verification.> and license.>, and handle email delivery when verification event is received", async () => {
    const { sendEmail } = await import("@/lib/infrastructure/mailer");
    const { prisma } = await import("@build/db");

    // 1. Start consumer
    await startVerificationEmailConsumer();

    expect(connectMock).toHaveBeenCalled();
    expect(subscribeMock).toHaveBeenCalledWith([
      expect.objectContaining({
        subject: "verification.>",
        consumerOptions: {
          durableName: "verification-email-worker",
        },
      }),
      expect.objectContaining({
        subject: "license.>",
        consumerOptions: {
          durableName: "verification-email-worker-license",
        },
      }),
    ]);

    // 2. Extract subscriber handler
    const handler = subscribeMock.mock.calls[0]![0]![0]!.handler;

    // Mock DB resolution
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "professional@example.com",
      firstName: "Jane",
      lastName: "Doe",
    } as any);

    // 3. Mock working and ack/nak on NATS message payload
    const mockWorking = vi.fn();
    const mockMsg: any = {
      data: {
        entityType: "professional",
        entityId: "prof-uuid-123",
        previousStatus: "PENDING",
        newStatus: "VERIFIED",
        success: true,
        message: "Your profile has been verified",
        metadata: {
          email: "jane@example.com",
          userName: "Jane Doe",
        },
      },
      working: mockWorking,
    };

    // 4. Invoke handler
    await handler(mockMsg);

    expect(mockWorking).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@example.com",
        subject: "Your Professional Has Been Verified",
        html: expect.stringContaining("Verification Successful!"),
      }),
    );
  });

  it("should handle license.> events for terminal actions", async () => {
    const { sendEmail } = await import("@/lib/infrastructure/mailer");
    const { prisma } = await import("@build/db");

    await startVerificationEmailConsumer();
    const licenseHandler = subscribeMock.mock.calls[0]![0]![1]!.handler;

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "licensed_prof@example.com",
      firstName: "Alex",
      lastName: "Smith",
    } as any);

    vi.mocked(prisma.professionalLicense.findUnique).mockResolvedValue({
      authority: "NCA",
      licenseNumber: "NCA-999",
    } as any);

    const mockWorking = vi.fn();
    const mockMsg: any = {
      data: {
        licenseId: "lic-uuid-999",
        professionalId: "prof-uuid-456",
        authority: "NCA",
        licenseNumber: "NCA-999",
        previousStatus: "PENDING",
        newStatus: "VERIFIED",
        action: "verified",
        adminId: "admin_1",
        correlationId: "corr_123",
        timestamp: new Date().toISOString(),
      },
      working: mockWorking,
    };

    await licenseHandler(mockMsg);

    expect(mockWorking).toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "licensed_prof@example.com",
        subject: "Your License Has Been Verified",
      }),
    );
  });

  it("should ignore non-terminal license events", async () => {
    const { sendEmail } = await import("@/lib/infrastructure/mailer");

    await startVerificationEmailConsumer();
    const licenseHandler = subscribeMock.mock.calls[0]![0]![1]!.handler;

    const mockMsg: any = {
      data: {
        licenseId: "lic-uuid-999",
        action: "auto_verify_requested",
      },
      working: vi.fn(),
    };

    await licenseHandler(mockMsg);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("should fall back to DB lookup when email is missing in event metadata", async () => {
    const { sendEmail } = await import("@/lib/infrastructure/mailer");
    const { prisma } = await import("@build/db");

    await startVerificationEmailConsumer();
    const handler = subscribeMock.mock.calls[0]![0]![0]!.handler;

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      email: "fallback@example.com",
      firstName: "John",
      lastName: "Smith",
    } as any);

    const mockMsg: any = {
      data: {
        entityType: "professional",
        entityId: "prof-uuid-123",
        previousStatus: "PENDING",
        newStatus: "REJECTED",
        success: false,
        message: "Verification failed",
        reason: "Documents are illegible",
        notes: "Please re-upload high resolution scans",
      },
      working: vi.fn(),
    };

    await handler(mockMsg);

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "prof-uuid-123" },
      select: { email: true, firstName: true, lastName: true },
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "fallback@example.com",
        subject: "Action Required: Professional Verification Rejected",
        html: expect.stringContaining("Verification Rejected"),
      }),
    );
  });

  it("should skip email delivery if RESEND_API_KEY is not configured", async () => {
    const { sendEmail } = await import("@/lib/infrastructure/mailer");
    const { adminEnvConfig } = await import("@/lib/infrastructure/env");

    const originalKey = adminEnvConfig.RESEND_API_KEY;
    adminEnvConfig.RESEND_API_KEY = undefined as any;

    try {
      await startVerificationEmailConsumer();
      const handler = subscribeMock.mock.calls[0]![0]![0]!.handler;

      const mockMsg: any = {
        data: {
          entityType: "professional",
          entityId: "prof-uuid-123",
          previousStatus: "PENDING",
          newStatus: "VERIFIED",
          success: true,
          message: "Verified",
          metadata: {
            email: "jane@example.com",
            userName: "Jane Doe",
          },
        },
        working: vi.fn(),
      };

      await handler(mockMsg);

      expect(sendEmail).not.toHaveBeenCalled();
    } finally {
      adminEnvConfig.RESEND_API_KEY = originalKey;
    }
  });

  it("should stop consumer cleanly", async () => {
    await startVerificationEmailConsumer();
    await stopVerificationEmailConsumer();
    expect(disconnectMock).toHaveBeenCalled();
  });
});
