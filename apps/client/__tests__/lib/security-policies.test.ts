import { describe, expect, it } from "vitest";
import {
  canDeleteMessage,
  canDeleteThread,
  canManageProject,
  canReadThread,
  canSendMessage,
} from "@/app/lib/security/policies";

describe("security policies", () => {
  it("allows thread read/send only for participants", () => {
    expect(canReadThread(true)).toBe(true);
    expect(canReadThread(false)).toBe(false);
    expect(canSendMessage(true)).toBe(true);
    expect(canSendMessage(false)).toBe(false);
  });

  it("allows thread delete only for owner/admin", () => {
    expect(canDeleteThread("OWNER")).toBe(true);
    expect(canDeleteThread("ADMIN")).toBe(true);
    expect(canDeleteThread("MEMBER")).toBe(false);
    expect(canDeleteThread(undefined)).toBe(false);
  });

  it("allows message delete for sender or thread admins", () => {
    expect(
      canDeleteMessage({
        senderId: "sender-1",
        actorId: "sender-1",
        participantRole: "MEMBER",
      }),
    ).toBe(true);

    expect(
      canDeleteMessage({
        senderId: "sender-1",
        actorId: "mod-1",
        participantRole: "ADMIN",
      }),
    ).toBe(true);

    expect(
      canDeleteMessage({
        senderId: "sender-1",
        actorId: "member-2",
        participantRole: "MEMBER",
      }),
    ).toBe(false);
  });

  it("allows project manage only for project professional owner", () => {
    expect(
      canManageProject({
        actorId: "u1",
        projectProfessionalId: "u1",
      }),
    ).toBe(true);

    expect(
      canManageProject({
        actorId: "u2",
        projectProfessionalId: "u1",
      }),
    ).toBe(false);
  });
});
