import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CpdActivityType } from "@build/db";
import { withAuth } from "@/app/lib/api/api-middleware";
import { clientCpdService } from "@/app/lib/domains/professionals/cpd";

const LogCpdSchema = z.object({
  activityType: z.nativeEnum(CpdActivityType),
  providerName: z.string().min(2),
  activityTitle: z.string().min(3),
  pointsEarned: z.number().int().min(1).max(50),
  completedAt: z
    .string()
    .datetime()
    .transform((v) => new Date(v)),
  evidenceAssetId: z.string().uuid().optional(),
});

export const GET = withAuth(async (req: NextRequest, { dbUserId }) => {
  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : undefined;

  const result = await clientCpdService.getComplianceSummary(dbUserId, year);

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: 500 });
  }

  return NextResponse.json({ data: result.data });
});

export const POST = withAuth(async (req: NextRequest, { dbUserId }) => {
  try {
    const body = await req.json();
    const parsed = LogCpdSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 },
      );
    }

    const result = await clientCpdService.logCpdActivity({
      professionalId: dbUserId,
      ...parsed.data,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request payload", details: String(error) },
      { status: 400 },
    );
  }
});
