/**
 * Onboarding Client Facade
 *
 * Client-side interface for the onboarding API endpoints.
 * Replaces direct Server Action imports in "use client" hooks.
 */
import { API_ROUTES } from "@/lib/links";
import { apiFetch } from "@/lib/api-client-utils";
import type { ApiResponse, OnboardingData } from "@build/types";

export const onboardingClient = {
  /**
   * Complete the user onboarding process
   * Equivalent to `submitOnboarding`
   */
  async submit(
    data: OnboardingData & { clerkId?: string },
  ): Promise<ApiResponse<unknown>> {
    return apiFetch<unknown>(API_ROUTES.onboarding, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Skip the onboarding process for homeowners
   * Equivalent to `skipOnboarding`
   */
  async skipClient(): Promise<
    ApiResponse<{
      userId: string;
      role: string;
      isProfileComplete: boolean;
      redirectTo: string;
    }>
  > {
    return apiFetch<{
      userId: string;
      role: string;
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
      role: string;
      isProfileComplete: boolean;
      redirectTo: string;
    }>
  > {
    return apiFetch<{
      userId: string;
      role: string;
      isProfileComplete: boolean;
      redirectTo: string;
    }>(API_ROUTES.onboardingSkipProfessional, { method: "POST" });
  },
};
