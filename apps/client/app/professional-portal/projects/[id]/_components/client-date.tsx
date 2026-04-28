"use client";

import { useEffect, useState } from "react";

/**
 * Renders a locale-formatted date only after mount to avoid hydration mismatch.
 * toLocaleDateString() can differ between server and client (locale, timezone).
 */
export function ClientDate({
  isoDate,
  fallback = "TBD",
}: {
  isoDate: string | null | undefined;
  fallback?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isoDate || typeof isoDate !== "string") {
    return <>{fallback}</>;
  }

  if (!mounted || typeof window === "undefined") {
    return <>{isoDate.slice(0, 10)}</>;
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return <>{fallback}</>;
  }

  return <>{date.toLocaleDateString()}</>;
}
