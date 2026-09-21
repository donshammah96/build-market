"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function RouteFocusManager() {
  const pathname = usePathname();
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip on initial mount: focusing #main-content on first load steals
    // focus away from wherever the browser/assistive tech naturally placed
    // it (address bar, a skip link target, etc.). Only shift focus on
    // subsequent client-side route changes, where it's the expected and
    // helpful behavior for screen reader / keyboard users.
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const mainContent = document.getElementById("main-content");
    if (!mainContent) {
      return;
    }

    mainContent.focus();
  }, [pathname]);

  return null;
}

export default RouteFocusManager;
