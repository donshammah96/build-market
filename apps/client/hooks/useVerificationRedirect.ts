"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

interface VerificationStatus {
  verificationStatus?:
    | "UNVERIFIED"
    | "PENDING"
    | "VERIFIED"
    | "REJECTED"
    | "NEEDS_CORRECTION";
  rejectionReason?: string | null;
}

/**
 * Hook to redirect users to appropriate pages if they have pending/rejected verification items
 */
export function useVerificationRedirect() {
  const router = useRouter();

  // Check professional verification status
  const { data: professionalProfile } = useQuery({
    queryKey: ["professional-profile"],
    queryFn: async () => {
      const res = await fetch("/api/professional-portal/profile");
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Check properties verification status
  const { data: propertiesData } = useQuery<{ data: VerificationStatus[] }>({
    queryKey: ["property-verification-status"],
    queryFn: async () => {
      const res = await fetch(
        "/api/properties/my-listings?status=all&limit=50"
      );
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });

  // Check stores verification status
  const { data: storesData } = useQuery<{ data: VerificationStatus[] }>({
    queryKey: ["store-verification-status"],
    queryFn: async () => {
      const res = await fetch("/api/stores/my-stores");
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });

  useEffect(() => {
    // Check professional verification
    if (professionalProfile) {
      const status = professionalProfile.status;
      if (status === "REJECTED" || status === "NEEDS_CORRECTION") {
        router.push(
          "/professional-portal/settings/complete-profile?tab=verification&status=rejected"
        );
        return;
      }
      if (status === "PENDING") {
        router.push(
          "/professional-portal/settings/complete-profile?tab=verification&status=pending"
        );
        return;
      }
    }

    // Check properties verification
    const properties = propertiesData?.data || [];
    const rejectedProperty = properties.find(
      (p) =>
        p.verificationStatus === "REJECTED" ||
        p.verificationStatus === "NEEDS_CORRECTION"
    );
    if (rejectedProperty) {
      router.push(
        "/professional-portal/settings/properties?tab=verification&status=rejected"
      );
      return;
    }

    const pendingProperty = properties.find(
      (p) => p.verificationStatus === "PENDING"
    );
    if (pendingProperty) {
      router.push(
        "/professional-portal/settings/properties?tab=verification&status=pending"
      );
      return;
    }

    // Check stores verification
    const stores = storesData?.data || [];
    const rejectedStore = stores.find(
      (s) =>
        s.verificationStatus === "REJECTED" ||
        s.verificationStatus === "NEEDS_CORRECTION"
    );
    if (rejectedStore) {
      router.push(
        "/professional-portal/settings/stores?tab=verification&status=rejected"
      );
      return;
    }

    const pendingStore = stores.find((s) => s.verificationStatus === "PENDING");
    if (pendingStore) {
      router.push(
        "/professional-portal/settings/stores?tab=verification&status=pending"
      );
      return;
    }
  }, [professionalProfile, propertiesData, storesData, router]);
}
