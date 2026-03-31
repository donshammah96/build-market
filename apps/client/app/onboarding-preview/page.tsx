import { notFound } from "next/navigation";
import { envConfig } from "@/app/lib/infrastructure/env";
import OnboardingPreviewClient from "./onboarding-preview-client";

export default function OnboardingPreviewPage() {
  if (!envConfig.isDev) {
    notFound();
  }

  return <OnboardingPreviewClient />;
}
