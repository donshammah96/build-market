import type { ComponentType, SVGProps } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Star,
  BookOpen,
  Users,
  Briefcase,
  Image as ImageIcon,
  DollarSign,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export interface NavItem {
  /** Stable key for React lists and analytics; independent of label copy. */
  key: string;
  label: string;
  href: string;
  icon?: IconComponent;
  /** Optional numeric badge (e.g. unread count). Omit rather than passing 0. */
  badge?: number;
  /** Gate behind a feature flag; item is filtered out unless the flag is on. */
  featureFlag?: string;
}

/**
 * Public marketing site navigation.
 * Single source of truth for Header.tsx (desktop) and MobileNav.tsx (mobile
 * drawer) so the two surfaces can never drift out of sync again.
 */
export const publicNavItems: NavItem[] = [
  { key: "idea-books", label: "Idea Books", href: ROUTES.ideaBooks },
  {
    key: "find-professionals",
    label: "Find Professionals",
    href: ROUTES.findProfessional,
  },
  { key: "guidance", label: "Guidance", href: ROUTES.speakWithAdvisor },
];

/**
 * Signed-in client portal navigation (ClientNavbar.tsx).
 */
export const clientNavItems: NavItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: ROUTES.userDashboard,
    icon: LayoutDashboard,
  },
  {
    key: "messages",
    label: "Messages",
    href: ROUTES.messages,
    icon: MessageSquare,
  },
  { key: "reviews", label: "Reviews", href: ROUTES.reviews, icon: Star },
  {
    key: "idea-books",
    label: "Idea Books",
    href: ROUTES.ideaBooks,
    icon: BookOpen,
  },
];

/**
 * Signed-in professional portal navigation, shared between
 * ProfessionalSidebar.tsx (desktop rail) and ProfessionalNavbar.tsx's
 * mobile drawer, so a route added to one surface can't go missing on the
 * other (see the P0 bug where mobile professionals had no nav at all).
 */
export const professionalNavItems: NavItem[] = [
  {
    key: "overview",
    label: "Overview",
    href: "/professional-portal/dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "leads",
    label: "Leads",
    href: "/professional-portal/leads",
    icon: Users,
    badge: 3,
  },
  {
    key: "projects",
    label: "Projects",
    href: "/professional-portal/projects",
    icon: Briefcase,
  },
  {
    key: "messages",
    label: "Messages",
    href: "/professional-portal/messages",
    icon: MessageSquare,
  },
  {
    key: "portfolio",
    label: "Portfolio",
    href: "/professional-portal/portfolio",
    icon: ImageIcon,
  },
  {
    key: "finance",
    label: "Finance",
    href: "/professional-portal/finance",
    icon: DollarSign,
  },
];

/**
 * Filters a NavItem[] against active feature flags.
 * An item with no featureFlag is always shown. An item with a featureFlag
 * is shown only when that flag is explicitly true, OR when the flag lookup
 * itself is undefined (e.g. flags still loading) — matching prior NavBar.tsx
 * behavior of "fail open" during flag resolution rather than flashing items
 * in and out.
 */
export function filterByFeatureFlags(
  items: NavItem[],
  flags: Record<string, boolean | undefined>,
): NavItem[] {
  return items.filter((item) => {
    if (!item.featureFlag) return true;
    const flagValue = flags[item.featureFlag];
    return flagValue === true || flagValue === undefined;
  });
}
