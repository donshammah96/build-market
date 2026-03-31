"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { envConfig } from "@/lib/env";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = envConfig.analytics.posthogKey;
    if (key && typeof window !== "undefined") {
      posthog.init(key, {
        api_host: envConfig.analytics.posthogHost,
        person_profiles: "identified_only",
      });
    }
  }, []);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
