"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { env } from "@/app/lib/infrastructure/env";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = env.analytics.posthogKey;
    if (key && typeof window !== "undefined") {
      posthog.init(key, {
        api_host: env.analytics.posthogHost,
        person_profiles: "identified_only",
      });
    }
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
