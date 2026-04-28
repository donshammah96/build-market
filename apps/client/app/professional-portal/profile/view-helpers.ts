type ProfileUserSummary = {
  firstName?: string | null;
  lastName?: string | null;
};

type ProfileIdentity = {
  user: ProfileUserSummary;
  city?: string | null;
  county?: string | null;
};

export function getProfileDisplayName(profile: ProfileIdentity): string {
  const parts = [profile.user.firstName, profile.user.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) => part.trim());

  return parts.join(" ") || "Professional";
}

export function getProfileInitials(profile: ProfileIdentity): string {
  const initials = [profile.user.firstName, profile.user.lastName]
    .map((part) => part?.trim()?.[0] ?? "")
    .join("")
    .toUpperCase();

  return initials || "P";
}

export function getProfileLocation(profile: ProfileIdentity): string | null {
  const parts = [profile.city, profile.county].filter((part): part is string =>
    Boolean(part && part.trim()),
  );

  return parts.length > 0 ? parts.join(", ") : null;
}

export function formatProfileDate(
  value: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string | null {
  if (!value) {
    return null;
  }

  return new Date(value).toLocaleDateString(
    "en-US",
    options ?? {
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );
}

export function formatProfileRating(
  value: number | null | undefined,
): string | null {
  return typeof value === "number" ? value.toFixed(1) : null;
}
