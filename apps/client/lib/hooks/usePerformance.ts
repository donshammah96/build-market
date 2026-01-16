import { useState, useEffect, useRef } from "react";
import { useAccessibilityStore } from "@/lib/stores/accessibilityStore";

/**
 * Hook to detect user's reduced motion preference
 * Combines system preference with user's accessibility settings
 * Returns true if user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  const [systemPrefersReducedMotion, setSystemPrefersReducedMotion] =
    useState(false);
  const userReduceMotion = useAccessibilityStore((state) => state.reduceMotion);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystemPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // User setting takes precedence over system setting
  if (userReduceMotion === "on") return true;
  if (userReduceMotion === "off") return false;
  // "system" - use system preference
  return systemPrefersReducedMotion;
}

/**
 * Hook to get user's high contrast preference
 */
export function useHighContrast(): boolean {
  const [systemHighContrast, setSystemHighContrast] = useState(false);
  const userHighContrast = useAccessibilityStore((state) => state.highContrast);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-contrast: more)");
    setSystemHighContrast(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setSystemHighContrast(event.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  // User setting takes precedence
  return userHighContrast || systemHighContrast;
}

/**
 * Throttle function that limits how often a callback can be executed
 */
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Hook for throttled scroll position tracking
 * Much more performant than raw scroll listeners
 */
export function useThrottledScroll(threshold: number = 20): boolean {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = throttle(() => {
      setIsScrolled(window.scrollY > threshold);
    }, 100); // Throttle to 100ms (10fps) - sufficient for scroll detection

    // Check initial scroll position
    setIsScrolled(window.scrollY > threshold);

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [threshold]);

  return isScrolled;
}

/**
 * Hook for Intersection Observer - detects when element enters viewport
 * More performant than scroll-based detection
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.isIntersecting) {
          setIsIntersecting(true);
          // Once visible, disconnect - we don't need to observe anymore
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: "-50px",
        ...options,
      }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [options]);

  return [ref, isIntersecting];
}

/**
 * Simple debounce hook for values
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook to detect slow network/device
 * Useful for disabling animations on slow devices
 */
export function useSlowDevice(): boolean {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    // Check for slow connection
    const connection = (
      navigator as Navigator & {
        connection?: { effectiveType?: string; saveData?: boolean };
      }
    ).connection;

    if (connection) {
      const isSlowConnection =
        connection.effectiveType === "2g" ||
        connection.effectiveType === "slow-2g" ||
        connection.saveData === true;

      if (isSlowConnection) {
        setIsSlow(true);
        return;
      }
    }

    // Check for low memory (if available)
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number })
      .deviceMemory;
    if (deviceMemory && deviceMemory < 4) {
      setIsSlow(true);
      return;
    }

    // Check for hardware concurrency (CPU cores)
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
      setIsSlow(true);
    }
  }, []);

  return isSlow;
}

/**
 * Combined hook for animation decision
 * Returns whether animations should be enabled based on:
 * 1. User's accessibility settings (highest priority)
 * 2. System preferences
 * 3. Device capability
 */
export function useShouldAnimate(): boolean {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isSlowDevice = useSlowDevice();

  return !prefersReducedMotion && !isSlowDevice;
}

/**
 * Hook to get user's font size preference
 * Returns the scale factor (1 = 100%, 1.25 = 125%, etc.)
 */
export function useFontScale(): number {
  const fontSize = useAccessibilityStore((state) => state.fontSize);
  return fontSize / 100;
}

/**
 * Hook to check if enhanced focus indicators should be shown
 */
export function useEnhancedFocus(): boolean {
  return useAccessibilityStore((state) => state.enhancedFocus);
}

/**
 * Hook to check if keyboard shortcuts are enabled
 */
export function useKeyboardShortcuts(): boolean {
  return useAccessibilityStore((state) => state.keyboardShortcuts);
}

/**
 * Hook for accessibility-aware class names
 * Returns additional classes based on user's accessibility preferences
 */
export function useAccessibilityClasses(): string {
  const prefersReducedMotion = usePrefersReducedMotion();
  const highContrast = useHighContrast();
  const enhancedFocus = useEnhancedFocus();

  const classes: string[] = [];

  if (prefersReducedMotion) {
    classes.push("motion-reduce");
  }

  if (highContrast) {
    classes.push("high-contrast");
  }

  if (enhancedFocus) {
    classes.push("focus-enhanced");
  }

  return classes.join(" ");
}
