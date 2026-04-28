"use client";

import { useEffect, useState } from "react";

/**
 * Renders a locale-formatted number only after mount to avoid hydration mismatch.
 * toLocaleString() can differ between server and client (locale, number format).
 */
export function ClientNumber({
  value,
  prefix = "",
  fallback = "—",
}: {
  value: number | null | undefined;
  prefix?: string;
  fallback?: string;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (value === null || value === undefined || typeof value !== "number") {
    return <>{fallback}</>;
  }

  if (Number.isNaN(value)) {
    return <>{fallback}</>;
  }

  if (!mounted || typeof window === "undefined") {
    return (
      <>
        {prefix}
        {value.toFixed(2)}
      </>
    );
  }

  return (
    <>
      {prefix}
      {value.toLocaleString()}
    </>
  );
}
