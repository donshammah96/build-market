import { env } from "@/app/lib/infrastructure/env";

export const MVP_CAPABILITIES = [
  "materials_commerce",
  "property_transactions",
  "idea_books",
  "cpd",
  "wallets_escrow",
  "platform_custody",
] as const;

export type MvpCapability = (typeof MVP_CAPABILITIES)[number];
export type CapabilityState = "disabled" | "live";

export interface CapabilityDecision {
  capability: MvpCapability;
  state: CapabilityState;
  publicDiscoveryEligible: boolean;
  asyncDeliveryEligible: boolean;
  adminLifecycleLabel: "dormant" | "live";
}

const CAPABILITY_ENV_KEYS: Record<MvpCapability, keyof typeof env.features> = {
  materials_commerce: "mvpMaterialsCommerce",
  property_transactions: "mvpPropertyTransactions",
  idea_books: "mvpIdeaBooks",
  cpd: "mvpCpd",
  wallets_escrow: "mvpWalletsEscrow",
  platform_custody: "mvpPlatformCustody",
};

const CAPABILITY_PATH_PREFIXES: Record<MvpCapability, readonly string[]> = {
  materials_commerce: [
    "/stores",
    "/api/stores",
    "/api/v1/market-data/materials-price-index",
    "/professional-portal/settings/stores",
  ],
  property_transactions: [
    "/properties",
    "/api/properties",
    "/professional-portal/settings/properties",
  ],
  idea_books: ["/idea-books", "/api/idea-books"],
  cpd: ["/api/professionals/cpd"],
  wallets_escrow: ["/api/projects/"],
  platform_custody: [],
};

function normalisePath(pathname: string): string {
  const path = pathname.split("?", 1)[0] ?? pathname;
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/api/projects/") {
    return /^(?:\/api\/projects|\/api\/professional-portal\/projects)\/[^/]+\/escrow(?:\/|$)/.test(
      pathname,
    );
  }

  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function capabilityForPath(pathname: string): MvpCapability | null {
  const normalisedPath = normalisePath(pathname);

  for (const capability of MVP_CAPABILITIES) {
    if (
      CAPABILITY_PATH_PREFIXES[capability].some((prefix) =>
        matchesPrefix(normalisedPath, prefix),
      )
    ) {
      return capability;
    }
  }

  return null;
}

export function getCapabilityDecision(
  capability: MvpCapability,
): CapabilityDecision {
  const state: CapabilityState = env.features?.[
    CAPABILITY_ENV_KEYS[capability]
  ]
    ? "live"
    : "disabled";
  return {
    capability,
    state,
    publicDiscoveryEligible: state === "live",
    asyncDeliveryEligible: state === "live",
    adminLifecycleLabel: state === "live" ? "live" : "dormant",
  };
}

export function getCapabilityTelemetryAttributes(capability: MvpCapability) {
  return {
    capability,
    capability_state: getCapabilityDecision(capability).state,
  } as const;
}
