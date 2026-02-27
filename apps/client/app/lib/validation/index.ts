/**
 * Validation barrel export.
 *
 * Due to intentionally duplicated schema names across domain modules
 * (e.g. CountySchema, ProjectTypeSchema, VerificationStatusSchema),
 * using `export *` would cause conflicts.
 *
 * Import directly from the specific validation file instead:
 *
 *   import { CreatePropertySchema } from "@/app/lib/validation/properties-validation";
 *   import { CreateProjectSchema } from "@/app/lib/validation/projects-validation";
 */

// Domain-specific validation modules — import directly from these:
// ./calendar-validation
// ./certificate-validation
// ./documents-validation
// ./finance-validation
// ./file-validation
// ./leads-validation
// ./license
// ./portfolio-validation
// ./profile-validation
// ./professionals-validation
// ./projects-validation
// ./properties-validation
// ./stores-validation
