/**
 * Mappers for professionals API response to UI types.
 */
import type { ProfessionalCardData } from "@/types/professional";
import type { ProfessionalListResult } from "@/app/lib/domains/professionals";

/** Map service list result to ProfessionalCardData[] for cards/grids */
export function mapToListCardData(
  result: ProfessionalListResult | undefined,
): ProfessionalCardData[] {
  if (!result?.professionals) return [];

  return result.professionals.map((p) => {
    const name =
      p.user?.firstName || p.user?.lastName
        ? `${p.user.firstName ?? ""} ${p.user.lastName ?? ""}`.trim()
        : (p.companyName ?? "Professional");

    const services = (p.skills ?? []).map((name, i) => ({
      id: `s-${p.id}-${i}`,
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      description: null,
      icon: null,
      professionType: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    const locationParts = [
      p.city,
      p.county != null ? String(p.county) : null,
      p.country,
    ].filter(Boolean);
    const location =
      locationParts.length > 0 ? locationParts.join(", ") : undefined;

    return {
      id: p.id,
      name: name || p.companyName || "Professional",
      companyName: p.companyName ?? "",
      profession: (p.profession
        ? String(p.profession).toLowerCase().replace(/-/g, "_")
        : "other") as ProfessionalCardData["profession"],
      professionLabel:
        (p as { professionLabel?: string }).professionLabel ?? "Professional",
      title:
        p.skills?.[0] ??
        (p as { professionLabel?: string }).professionLabel ??
        "Professional",
      bio: p.bio ?? undefined,
      services,
      serviceNames: p.skills,
      yearsExperience: p.yearsExperience ?? undefined,
      status: p.verified ? ("VERIFIED" as const) : ("PENDING" as const),
      verified: p.verified ?? false,
      rating: p.rating ?? undefined,
      reviewCount: p.reviewCount ?? 0,
      projectCount:
        (p as { _count?: { projects?: number } })._count?.projects ?? 0,
      portfolioImage: (p as { portfolioImage?: string }).portfolioImage,
      profileImage: p.user?.avatar ?? undefined,
      city: p.city ?? undefined,
      county: p.county ?? undefined,
      country: p.country ?? undefined,
      location,
      profileUrl: (p as { profileUrl?: string }).profileUrl,
    };
  });
}
