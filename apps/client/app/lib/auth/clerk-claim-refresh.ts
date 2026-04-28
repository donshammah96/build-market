import { normalizeRole } from "@/app/lib/security/roles";

export type ClaimRefreshRole = "client" | "professional";

export type ClerkPublicMetadataLike = {
  isOnboarded?: boolean;
  role?: unknown;
  profileId?: string;
};

type ClerkUserLike = {
  publicMetadata: ClerkPublicMetadataLike;
  reload: () => Promise<unknown>;
};

type GetTokenLike = (options?: {
  skipCache?: boolean;
}) => Promise<string | null>;

type WaitForClerkClaimRefreshOptions = {
  user: ClerkUserLike | null | undefined;
  getToken?: GetTokenLike;
  isReady: (metadata: ClerkPublicMetadataLike) => boolean;
  maxAttempts?: number;
  retryDelayMs?: number;
  onAttempt?: (attempt: number, maxAttempts: number) => void;
  onTransientFailure?: (source: "token_refresh" | "user_reload") => void;
};

type WaitForClerkClaimRefreshResult = {
  ok: boolean;
  metadata: ClerkPublicMetadataLike;
};

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_RETRY_DELAY_MS = 300;

export const CLERK_CLAIM_REFRESH_FAILURE_MESSAGE =
  "We couldn't confirm your refreshed session yet. Please retry.";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readMetadata(
  user: ClerkUserLike | null | undefined,
): ClerkPublicMetadataLike {
  return user?.publicMetadata ?? {};
}

export function hasExpectedOnboardingClaims(
  metadata: ClerkPublicMetadataLike,
  expectedRole: ClaimRefreshRole,
): boolean {
  return (
    metadata.isOnboarded === true &&
    normalizeRole(metadata.role) === normalizeRole(expectedRole)
  );
}

export function hasRoutableAuthClaims(
  metadata: ClerkPublicMetadataLike,
): boolean {
  return metadata.isOnboarded === true || !!normalizeRole(metadata.role);
}

export async function waitForClerkClaimRefresh(
  options: WaitForClerkClaimRefreshOptions,
): Promise<WaitForClerkClaimRefreshResult> {
  const {
    user,
    getToken,
    isReady,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    onAttempt,
    onTransientFailure,
  } = options;

  if (!user) {
    return {
      ok: false,
      metadata: {},
    };
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const currentMetadata = readMetadata(user);
    if (isReady(currentMetadata)) {
      return {
        ok: true,
        metadata: currentMetadata,
      };
    }

    onAttempt?.(attempt + 1, maxAttempts);

    if (getToken) {
      try {
        await getToken({ skipCache: true });
      } catch {
        onTransientFailure?.("token_refresh");
      }
    }

    try {
      await user.reload();
    } catch {
      onTransientFailure?.("user_reload");
    }

    const refreshedMetadata = readMetadata(user);
    if (isReady(refreshedMetadata)) {
      return {
        ok: true,
        metadata: refreshedMetadata,
      };
    }

    if (attempt < maxAttempts - 1) {
      await delay(retryDelayMs * Math.pow(1.5, attempt));
    }
  }

  return {
    ok: false,
    metadata: readMetadata(user),
  };
}
