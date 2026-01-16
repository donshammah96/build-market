"use client";

import { useProfileCompletion } from "@/hooks/useProfileStatus";
import { ProfileCompletionWidget } from "./ProfileCompletionWidget";

/**
 * Client-side wrapper for ProfileCompletionWidget
 * Fetches profile completion data and renders the floating widget
 */
export function ProfileCompletionWidgetWrapper() {
  const {
    percentage,
    isComplete,
    missingRequiredLabels,
    isLoading,
  } = useProfileCompletion();

  // Don't render while loading or if complete
  if (isLoading || isComplete) {
    return null;
  }

  return (
    <ProfileCompletionWidget
      percentage={percentage}
      isComplete={isComplete}
      missingItems={missingRequiredLabels}
    />
  );
}

export default ProfileCompletionWidgetWrapper;
