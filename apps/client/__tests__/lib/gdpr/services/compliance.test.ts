import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import {
  mockPrismaSuccess,
  mockPrismaWithDBError,
  generateMockAuditLog,
  generateTestDate,
} from "../../../mocks";

vi.mock("@build/db", () => ({
  prisma: mockPrismaSuccess(),
}));

describe("ComplianceService", () => {
  let ComplianceService: any;
  let service: any;
  let mockPrisma: ReturnType<typeof mockPrismaSuccess>;

  beforeEach(async () => {
    mockPrisma = mockPrismaSuccess();
    vi.doMock("@build/db", () => ({
      prisma: mockPrisma,
    }));
    const serviceModule = await import(
      "@/app/lib/gdpr/services/compliance.service"
    );
    ComplianceService = serviceModule.ComplianceService;
    service = new ComplianceService();
  });

  describe("getAuditLogs", () => {
    it("should retrieve audit logs with pagination", async () => {
      const logs = [
        generateMockAuditLog({ action: "DATA_EXPORT_REQUESTED" }),
        generateMockAuditLog({ action: "CONSENT_GRANTED" }),
      ];

      (mockPrisma.auditLog.findMany as Mock).mockResolvedValue(logs);
      (mockPrisma.auditLog.count as Mock).mockResolvedValue(50);

      const result = await service.getAuditLogs({
        page: 1,
        limit: 10,
      });

      expect(result.logs).toEqual(logs);
      expect(result.pagination).toEqual({
        total: 50,
        page: 1,
        limit: 10,
        pages: 5,
      });
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { timestamp: "desc" },
      });
    });

    it("should filter audit logs by userId", async () => {
      const userId = "user_123";
      const logs = [generateMockAuditLog({ userId })];

      (mockPrisma.auditLog.findMany as Mock).mockResolvedValue(logs);
      (mockPrisma.auditLog.count as Mock).mockResolvedValue(1);

      await service.getAuditLogs({ userId, page: 1, limit: 10 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { userId },
        skip: 0,
        take: 10,
        orderBy: { timestamp: "desc" },
      });
    });

    it("should filter audit logs by action type", async () => {
      const action = "BREACH_DETECTED";
      const logs = [generateMockAuditLog({ action })];

      (mockPrisma.auditLog.findMany as Mock).mockResolvedValue(logs);
      (mockPrisma.auditLog.count as Mock).mockResolvedValue(1);

      await service.getAuditLogs({ action, page: 1, limit: 10 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: { action },
        skip: 0,
        take: 10,
        orderBy: { timestamp: "desc" },
      });
    });

    it("should filter audit logs by date range", async () => {
      const startDate = generateTestDate();
      const endDate = generateTestDate(1);
      const logs = [generateMockAuditLog()];

      (mockPrisma.auditLog.findMany as Mock).mockResolvedValue(logs);
      (mockPrisma.auditLog.count as Mock).mockResolvedValue(1);

      await service.getAuditLogs({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        page: 1,
        limit: 10,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          timestamp: {
            gte: startDate,
            lte: endDate,
          },
        },
        skip: 0,
        take: 10,
        orderBy: { timestamp: "desc" },
      });
    });

    it.concurrent("should handle database errors gracefully", async () => {
      const mockErrorPrisma = mockPrismaWithDBError();
      vi.doMock("@build/db", () => ({
        prisma: mockErrorPrisma,
      }));
      const serviceModule = await import(
        "@/app/lib/gdpr/services/compliance.service"
      );
      const errorService = new serviceModule.ComplianceService();

      await expect(
        errorService.getAuditLogs({ page: 1, limit: 10 }),
      ).rejects.toThrow("Database connection failed");
    });
  });

  describe("getDashboardStats", () => {
    it("should return compliance dashboard statistics", async () => {
      (mockPrisma.auditLog.count as Mock)
        .mockResolvedValueOnce(10) // CONSENT_GRANTED
        .mockResolvedValueOnce(5) // CONSENT_REVOKED
        .mockResolvedValueOnce(15) // DATA_EXPORT_REQUESTED
        .mockResolvedValueOnce(12) // DATA_EXPORT_COMPLETED
        .mockResolvedValueOnce(3); // ACCOUNT_ANONYMIZED

      (mockPrisma.securityIncident.count as Mock).mockResolvedValue(2);

      const stats = await service.getDashboardStats({
        startDate: generateTestDate(-30).toISOString(),
        endDate: generateTestDate().toISOString(),
      });

      expect(stats).toEqual({
        consentsGranted: 10,
        consentsRevoked: 5,
        exportsRequested: 15,
        exportsCompleted: 12,
        accountsAnonymized: 3,
        securityIncidents: 2,
      });
    });

    it.concurrent(
      "should handle database errors in stats retrieval",
      async () => {
        const mockErrorPrisma = mockPrismaWithDBError();
        vi.doMock("@build/db", () => ({
          prisma: mockErrorPrisma,
        }));
        const serviceModule = await import(
          "@/app/lib/gdpr/services/compliance.service"
        );
        const errorService = new serviceModule.ComplianceService();

        await expect(
          errorService.getDashboardStats({
            startDate: generateTestDate(-30).toISOString(),
            endDate: generateTestDate().toISOString(),
          }),
        ).rejects.toThrow("Database connection failed");
      },
    );
  });

  describe("createAuditLog", () => {
    it("should create a new audit log entry", async () => {
      const logData = {
        userId: "user_123",
        action: "DATA_EXPORT_REQUESTED",
        entityType: "DATA_EXPORT",
        entityId: "export_456",
        metadata: {
          exportId: "export_456",
          ipAddress: "192.168.1.1",
          userAgent: "Mozilla/5.0",
        },
      };

      const createdLog = generateMockAuditLog(logData);
      (mockPrisma.auditLog.create as Mock).mockResolvedValue(createdLog);

      const result = await service.createAuditLog(logData);

      expect(result).toEqual(createdLog);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          ...logData,
          timestamp: expect.any(Date),
        },
      });
    });

    it.concurrent("should handle audit log creation failures", async () => {
      const mockErrorPrisma = mockPrismaWithDBError();
      vi.doMock("@build/db", () => ({
        prisma: mockErrorPrisma,
      }));
      const serviceModule = await import(
        "@/app/lib/gdpr/services/compliance.service"
      );
      const errorService = new serviceModule.ComplianceService();

      await expect(
        errorService.createAuditLog({
          userId: "user_123",
          action: "CONSENT_GRANTED",
          entityType: "USER",
          entityId: "user_123",
          metadata: {
            ipAddress: "192.168.1.1",
            userAgent: "Mozilla/5.0",
          },
        }),
      ).rejects.toThrow("Database connection failed");
    });
  });

  describe("getSecurityIncidents", () => {
    it("should retrieve security incidents with filters", async () => {
      const incidents = [
        {
          id: "incident_1",
          severity: "CRITICAL",
          status: "ACTIVE",
          detectedAt: generateTestDate(),
        },
      ];

      (mockPrisma.securityIncident.findMany as Mock).mockResolvedValue(
        incidents,
      );
      (mockPrisma.securityIncident.count as Mock).mockResolvedValue(1);

      const result = await service.getSecurityIncidents({
        severity: "CRITICAL",
        page: 1,
        limit: 10,
      });

      expect(result.incidents).toEqual(incidents);
      expect(mockPrisma.securityIncident.findMany).toHaveBeenCalledWith({
        where: { severity: "CRITICAL" },
        skip: 0,
        take: 10,
        orderBy: { detectedAt: "desc" },
      });
    });
  });
});
