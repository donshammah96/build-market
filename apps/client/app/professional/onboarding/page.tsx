import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/links";

export default function LegacyProfessionalOnboardingRedirect() {
  redirect(ROUTES.professionalOnboarding);
}
