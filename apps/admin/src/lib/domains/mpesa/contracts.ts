import type { AdminActor } from "@/lib/security/admin-actor";

export type MpesaActor = AdminActor;

export interface CreateMpesaPayoutInput {
  professionalId: string;
  amount: number;
  phoneNumber: string;
  idempotencyKey: string;
  reason: string;
}
