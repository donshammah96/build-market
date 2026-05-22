import type { SearchProfessionalResultDto } from "./contracts";

export type SearchProfessionalRaw = {
  userId: string;
  companyName: string | null;
  bio: string | null;
  verified: boolean;
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
};

export function toSearchProfessionalResultDto(
  raw: SearchProfessionalRaw,
): SearchProfessionalResultDto {
  return {
    userId: raw.userId,
    companyName: raw.companyName ?? null,
    bio: raw.bio ?? null,
    verified: raw.verified,
    user: {
      firstName: raw.user.firstName ?? null,
      lastName: raw.user.lastName ?? null,
      email: raw.user.email ?? null,
    },
  };
}
