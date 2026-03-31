import type { UserRole } from "@prisma/client";
import type { UserProfileCompletionSummary } from "./completion";

export type Serialized<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;

type ProfileCompleteResponseInput = {
  success: true;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    avatar: string | null;
    bio: string | null;
    role: UserRole;
    isProfileComplete: boolean;
  };
  profile: unknown;
  completion: UserProfileCompletionSummary;
  message: string;
};

function serializeForTransportValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeForTransportValue(item));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, itemValue]) => [key, serializeForTransportValue(itemValue)],
    );
    return Object.fromEntries(entries);
  }

  return value;
}

export function mapUserProfileReadResponse<T>(response: T): Serialized<T> {
  return serializeForTransportValue(response) as Serialized<T>;
}

export function mapUserProfileUpdateResponse<T>(response: T): Serialized<T> {
  return serializeForTransportValue(response) as Serialized<T>;
}

export function mapProfileCompleteResponse(
  response: ProfileCompleteResponseInput,
): Serialized<ProfileCompleteResponseInput> {
  return serializeForTransportValue(
    response,
  ) as Serialized<ProfileCompleteResponseInput>;
}
