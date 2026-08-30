import {
  SubscriptionTierKey,
  SubscriptionStatus,
  TrustTier,
  BadgeType,
  BoostType,
} from "@build/db";

export type CrmPipelineLevel = "BASIC" | "FULL" | "TEAM";

export interface EntitlementLimits {
  /** Maximum active portfolio projects (null = unlimited) */
  maxPortfolioProjects: number | null;
  /** Maximum photos per portfolio project (null = unlimited) */
  maxPortfolioImagesPerProject: number | null;
  /** Maximum team members allowed in the organization (null = unlimited) */
  maxTeamMembers: number | null;
  /** Maximum quote drafts or sends per calendar month (null = unlimited) */
  maxQuotesPerMonth: number | null;
}

export interface EntitlementFeatures {
  /** Whether the pro is eligible to receive marketplace algorithmic lead matches (strictly gated by trust tier) */
  canReceiveMarketplaceLeads: boolean;
  /** CRM pipeline capabilities unlocked in the Pro dashboard */
  crmPipelineLevel: CrmPipelineLevel;
  /** Rolling window of analytics history in days (7, 90, or 365) */
  analyticsDepthDays: number;
  /** Fast-track priority SLA for verification document reviews */
  priorityVerificationSla: boolean;
  /** Real-time WhatsApp/SMS lead notifications */
  whatsappLeadAlerts: boolean;
  /** Branded quote templates and custom exports */
  brandedQuoteTemplates: boolean;
  /** Platform direct call routing */
  directCallRouting: boolean;
}

export interface EntitlementDiscounts {
  /** Discount percentage on additional lead credit purchases */
  leadCreditDiscountPct: number;
  /** Escrow/Platform fee reduction percentage */
  platformFeeDiscountPct: number;
  /** Active Founding Pro lifetime discount applied to renewals */
  foundingProDiscountPct: number;
}

export interface ResolvedEntitlements {
  professionalId: string;
  trustTier: TrustTier;
  subscriptionTier: SubscriptionTierKey;
  subscriptionStatus: SubscriptionStatus;
  isFoundingPro: boolean;
  isCompedPeriodActive: boolean;
  limits: EntitlementLimits;
  features: EntitlementFeatures;
  discounts: EntitlementDiscounts;
  activeBoosts: BoostType[];
  badges: BadgeType[];
  resolvedAt: string; // ISO string
}
