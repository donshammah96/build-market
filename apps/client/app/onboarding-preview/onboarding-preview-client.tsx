"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OnboardingData } from "@build/types";
import {
  OnboardingView,
  type OnboardingRole,
} from "@/app/onboarding/_components/OnboardingView";

const PREVIEW_DELAY_MS = 350;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function toUrl(input: RequestInfo | URL): URL | null {
  if (typeof input === "string") {
    return new URL(input, window.location.origin);
  }
  if (input instanceof URL) {
    return input;
  }
  if (input instanceof Request) {
    return new URL(input.url, window.location.origin);
  }
  return null;
}

export default function OnboardingPreviewClient() {
  const originalFetchRef = useRef<typeof globalThis.fetch | null>(null);
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<OnboardingRole | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mockApiEnabled, setMockApiEnabled] = useState(true);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [previewNote, setPreviewNote] = useState(
    "Preview mode: no auth checks and no onboarding network calls.",
  );

  useEffect(() => {
    if (!originalFetchRef.current) {
      originalFetchRef.current = globalThis.fetch;
    }

    const originalFetch = originalFetchRef.current;

    if (!mockApiEnabled) {
      globalThis.fetch = originalFetch;
      return () => {
        globalThis.fetch = originalFetch;
      };
    }

    globalThis.fetch = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const url = toUrl(input);
      if (!url || !url.pathname.startsWith("/api/onboarding")) {
        return originalFetch(input, init);
      }

      if (url.pathname === "/api/onboarding/uploads") {
        const body = init?.body;
        const formData = body instanceof FormData ? body : null;
        const fieldName = formData
          ? (Array.from(formData.keys())[0] ?? "uploads")
          : "uploads";

        return createJsonResponse({
          success: true,
          data: {
            uploaded: {
              [fieldName]: [
                {
                  uploadId: `preview-${Date.now()}`,
                  previewUrl: "",
                },
              ],
            },
          },
        });
      }

      return createJsonResponse({
        success: true,
        data: {
          userId: "preview-user",
          role: "PROFESSIONAL",
          isProfileComplete: true,
          redirectTo: "/dashboard",
        },
      });
    };

    return () => {
      globalThis.fetch = originalFetch;
    };
  }, [mockApiEnabled]);

  const toggleMockApi = useCallback(() => {
    setMockApiEnabled((previous) => {
      const next = !previous;
      setPreviewNote(
        next
          ? "Mock onboarding API enabled for preview route."
          : "Mock onboarding API disabled. Preview submit handlers still run locally.",
      );
      return next;
    });
  }, []);

  const runPreviewAction = useCallback(async (note: string) => {
    setSubmitting(true);
    await sleep(PREVIEW_DELAY_MS);
    setSubmitting(false);
    setPreviewNote(note);
  }, []);

  const handleRoleSelect = useCallback((selectedRole: OnboardingRole) => {
    setRole(selectedRole);
    setStep(2);
    setPreviewNote(`Previewing ${selectedRole} onboarding step.`);
  }, []);

  const handleCancelOnboarding = useCallback(async () => {
    setShowCancelDialog(false);
    setRole(null);
    setStep(1);
    setSubmitting(false);
    setPreviewNote("Preview reset to role selection.");
  }, []);

  const handleSkip = useCallback(
    async (roleToSkip: OnboardingRole) => {
      await runPreviewAction(
        `Skip action intercepted in preview mode for ${roleToSkip}.`,
      );
    },
    [runPreviewAction],
  );

  const handleSubmit = useCallback(
    async (data: OnboardingData) => {
      void data;
      await runPreviewAction("Submit action intercepted in preview mode.");
    },
    [runPreviewAction],
  );

  return (
    <div>
      <div className="sticky top-0 z-50 border-b border-onboarding-primary/20 bg-onboarding-surface/95 px-4 py-3 backdrop-blur-md md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-onboarding-ink/85">{previewNote}</p>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                mockApiEnabled
                  ? "border-emerald-300/40 bg-emerald-500/15 text-emerald-200"
                  : "border-zinc-400/40 bg-zinc-500/15 text-zinc-200"
              }`}
            >
              Mock API {mockApiEnabled ? "On" : "Off"}
            </span>
            <button
              type="button"
              aria-pressed={mockApiEnabled}
              onClick={toggleMockApi}
              className="min-h-9 rounded-md border border-onboarding-primary/30 px-3 text-xs font-semibold text-onboarding-ink/85 transition-colors hover:bg-onboarding-primary/15 focus-visible:outline-2 focus-visible:outline-(--color-focus-ring) focus-visible:outline-offset-2"
            >
              Toggle
            </button>
          </div>
        </div>
      </div>
      <OnboardingView
        step={step}
        setStep={setStep}
        role={role}
        submitting={submitting}
        showCancelDialog={showCancelDialog}
        setShowCancelDialog={setShowCancelDialog}
        handleRoleSelect={handleRoleSelect}
        handleCancelOnboarding={handleCancelOnboarding}
        handleSkip={handleSkip}
        handleSubmit={handleSubmit}
      />
    </div>
  );
}
