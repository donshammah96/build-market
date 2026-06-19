import type { AdminRole } from "@build/enums";

export type AdminActor = {
  clerkId: string;
  dbUserId: string;
  adminRole: AdminRole;
};

export type AdminActorContext = {
  actor: AdminActor;
  correlationId: string;
  requestStartedAt: number;
};

export type AdminActionContext = AdminActorContext & {
  adminUserId: string;
  adminRole: AdminRole;
};
