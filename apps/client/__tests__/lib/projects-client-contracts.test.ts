import { describe, expect, it } from "vitest";
import {
  MilestoneMutationResponseSchema,
  ProjectListResponseSchema,
} from "@/app/lib/domains/projects/client/contracts";

describe("projects client contracts", () => {
  it("parses canonical project list envelope", () => {
    const result = ProjectListResponseSchema.parse({
      items: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          title: "Kitchen Remodel",
          status: "IN_PROGRESS",
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(result.pagination?.total).toBe(1);
  });

  it("rejects legacy project list envelope", () => {
    expect(() =>
      ProjectListResponseSchema.parse({
        projects: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            title: "Kitchen Remodel",
            status: "IN_PROGRESS",
          },
        ],
      }),
    ).toThrow();
  });

  it("fails mutation validation for invalid enum values", () => {
    expect(() =>
      MilestoneMutationResponseSchema.parse({
        result: {
          id: "22222222-2222-4222-8222-222222222222",
          status: "INVALID_STATUS",
        },
      }),
    ).toThrow();
  });
});
