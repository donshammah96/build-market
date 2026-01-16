import { ReactNode } from "react";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@repo/db";
import { ProfessionalSidebar } from "@/components/layout/ProfessionalSidebar";
import { ProfessionalNavbar } from "@/components/layout/ProfessionalNavbar";
import { ProfileCompletionWidgetWrapper } from "@/components/shared/ProfileCompletionWidgetWrapper";

export default async function ProfessionalPortalLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();
  
  let verified = false;
  if (userId) {
    const profile = await prisma.professionalProfile.findUnique({
      where: { userId },
      select: { verified: true }
    });
    verified = profile?.verified ?? false;
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Sidebar - Fixed Width */}
      <ProfessionalSidebar verified={verified} />

      {/* Main Content Area - Shifts right on Desktop */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        <ProfessionalNavbar />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Floating Profile Completion Widget */}
      <ProfileCompletionWidgetWrapper />
    </div>
  );
}
