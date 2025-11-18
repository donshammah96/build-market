import { ReactNode } from "react";
import { ProfessionalSidebar } from "@/components/layout/ProfessionalSidebar";

interface ProfessionalPortalLayoutProps {
  children: ReactNode;
}

export default function ProfessionalPortalLayout({ children }: ProfessionalPortalLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <ProfessionalSidebar />
      <main className="flex-1 lg:pl-64">
        {children}
      </main>
    </div>
  );
}

