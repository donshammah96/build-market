import {
  allow,
  deny,
  evaluatePolicy,
  type AuthorizationPolicy,
} from "@/app/lib/security/authorization-policy";
import { createUserAuthContext } from "@/app/lib/security/auth-context";

type ThreadParticipantRole = "OWNER" | "ADMIN" | "MEMBER";

const READ_THREAD_POLICY: AuthorizationPolicy<{ isParticipant: boolean }> = {
  id: "messaging.read-thread",
  evaluate: ({ resource }) =>
    resource.isParticipant
      ? allow("messaging.read-thread")
      : deny("messaging.read-thread", "Not a participant"),
};

const SEND_MESSAGE_POLICY: AuthorizationPolicy<{ isParticipant: boolean }> = {
  id: "messaging.send-message",
  evaluate: ({ resource }) =>
    resource.isParticipant
      ? allow("messaging.send-message")
      : deny("messaging.send-message", "Not a participant"),
};

const DELETE_THREAD_POLICY: AuthorizationPolicy<{
  participantRole: ThreadParticipantRole | null | undefined;
}> = {
  id: "messaging.delete-thread",
  evaluate: ({ resource }) =>
    resource.participantRole === "OWNER" || resource.participantRole === "ADMIN"
      ? allow("messaging.delete-thread")
      : deny("messaging.delete-thread", "Only thread owners or admins"),
};

const DELETE_MESSAGE_POLICY: AuthorizationPolicy<{
  senderId: string;
  actorId: string;
  participantRole?: ThreadParticipantRole | null;
}> = {
  id: "messaging.delete-message",
  evaluate: ({ context, resource }) => {
    if (resource.senderId === context.actorId) {
      return allow("messaging.delete-message");
    }
    if (
      resource.participantRole === "OWNER" ||
      resource.participantRole === "ADMIN"
    ) {
      return allow("messaging.delete-message");
    }
    return deny("messaging.delete-message", "Only sender/admin/owner");
  },
};

const MANAGE_PROJECT_POLICY: AuthorizationPolicy<{
  actorId: string;
  projectProfessionalId?: string | null;
}> = {
  id: "projects.manage",
  evaluate: ({ resource }) =>
    !!resource.projectProfessionalId &&
    resource.projectProfessionalId === resource.actorId
      ? allow("projects.manage")
      : deny("projects.manage", "Only assigned professional"),
};

export function canReadThread(isParticipant: boolean): boolean {
  const context = createUserAuthContext({ actorId: "policy-actor" });
  return evaluatePolicy(READ_THREAD_POLICY, context, { isParticipant }).allowed;
}

export function canSendMessage(isParticipant: boolean): boolean {
  const context = createUserAuthContext({ actorId: "policy-actor" });
  return evaluatePolicy(SEND_MESSAGE_POLICY, context, { isParticipant })
    .allowed;
}

export function canDeleteThread(
  participantRole: ThreadParticipantRole | null | undefined,
): boolean {
  const context = createUserAuthContext({ actorId: "policy-actor" });
  return evaluatePolicy(DELETE_THREAD_POLICY, context, { participantRole })
    .allowed;
}

export function canDeleteMessage(params: {
  senderId: string;
  actorId: string;
  participantRole?: ThreadParticipantRole | null;
}): boolean {
  const context = createUserAuthContext({ actorId: params.actorId });
  return evaluatePolicy(DELETE_MESSAGE_POLICY, context, params).allowed;
}

export function canManageProject(params: {
  actorId: string;
  projectProfessionalId?: string | null;
}): boolean {
  const context = createUserAuthContext({ actorId: params.actorId });
  return evaluatePolicy(MANAGE_PROJECT_POLICY, context, params).allowed;
}
