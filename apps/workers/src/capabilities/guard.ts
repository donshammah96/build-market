export type WorkerMvpCapability = "materials_commerce" | "wallets_escrow";

type CapabilityEnvironment = Partial<
  Record<
    "FEATURE_MVP_MATERIALS_COMMERCE" | "FEATURE_MVP_WALLETS_ESCROW",
    boolean
  >
>;

const ENV_KEY: Record<WorkerMvpCapability, keyof CapabilityEnvironment> = {
  materials_commerce: "FEATURE_MVP_MATERIALS_COMMERCE",
  wallets_escrow: "FEATURE_MVP_WALLETS_ESCROW",
};

export function shouldProcessCapabilityWork(
  capability: WorkerMvpCapability,
  environment: CapabilityEnvironment,
): { process: true } | { process: false; reason: "capability_dormant" } {
  return environment[ENV_KEY[capability]]
    ? { process: true }
    : { process: false, reason: "capability_dormant" };
}
