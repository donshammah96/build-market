"use client";

import React, { useEffect, useCallback, memo } from "react";
import { useAccessibilityStore } from "@/lib/stores/accessibilityStore";

interface AccessibilityProviderProps {
  children: React.ReactNode;
}

/**
 * AccessibilityProvider applies accessibility settings to the DOM
 * It adds CSS classes and custom properties to the html element
 * based on user preferences stored in the accessibility store.
 */
export const AccessibilityProvider = memo(function AccessibilityProvider({
  children,
}: AccessibilityProviderProps) {
  const {
    reduceMotion,
    reduceTransparency,
    highContrast,
    largeText,
    fontSize,
    enhancedFocus,
    colorBlindMode,
    dyslexiaFont,
    lineSpacing,
    keyboardShortcuts,
  } = useAccessibilityStore();

  // Apply settings to DOM
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    // Reduce Motion
    if (reduceMotion === "on") {
      html.classList.add("reduce-motion");
      html.style.setProperty("--animation-duration", "0.01ms");
    } else if (reduceMotion === "off") {
      html.classList.remove("reduce-motion");
      html.style.removeProperty("--animation-duration");
    } else {
      // System preference
      html.classList.remove("reduce-motion");
      html.style.removeProperty("--animation-duration");
    }

    // Reduce Transparency
    html.classList.toggle("reduce-transparency", reduceTransparency);

    // High Contrast
    html.classList.toggle("high-contrast", highContrast);

    // Large Text
    html.classList.toggle("large-text", largeText);

    // Font Size
    html.style.setProperty("--user-font-scale", `${fontSize / 100}`);
    body.style.fontSize = `calc(1rem * ${fontSize / 100})`;

    // Enhanced Focus
    html.classList.toggle("enhanced-focus", enhancedFocus);

    // Color Blind Mode
    html.setAttribute("data-color-blind-mode", colorBlindMode);

    // Dyslexia Font
    html.classList.toggle("dyslexia-font", dyslexiaFont);

    // Line Spacing
    html.setAttribute("data-line-spacing", lineSpacing);

    // Cleanup
    return () => {
      html.classList.remove(
        "reduce-motion",
        "reduce-transparency",
        "high-contrast",
        "large-text",
        "enhanced-focus",
        "dyslexia-font",
      );
      html.removeAttribute("data-color-blind-mode");
      html.removeAttribute("data-line-spacing");
      html.style.removeProperty("--user-font-scale");
      html.style.removeProperty("--animation-duration");
      body.style.fontSize = "";
    };
  }, [
    reduceMotion,
    reduceTransparency,
    highContrast,
    largeText,
    fontSize,
    enhancedFocus,
    colorBlindMode,
    dyslexiaFont,
    lineSpacing,
  ]);

  // Keyboard shortcut handler (Alt + A opens accessibility settings)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!keyboardShortcuts) return;

      // Alt + A to open accessibility settings
      if (event.altKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        // Find and click the accessibility button
        const accessibilityButton = document.querySelector(
          '[aria-label="Accessibility settings"]',
        ) as HTMLButtonElement;
        if (accessibilityButton) {
          accessibilityButton.click();
        }
      }

      // Escape to close any open dialogs (useful for keyboard users)
      if (event.key === "Escape") {
        const openDialog = document.querySelector('[role="dialog"]');
        if (openDialog) {
          const closeButton = openDialog.querySelector(
            '[aria-label="Close"]',
          ) as HTMLButtonElement;
          if (closeButton) {
            closeButton.click();
          }
        }
      }
    },
    [keyboardShortcuts],
  );

  // Attach keyboard listeners
  useEffect(() => {
    if (keyboardShortcuts) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [keyboardShortcuts, handleKeyDown]);

  // Skip link functionality for keyboard users
  useEffect(() => {
    // Check if skip link already exists
    if (document.getElementById("skip-to-content")) return;

    // Create skip link
    const skipLink = document.createElement("a");
    skipLink.id = "skip-to-content";
    skipLink.href = "#main-content";
    skipLink.className =
      "skip-link sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-emerald-600 focus:text-white focus:rounded-md focus:outline-none";
    skipLink.textContent = "Skip to main content";

    document.body.insertBefore(skipLink, document.body.firstChild);

    return () => {
      const existingLink = document.getElementById("skip-to-content");
      if (existingLink) {
        existingLink.remove();
      }
    };
  }, []);

  return <>{children}</>;
});

export default AccessibilityProvider;
