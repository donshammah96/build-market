import { NextRequest, NextResponse } from "next/server";
import { ComplianceService } from "@/lib/gdpr/services/compliance.service";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { adminEnvConfig } from "@/lib/infrastructure/env";

// Only accessible by ADMIN
export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    // Assuming session has role or we fetch user to check role
    if (!clerkId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { role: true, id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (user.role !== "ADMIN") {
      // For development: Allow if DEV_ADMIN_BYPASS is set
      const isDev = adminEnvConfig.NODE_ENV === "development";
      const devBypass = adminEnvConfig.DEV_ADMIN_BYPASS;

      if (!isDev || !devBypass) {
        console.warn(`Unauthorized access attempt by ${clerkId}`);
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      console.warn(`[DEV BYPASS] Unauthorized access attempt by ${clerkId}`);
    }

    const { searchParams } = new URL(req.url);
    const actorId = searchParams.get("actorId") || undefined;

    const logs = await ComplianceService.getAuditLogs(
      actorId ? { actorId } : {},
    );

    // Log THIS access
    await ComplianceService.logAdminAction(
      user.id,
      "DATA_ACCESS_BY_ADMIN",
      "AuditLog",
      "report",
      { query: searchParams.toString() },
    );

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Audit log fetch error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
