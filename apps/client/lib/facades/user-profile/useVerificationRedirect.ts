"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useMyStores } from "../stores/useStores";
import { useMyProperties } from "../properties/useProperties";
import { profileClient } from "./profile-client";

// ─── Query Keys ─────────────────────────────────────────────────────────

export const verificationKeys = {
  professionalProfile: () => ["verification", "professional-profile"] as const,
};

/**
 * Hook to redirect users to appropriate pages if they have pending/rejected verification items.
 * Only runs redirects once data is loaded; skips when queries are still loading or have failed.
 */
export function useVerificationRedirect() {
  const router = useRouter();
  const { data: storesRaw = [], isLoading: storesLoading } = useMyStores();
  const stores = storesRaw as Array<{
    verificationStatus?: string;
    [k: string]: unknown;
  }>;
  const { data: propertiesPayload, isLoading: propertiesLoading } =
    useMyProperties({ status: "all", limit: 50 });
  const propertiesRaw = useMemo(
    () => propertiesPayload?.properties ?? [],
    [propertiesPayload],
  );
  const properties = propertiesRaw as Array<{
    verificationStatus?: string;
    [k: string]: unknown;
  }>;

  // Check professional verification status
  const {
    data: professionalProfile,
    isLoading: profileLoading,
    isError: profileError,
  } = useQuery({
    queryKey: verificationKeys.professionalProfile(),
    queryFn: async () => {
      const res = await profileClient.getOwnProfile();
      if (!res.success) return null;
      return res.data ?? null;
    },
  });

  const isLoading = storesLoading || propertiesLoading || profileLoading;

  useEffect(() => {
    if (isLoading || profileError) return;
    // Check professional verification
    if (professionalProfile) {
      const status = professionalProfile.verificationStatus;
      if (status === "REJECTED" || status === "NEEDS_CORRECTION") {
        router.push(
          "/professional-portal/settings/complete-profile?tab=verification&status=rejected",
        );
        return;
      }
      if (status === "PENDING") {
        router.push(
          "/professional-portal/settings/complete-profile?tab=verification&status=pending",
        );
        return;
      }
    }

    // Check properties verification
    const rejectedProperty = properties.find(
      (p) =>
        p.verificationStatus === "REJECTED" ||
        p.verificationStatus === "NEEDS_CORRECTION",
    );
    if (rejectedProperty) {
      router.push(
        "/professional-portal/settings/properties?tab=verification&status=rejected",
      );
      return;
    }

    const pendingProperty = properties.find(
      (p) => p.verificationStatus === "PENDING",
    );
    if (pendingProperty) {
      router.push(
        "/professional-portal/settings/properties?tab=verification&status=pending",
      );
      return;
    }

    // Check stores verification
    const rejectedStore = stores.find(
      (s) =>
        s.verificationStatus === "REJECTED" ||
        s.verificationStatus === "NEEDS_CORRECTION",
    );
    if (rejectedStore) {
      router.push(
        "/professional-portal/settings/stores?tab=verification&status=rejected",
      );
      return;
    }

    const pendingStore = stores.find((s) => s.verificationStatus === "PENDING");
    if (pendingStore) {
      router.push(
        "/professional-portal/settings/stores?tab=verification&status=pending",
      );
      return;
    }
  }, [
    professionalProfile,
    properties,
    stores,
    router,
    isLoading,
    profileError,
  ]);
}
