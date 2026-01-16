'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';

/**
 * Expected Clerk public metadata structure for onboarding
 */
export interface ClerkOnboardingMetadata {
  role?: 'client' | 'professional';
  isOnboarded?: boolean;
}

interface UseClerkMetadataSyncOptions {
  /** Maximum number of polling attempts */
  maxAttempts?: number;
  /** Delay between polling attempts (ms) */
  pollIntervalMs?: number;
  /** Fields to check for in metadata */
  requiredFields?: (keyof ClerkOnboardingMetadata)[];
  /** If true, starts polling immediately */
  autoStart?: boolean;
}

interface UseClerkMetadataSyncResult {
  /** Current metadata state */
  metadata: ClerkOnboardingMetadata | null;
  /** Whether metadata has synced with expected values */
  isSynced: boolean;
  /** Whether currently polling */
  isPolling: boolean;
  /** Error if polling failed */
  error: string | null;
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
  /** Start polling for metadata sync */
  startPolling: () => void;
  /** Stop polling */
  stopPolling: () => void;
}

/**
 * Hook to poll Clerk metadata until it contains expected values.
 * 
 * This helps prevent redirect loops that can occur when Clerk metadata
 * propagation is delayed after updating user metadata server-side.
 * 
 * @example
 * ```tsx
 * const { isSynced, isPolling, metadata } = useClerkMetadataSync({
 *   requiredFields: ['isOnboarded', 'role'],
 *   autoStart: true,
 * });
 * 
 * if (!isSynced && isPolling) {
 *   return <LoadingSpinner message="Syncing your profile..." />;
 * }
 * ```
 */
export function useClerkMetadataSync({
  maxAttempts = 10,
  pollIntervalMs = 1000,
  requiredFields = ['isOnboarded'],
  autoStart = false,
}: UseClerkMetadataSyncOptions = {}): UseClerkMetadataSyncResult {
  const { user, isLoaded } = useUser();
  
  const [metadata, setMetadata] = useState<ClerkOnboardingMetadata | null>(null);
  const [isSynced, setIsSynced] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [shouldPoll, setShouldPoll] = useState(autoStart);

  // Check if metadata has all required fields
  const checkMetadataSync = useCallback((meta: ClerkOnboardingMetadata | null): boolean => {
    if (!meta) return false;
    
    return requiredFields.every(field => {
      const value = meta[field];
      return value !== undefined && value !== null;
    });
  }, [requiredFields]);

  // Refresh user to get latest metadata
  const refresh = useCallback(async () => {
    if (!user) return;
    
    try {
      await user.reload();
      const newMeta = user.publicMetadata as ClerkOnboardingMetadata;
      setMetadata(newMeta);
      setIsSynced(checkMetadataSync(newMeta));
    } catch (err) {
      console.warn('Failed to refresh Clerk user:', err);
      setError('Failed to sync profile. Please refresh the page.');
    }
  }, [user, checkMetadataSync]);

  // Start polling
  const startPolling = useCallback(() => {
    setAttempts(0);
    setError(null);
    setShouldPoll(true);
    setIsPolling(true);
  }, []);

  // Stop polling
  const stopPolling = useCallback(() => {
    setShouldPoll(false);
    setIsPolling(false);
  }, []);

  // Initial sync check
  useEffect(() => {
    if (isLoaded && user) {
      const meta = user.publicMetadata as ClerkOnboardingMetadata;
      setMetadata(meta);
      const synced = checkMetadataSync(meta);
      setIsSynced(synced);
      
      // If already synced, no need to poll
      if (synced) {
        setShouldPoll(false);
        setIsPolling(false);
      }
    }
  }, [isLoaded, user, checkMetadataSync]);

  // Polling effect
  useEffect(() => {
    if (!shouldPoll || !user || isSynced) {
      return;
    }

    if (attempts >= maxAttempts) {
      setError(`Metadata sync timed out after ${maxAttempts} attempts. Please refresh.`);
      setIsPolling(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        await user.reload();
        const meta = user.publicMetadata as ClerkOnboardingMetadata;
        setMetadata(meta);
        
        if (checkMetadataSync(meta)) {
          setIsSynced(true);
          setIsPolling(false);
          setShouldPoll(false);
        } else {
          setAttempts(prev => prev + 1);
        }
      } catch (err) {
        console.warn('Metadata poll failed:', err);
        setAttempts(prev => prev + 1);
      }
    }, pollIntervalMs);

    return () => clearTimeout(timeoutId);
  }, [shouldPoll, user, isSynced, attempts, maxAttempts, pollIntervalMs, checkMetadataSync]);

  return {
    metadata,
    isSynced,
    isPolling,
    error,
    refresh,
    startPolling,
    stopPolling,
  };
}

export default useClerkMetadataSync;
