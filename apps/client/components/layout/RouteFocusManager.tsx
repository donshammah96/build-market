"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function RouteFocusManager() {
  const pathname = usePathname();

  useEffect(() => {
    const mainContent = document.getElementById("main-content");
    if (!mainContent) {
      return;
    }

    mainContent.focus();
  }, [pathname]);

  return null;
}

export default RouteFocusManager;
