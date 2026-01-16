'use client';

import { useState, useEffect, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';

// ============================================================================
// TYPES
// ============================================================================

export type ABTestVariant = 'A' | 'B';

export interface ABTestConfig {
  /** Unique experiment name */
  name: string;
  /** Split percentage for variant B (0-100, default 50) */
  splitPercentage?: number;
  /** If true, uses localStorage for anonymous users */
  allowAnonymous?: boolean;
}

export interface ABTestResult {
  /** The assigned variant */
  variant: ABTestVariant;
  /** Whether the test is loading (waiting for user) */
  isLoading: boolean;
  /** Track a conversion event */
  trackConversion: (eventName?: string) => void;
  /** Track a custom event */
  trackEvent: (eventName: string, data?: Record<string, unknown>) => void;
}

// ============================================================================
// STORAGE
// ============================================================================

const AB_TEST_STORAGE_KEY = 'ab_tests';

interface StoredABTests {
  [experimentName: string]: {
    variant: ABTestVariant;
    assignedAt: number;
  };
}

function getStoredTests(): StoredABTests {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(AB_TEST_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function storeTest(name: string, variant: ABTestVariant): void {
  if (typeof window === 'undefined') return;
  try {
    const tests = getStoredTests();
    tests[name] = { variant, assignedAt: Date.now() };
    localStorage.setItem(AB_TEST_STORAGE_KEY, JSON.stringify(tests));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// HASH FUNCTION
// ============================================================================

/**
 * Simple hash function for consistent variant assignment
 * Uses FNV-1a algorithm for deterministic hashing
 */
function hashString(str: string): number {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, keep as uint32
  }
  return hash;
}

/**
 * Assign variant based on user ID and experiment name
 */
function assignVariant(userId: string, experimentName: string, splitPercentage: number): ABTestVariant {
  const hashInput = `${experimentName}:${userId}`;
  const hash = hashString(hashInput);
  const bucket = hash % 100; // 0-99
  return bucket < splitPercentage ? 'B' : 'A';
}

// ============================================================================
// ANALYTICS INTEGRATION
// ============================================================================

/**
 * Track A/B test event to analytics
 * Integrate with your analytics provider (e.g., Google Analytics, Mixpanel, Amplitude)
 */
function trackABEvent(
  experimentName: string,
  variant: ABTestVariant,
  eventName: string,
  data?: Record<string, unknown>
) {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[A/B Test]', {
      experiment: experimentName,
      variant,
      event: eventName,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  // Google Analytics 4 (if available)
  if (typeof window !== 'undefined' && 'gtag' in window) {
    (window as { gtag?: (cmd: string, event: string, params: Record<string, unknown>) => void }).gtag?.(
      'event',
      `ab_${experimentName}_${eventName}`,
      {
        ab_variant: variant,
        ab_experiment: experimentName,
        ...data,
      }
    );
  }

  // Store event for later analysis
  if (typeof window !== 'undefined') {
    try {
      const eventsKey = `ab_events_${experimentName}`;
      const events = JSON.parse(localStorage.getItem(eventsKey) || '[]');
      events.push({
        variant,
        event: eventName,
        data,
        timestamp: Date.now(),
      });
      // Keep last 100 events per experiment
      localStorage.setItem(eventsKey, JSON.stringify(events.slice(-100)));
    } catch {
      // Ignore storage errors
    }
  }
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * A/B Testing Hook
 * 
 * Assigns users to test variants consistently based on their user ID.
 * Tracks exposure and conversion events.
 * 
 * @example
 * ```tsx
 * const { variant, trackConversion } = useABTest({ name: 'onboarding_skip' });
 * 
 * // Show different UI based on variant
 * if (variant === 'B') {
 *   return <SkipButton onClick={() => { handleSkip(); trackConversion(); }} />;
 * }
 * 
 * // Variant A: full form only
 * return <FullForm />;
 * ```
 */
export function useABTest({
  name,
  splitPercentage = 50,
  allowAnonymous = true,
}: ABTestConfig): ABTestResult {
  const { user, isLoaded } = useUser();
  const [variant, setVariant] = useState<ABTestVariant>('A');
  const [isLoading, setIsLoading] = useState(true);
  const [hasTrackedExposure, setHasTrackedExposure] = useState(false);

  // Assign variant when user is loaded
  useEffect(() => {
    if (!isLoaded) return;

    let assignedVariant: ABTestVariant = 'A';

    // Check if already assigned
    const stored = getStoredTests()[name];
    if (stored) {
      assignedVariant = stored.variant;
    } else if (user?.id) {
      // Assign based on user ID
      assignedVariant = assignVariant(user.id, name, splitPercentage);
      storeTest(name, assignedVariant);
    } else if (allowAnonymous) {
      // Anonymous user: generate random ID
      const anonymousId = `anon_${Math.random().toString(36).slice(2)}`;
      assignedVariant = assignVariant(anonymousId, name, splitPercentage);
      storeTest(name, assignedVariant);
    }

    setVariant(assignedVariant);
    setIsLoading(false);

    // Track exposure event (once per session)
    if (!hasTrackedExposure) {
      trackABEvent(name, assignedVariant, 'exposure', {
        userId: user?.id || 'anonymous',
      });
      setHasTrackedExposure(true);
    }
  }, [isLoaded, user?.id, name, splitPercentage, allowAnonymous, hasTrackedExposure]);

  // Track conversion helper
  const trackConversion = useMemo(() => (eventName = 'conversion') => {
    trackABEvent(name, variant, eventName, {
      userId: user?.id || 'anonymous',
    });
  }, [name, variant, user?.id]);

  // Track custom event helper
  const trackEvent = useMemo(() => (eventName: string, data?: Record<string, unknown>) => {
    trackABEvent(name, variant, eventName, {
      userId: user?.id || 'anonymous',
      ...data,
    });
  }, [name, variant, user?.id]);

  return {
    variant,
    isLoading,
    trackConversion,
    trackEvent,
  };
}

// ============================================================================
// UTILITY: Get A/B Test Results
// ============================================================================

/**
 * Get stored A/B test events for analysis
 */
export function getABTestEvents(experimentName: string): Array<{
  variant: ABTestVariant;
  event: string;
  data?: Record<string, unknown>;
  timestamp: number;
}> {
  if (typeof window === 'undefined') return [];
  try {
    const eventsKey = `ab_events_${experimentName}`;
    return JSON.parse(localStorage.getItem(eventsKey) || '[]');
  } catch {
    return [];
  }
}

/**
 * Calculate conversion rate from stored events
 */
export function calculateConversionRate(experimentName: string): {
  variantA: { exposures: number; conversions: number; rate: number };
  variantB: { exposures: number; conversions: number; rate: number };
} {
  const events = getABTestEvents(experimentName);
  
  const stats = {
    variantA: { exposures: 0, conversions: 0, rate: 0 },
    variantB: { exposures: 0, conversions: 0, rate: 0 },
  };

  for (const event of events) {
    const key = event.variant === 'A' ? 'variantA' : 'variantB';
    if (event.event === 'exposure') {
      stats[key].exposures++;
    } else if (event.event === 'conversion') {
      stats[key].conversions++;
    }
  }

  stats.variantA.rate = stats.variantA.exposures > 0 
    ? (stats.variantA.conversions / stats.variantA.exposures) * 100 
    : 0;
  stats.variantB.rate = stats.variantB.exposures > 0 
    ? (stats.variantB.conversions / stats.variantB.exposures) * 100 
    : 0;

  return stats;
}

export default useABTest;
