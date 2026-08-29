export { professionalsService } from "@/app/lib/domains/professionals/service";
export { professionalRepository } from "@/app/lib/domains/professionals/repository";
export {
  professionalPortalCapabilityService,
  type ExtendedProfessionalCapabilities,
  type ProfessionalCapabilityContext,
} from "@/app/lib/domains/professionals/capability.service";
export { ensureProfessionalCapability } from "@/app/lib/domains/professionals/portal-capability-guard";
export {
  isProfessionalFeatureEnabled,
  type ProfessionalFeatureFlag,
} from "@/app/lib/domains/professionals/portal-feature-flags";
export * from "@/app/lib/domains/professionals/contracts";
