import { z } from "zod";
import { UserRole, UserStatus } from "@build/db";

// ─── Clerk Webhook Payload Types ─────────────────────────────────────────────

/**
 * Clerk sends email addresses as an array with verification metadata.
 */
export interface ClerkEmailAddress {
  email_address: string;
  id: string;
  verification?: {
    status: "verified" | "unverified" | "expired";
    strategy?: string;
  };
}

export interface ClerkPhoneNumber {
  phone_number: string;
  id: string;
  verification?: {
    status: "verified" | "unverified" | "expired";
    strategy?: string;
  };
}

export interface ClerkPublicMetadata {
  role?: string;
  isOnboarded?: boolean;
  isVerified?: boolean;
  [key: string]: unknown;
}

export interface ClerkUserData {
  id: string;
  primary_email_address_id?: string;
  primary_phone_number_id?: string;
  email_addresses?: ClerkEmailAddress[];
  first_name?: string | null;
  last_name?: string | null;
  phone_numbers?: ClerkPhoneNumber[];
  image_url?: string | null;
  username?: string | null;
  public_metadata?: ClerkPublicMetadata;
  created_at?: number;
  updated_at?: number;
  last_sign_in_at?: number | null;
}

export interface ClerkSessionData {
  id: string;
  user_id: string;
  status: string;
  created_at?: number;
  last_active_at?: number;
}

/**
 * Supported Clerk webhook event types.
 */
export const HANDLED_EVENT_TYPES = [
  "user.created",
  "user.updated",
  "user.deleted",
  "session.created",
] as const;

export type HandledEventType = (typeof HANDLED_EVENT_TYPES)[number];

export interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserData | ClerkSessionData;
  object: "event";
}

// ─── Zod Validation ──────────────────────────────────────────────────────────

/**
 * Validates the core structure of a Clerk user payload after Svix verification.
 * We keep this intentionally loose — Clerk is the source of truth and may add fields.
 */
export const ClerkUserPayloadSchema = z.object({
  id: z.string().min(1, "Clerk user ID is required"),
  email_addresses: z
    .array(
      z.object({
        email_address: z.string().email(),
        id: z.string(),
        verification: z
          .object({
            status: z.enum(["verified", "unverified", "expired"]),
          })
          .optional(),
      }),
    )
    .optional(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  phone_numbers: z
    .array(
      z.object({
        phone_number: z.string(),
        id: z.string(),
        verification: z
          .object({
            status: z.enum(["verified", "unverified", "expired"]),
          })
          .optional(),
      }),
    )
    .optional(),
  image_url: z.string().url().nullish(),
  username: z.string().nullish(),
  public_metadata: z
    .object({
      role: z.string().optional(),
      isOnboarded: z.boolean().optional(),
      isVerified: z.boolean().optional(),
    })
    .passthrough()
    .optional(),
  last_sign_in_at: z.number().nullish(),
});

export const ClerkSessionPayloadSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  status: z.string(),
});

// ─── Role Resolution ─────────────────────────────────────────────────────────

const VALID_ROLES: Record<string, UserRole> = {
  CLIENT: UserRole.CLIENT,
  PROFESSIONAL: UserRole.PROFESSIONAL,
  ADMIN: UserRole.ADMIN,
  SUPPORT: UserRole.SUPPORT,
};

/**
 * Resolves a Clerk metadata role string to a Prisma UserRole enum.
 * Returns undefined if the role string is not recognized.
 */
export function resolveUserRole(roleStr?: string): UserRole | undefined {
  if (!roleStr) return undefined;
  return VALID_ROLES[roleStr.toUpperCase()];
}

// ─── Display Name ────────────────────────────────────────────────────────────

/**
 * Computes a displayName from first + last name, matching the schema's
 * `displayName String?` field.
 */
export function computeDisplayName(
  firstName?: string | null,
  lastName?: string | null,
): string | null {
  const parts = [firstName, lastName].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

// ─── Prisma Select Objects (data minimization) ──────────────────────────────

/**
 * Minimal select for webhook response — we only need the ID to confirm success.
 */
export const userWebhookSelect = {
  id: true,
  clerkId: true,
  email: true,
  role: true,
  status: true,
} as const;

export const professionalProfileSelect = {
  userId: true,
  verified: true,
  verificationStatus: true,
} as const;

// ─── Constants ───────────────────────────────────────────────────────────────

export const WEBHOOK_CONFIG = {
  /** Max webhook payload size (256 KB — Clerk payloads are typically < 10 KB) */
  MAX_PAYLOAD_SIZE: 256 * 1024,
  /** Svix header names required for verification */
  REQUIRED_HEADERS: [
    "svix-id",
    "svix-timestamp",
    "svix-signature",
  ] as const,
} as const;

// Re-export enums for convenience
export { UserRole, UserStatus };
