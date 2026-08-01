import { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@build/db";
import { ProfessionalSidebar } from "@/components/layout/ProfessionalSidebar";
import { ProfessionalNavbar } from "@/components/layout/ProfessionalNavbar";
import { ProfileCompletionWidgetWrapper } from "@/components/shared/ProfileCompletionWidgetWrapper";
import { professionalReadinessService } from "@/app/lib/domains/professionals/readiness.service";

export default async function ProfessionalPortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { userId: clerkId } = await auth();

  let verified = false;
  let verificationStatus: string = "PENDING";
  let capabilities = undefined;

  if (clerkId) {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (user) {
      const readinessRes = await professionalReadinessService.getReadiness(
        user.id,
      );
      if (readinessRes.ok) {
        verified = readinessRes.data.verificationStatus === "VERIFIED";
        verificationStatus = readinessRes.data.verificationStatus;
        capabilities = readinessRes.data.capabilities;
      }
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Sidebar - Fixed Width */}
      <ProfessionalSidebar
        verified={verified}
        verificationStatus={verificationStatus}
        capabilities={capabilities}
      />

      {/* Main Content Area - Shifts right on Desktop */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        <ProfessionalNavbar />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</main>
      </div>

      {/* Floating Profile Completion Widget */}
      <ProfileCompletionWidgetWrapper />
    </div>
  );
}
