import { notFound } from "next/navigation";
import { env } from "@/app/lib/infrastructure/env";
import OnboardingPreviewClient from "./onboarding-preview-client";

export default function OnboardingPreviewPage() {
  if (!env.isDev) {
    notFound();
  }

  return <OnboardingPreviewClient />;
}
