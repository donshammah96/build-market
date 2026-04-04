/**
 * Onboarding Client Facade
 *
 * Client-side interface for the onboarding API endpoints.
 * Replaces direct Server Action imports in "use client" hooks.
 */
import { API_ROUTES } from "@/lib/links";
import { apiFetch } from "@/lib/api-client-utils";
import type { ApiResponse, OnboardingData } from "@build/types";

export type OnboardingSubmitPayload = {
  userId: string;
  role: "CLIENT" | "PROFESSIONAL";
  isProfileComplete: boolean;
};

export const onboardingClient = {
  /**
   * Complete the user onboarding process
   * Equivalent to `submitOnboarding`
   */
  async submit(data: OnboardingData): Promise<ApiResponse<OnboardingSubmitPayload>> {
    return apiFetch<OnboardingSubmitPayload>(API_ROUTES.onboarding, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async uploadFiles(
    files: File[],
    fieldName: string,
    signal?: AbortSignal,
  ): Promise<ApiResponse<Array<{ uploadId: string; previewUrl: string }>>> {
    try {
      const form = new FormData();
      files.forEach((file) => form.append(fieldName, file));

      const response = await fetch(API_ROUTES.onboardingUploads, {
        method: "POST",
        body: form,
        signal,
      });
      const json = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          success: false,
          error:
            json?.error?.message ||
            json?.error ||
            json?.message ||
            `Upload failed with status ${response.status}`,
        };
      }

      const uploaded =
        json?.data?.uploaded?.[fieldName] ?? json?.uploaded?.[fieldName] ?? [];

      return {
        success: true,
        data: Array.isArray(uploaded)
          ? uploaded
              .filter(
                (
                  item,
                ): item is { uploadId?: string; previewUrl?: string | null } =>
                  typeof item === "object" && item !== null,
              )
              .map((item) => ({
                uploadId:
                  typeof item.uploadId === "string" ? item.uploadId : "",
                previewUrl:
                  typeof item.previewUrl === "string" ? item.previewUrl : "",
              }))
              .filter((item) => item.uploadId)
          : [],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },

  /**
   * Skip the onboarding process for homeowners
   * Equivalent to `skipOnboarding`
   */
  async skipClient(): Promise<
    ApiResponse<{
      userId: string;
      role: "CLIENT" | "PROFESSIONAL";
      isProfileComplete: boolean;
      redirectTo: string;
    }>
  > {
    return apiFetch<{
      userId: string;
      role: "CLIENT" | "PROFESSIONAL";
      isProfileComplete: boolean;
      redirectTo: string;
    }>(API_ROUTES.onboardingSkip, { method: "POST" });
  },

  /**
   * Skip the onboarding process for professionals
   * Equivalent to `skipProfessionalOnboarding`
   */
  async skipProfessional(): Promise<
    ApiResponse<{
      userId: string;
      role: "CLIENT" | "PROFESSIONAL";
      isProfileComplete: boolean;
      redirectTo: string;
    }>
  > {
    return apiFetch<{
      userId: string;
      role: "CLIENT" | "PROFESSIONAL";
      isProfileComplete: boolean;
      redirectTo: string;
    }>(API_ROUTES.onboardingSkipProfessional, { method: "POST" });
  },
};
