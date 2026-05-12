import type {
  ServiceGroup,
  SettingsProfileData,
} from "@/domains/professional-settings";
import type { County } from "@prisma/client";

export type { ServiceGroup, SettingsProfileData };

export interface ProfileServiceSummary {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
}

export interface ProfileImage {
  id: string;
  url: string;
  caption: string | null;
  isMain: boolean;
}

export interface ProfilePortfolioImage extends ProfileImage {
  isBefore: boolean;
  isAfter: boolean;
}

export interface ProfilePortfolioItem {
  id: string;
  title: string;
  description: string | null;
  projectType: string;
  completedAt: Date | string | null;
  images: ProfilePortfolioImage[];
}

export interface ProfileReview {
  id: string;
  rating: number;
  comment?: string | null;
  createdAt: Date | string;
  reviewer: {
    firstName: string;
    lastName: string;
    avatar?: string | null;
  };
}

export interface ProfileCertificate {
  id: string;
  name: string;
  issuer: string;
  issueDate: Date | string | null;
  expiryDate: Date | string | null;
}

export type OwnProfessionalProfile = Omit<
  SettingsProfileData,
  "services" | "createdAt" | "updatedAt"
> & {
  services: ProfileServiceSummary[];
  verified: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  images?: ProfileImage[];
};

export interface PublicProfessionalProfile extends OwnProfessionalProfile {
  avgRating?: number | null;
  portfolios?: ProfilePortfolioItem[];
  reviews?: ProfileReview[];
  certificates?: ProfileCertificate[];
  _count?: {
    reviews: number;
    projects: number;
    portfolios: number;
    stores?: number;
    properties?: number;
  };
}

type PublicProfileRecord = {
  userId: string;
  companyName: string;
  profession: string | null;
  bio: string | null;
  city: string | null;
  county: County | null;
  website: string | null;
  portfolioUrl: string | null;
  yearsExperience: number | null;
  verified?: boolean | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatar: string | null;
  } | null;
  offeredServices?: Array<{
    serviceId?: string;
    service: {
      id: string;
      name: string;
      slug: string;
      category?: {
        icon?: string | null;
      } | null;
    };
  }>;
  licenses?: Array<{
    licenseNumber: string;
  }>;
  portfolios?: Array<{
    id: string;
    title: string;
    description: string | null;
    projectType: string;
    completionDate: Date | string | null;
    images?: Array<{
      id: string;
      caption: string | null;
      isMain: boolean;
      category?: string | null;
      asset?: {
        cdnUrl?: string | null;
        thumbnailUrl?: string | null;
      } | null;
    }>;
  }>;
  documents?: Array<{
    id: string;
    title: string | null;
    issuer: string | null;
    category: string;
    verifiedAt: Date | string | null;
  }>;
  reviews?: Array<{
    id: string;
    rating: number;
    comment: string | null;
    createdAt: Date | string;
    reviewer?: {
      firstName: string | null;
      lastName: string | null;
      avatar: string | null;
    } | null;
  }>;
  _count?: {
    reviews: number;
    projects: number;
    portfolios: number;
    stores?: number;
    properties?: number;
  };
};

function formatCategoryLabel(category: string): string {
  return category
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizePublicProfessionalProfile(
  profile: PublicProfileRecord,
  avgRating: number | null,
): PublicProfessionalProfile {
  return {
    id: profile.userId,
    userId: profile.userId,
    companyName: profile.companyName,
    profession: profile.profession,
    bio: profile.bio,
    city: profile.city,
    county: profile.county,
    website: profile.website,
    portfolioUrl: profile.portfolioUrl,
    yearsExperience: profile.yearsExperience,
    licenseNumber: profile.licenses?.[0]?.licenseNumber ?? null,
    verified: profile.verified ?? false,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    user: {
      firstName: profile.user?.firstName ?? "",
      lastName: profile.user?.lastName ?? "",
      email: profile.user?.email ?? "",
      avatar: profile.user?.avatar ?? null,
    },
    services:
      profile.offeredServices?.map((serviceLink) => ({
        id: serviceLink.service.id,
        name: serviceLink.service.name,
        slug: serviceLink.service.slug,
        icon: serviceLink.service.category?.icon ?? null,
      })) ?? [],
    images: [],
    avgRating,
    portfolios:
      profile.portfolios?.map((portfolio) => ({
        id: portfolio.id,
        title: portfolio.title,
        description: portfolio.description,
        projectType: portfolio.projectType,
        completedAt: portfolio.completionDate,
        images:
          portfolio.images
            ?.map((image) => {
              const url = image.asset?.cdnUrl ?? image.asset?.thumbnailUrl;
              if (!url) {
                return null;
              }

              return {
                id: image.id,
                url,
                caption: image.caption ?? null,
                isMain: image.isMain,
                isBefore: image.category === "BEFORE",
                isAfter: image.category === "AFTER",
              };
            })
            .filter(
              (image): image is ProfilePortfolioImage => image !== null,
            ) ?? [],
      })) ?? [],
    reviews:
      profile.reviews?.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        reviewer: {
          firstName: review.reviewer?.firstName ?? "",
          lastName: review.reviewer?.lastName ?? "",
          avatar: review.reviewer?.avatar ?? null,
        },
      })) ?? [],
    certificates:
      profile.documents?.map((document) => ({
        id: document.id,
        name: document.title || formatCategoryLabel(document.category),
        issuer: document.issuer || "Verified document",
        issueDate: document.verifiedAt,
        expiryDate: null,
      })) ?? [],
    _count: profile._count,
  };
}
