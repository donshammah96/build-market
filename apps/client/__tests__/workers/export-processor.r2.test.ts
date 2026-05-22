import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  s3ClientCtor: vi.fn(),
  uploadCtor: vi.fn(),
  getSignedUrl: vi.fn().mockResolvedValue("https://signed.example/export.zip"),
  capturedUploadParams: {
    current: undefined as Record<string, unknown> | undefined,
  },
  prisma: {
    dataExportUpdate: vi.fn(),
    dataExportFindUnique: vi.fn(),
    userFindUnique: vi.fn(),
    assetFindMany: vi.fn(),
  },
}));

vi.mock("@/app/lib/infrastructure/env", () => ({
  env: {
    s3: {
      disabled: false,
      exportBucket: "gdpr-exports",
      localDir: "./tmp-exports-test",
      accessKeyId: "r2-key",
      secretAccessKey: "r2-secret",
      endpoint: "https://account.r2.cloudflarestorage.com",
      region: "auto",
    },
  },
}));

vi.mock("@build/db", () => ({
  prisma: {
    dataExport: {
      update: mocks.prisma.dataExportUpdate,
      findUnique: mocks.prisma.dataExportFindUnique,
    },
    user: {
      findUnique: mocks.prisma.userFindUnique,
    },
    asset: {
      findMany: mocks.prisma.assetFindMany,
    },
  },
}));

vi.mock("fs", () => {
  const writeStream = {
    on: vi.fn((event: string, callback: () => void) => {
      if (event === "close") {
        callback();
      }
      return writeStream;
    }),
  };

  const fsModule = {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn(() => writeStream),
    copyFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    createReadStream: vi.fn(() => ({ on: vi.fn() })),
    promises: {
      writeFile: vi.fn(),
      stat: vi.fn(),
    },
  };

  return {
    default: fsModule,
    ...fsModule,
  };
});

vi.mock("archiver", () => ({
  default: vi.fn(() => ({
    on: vi.fn(),
    pipe: vi.fn(),
    append: vi.fn(),
    finalize: vi.fn().mockResolvedValue(undefined),
    pointer: vi.fn(() => 1024),
  })),
}));

vi.mock("@aws-sdk/client-s3", () => {
  class S3Client {
    send = vi.fn();

    constructor(config: unknown) {
      mocks.s3ClientCtor(config);
    }
  }

  class DeleteObjectCommand {
    constructor(public input: unknown) {}
  }

  class GetObjectCommand {
    constructor(public input: unknown) {}
  }

  return {
    S3Client,
    DeleteObjectCommand,
    GetObjectCommand,
  };
});

vi.mock("@aws-sdk/lib-storage", () => ({
  Upload: class {
    on = vi.fn();
    done = vi.fn().mockResolvedValue(undefined);

    constructor(options: { params?: Record<string, unknown> }) {
      mocks.uploadCtor(options);
      mocks.capturedUploadParams.current = options.params;
    }
  },
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: mocks.getSignedUrl,
}));

import { ExportProcessor } from "@/app/workers/export/processor";

describe("ExportProcessor R2 upload compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.capturedUploadParams.current = undefined;

    mocks.prisma.dataExportUpdate.mockResolvedValue({});
    mocks.prisma.dataExportFindUnique.mockResolvedValue({
      id: "export_1",
      userId: "user_1",
    });
    mocks.prisma.userFindUnique.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      phone: null,
      role: "CLIENT",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      dataRetentionDays: 30,
      consents: [],
      clientProfile: null,
      professionalProfile: null,
      projects: [],
      orders: [],
      ideaBooks: [],
    });
    mocks.prisma.assetFindMany.mockResolvedValue([]);
  });

  it("constructs an endpoint-aware S3 client and omits unsupported SSE headers", async () => {
    const processor = new ExportProcessor();

    await processor.processExport("export_1");

    expect(mocks.s3ClientCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        region: "auto",
        endpoint: "https://account.r2.cloudflarestorage.com",
        credentials: {
          accessKeyId: "r2-key",
          secretAccessKey: "r2-secret",
        },
      }),
    );

    expect(mocks.uploadCtor).toHaveBeenCalledTimes(1);
    expect(mocks.getSignedUrl).toHaveBeenCalledTimes(1);

    const uploadParams = mocks.capturedUploadParams.current;
    expect(uploadParams).toBeDefined();
    expect(uploadParams?.Bucket).toBe("gdpr-exports");
    expect(uploadParams?.ContentType).toBe("application/zip");
    expect(uploadParams).not.toHaveProperty("ServerSideEncryption");
  });
});
