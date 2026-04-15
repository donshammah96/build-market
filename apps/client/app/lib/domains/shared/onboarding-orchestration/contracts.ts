import { OnboardingSchema } from "@build/types";
import type { z } from "zod";
import type {
  ClerkUserProfile,
  UserProfileOnboardingActor,
} from "@/app/lib/domains/user-profile";
import type { DomainError, Result } from "@/app/lib/errors/result";

// ADR-006 classification: submit intent payload may include Class B onboarding
// fields (business registration, identifiers, contact details).
export type ValidatedOnboardingData = z.infer<typeof OnboardingSchema>;

export type OnboardingRole = "CLIENT" | "PROFESSIONAL";

export type OnboardingClerkActor = Pick<
  UserProfileOnboardingActor,
  "clerkId" | "correlationId"
>;

export type OnboardingIntent =
  | {
      kind: "submit";
      role: OnboardingRole;
      data: ValidatedOnboardingData;
    }
  | { kind: "skip_client" }
  | { kind: "skip_professional" };

export type OnboardingIdempotencyContext = {
  key: string;
  scope: "onboarding";
  actorId: string;
  method: string;
};

export type OnboardingWarning = {
  resourceType: "store" | "property";
  resourceName: string;
  reason: string;
};

export type OnboardingOrchestrationStatus = "ACTIVE" | "PENDING_VERIFICATION";

// ADR-006 classification: output contract is Class C or Class D only.
export type OnboardingOrchestrationResult = {
  userId: string;
  role: OnboardingRole;
  isProfileComplete: boolean;
  status: OnboardingOrchestrationStatus;
  redirectTo: string;
  warnings?: OnboardingWarning[];
};

export type OnboardingOrchestrationErrorCode =
  | "conflict"
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "invalid_state"
  | "clerk_sync_failed"
  | "internal";

export type OnboardingOrchestrationError =
  DomainError<OnboardingOrchestrationErrorCode>;

export type OnboardingOrchestrationResultEnvelope = Result<
  OnboardingOrchestrationResult,
  OnboardingOrchestrationError
>;

export type OnboardingOrchestrationRequest = {
  actor: OnboardingClerkActor;
  clerkUser: ClerkUserProfile;
  intent: OnboardingIntent;
  idempotency: OnboardingIdempotencyContext;
};
