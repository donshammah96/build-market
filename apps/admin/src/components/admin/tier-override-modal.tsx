"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "react-toastify";
import type {
  TrustTier,
  SubscriptionTierKey,
  SubscriptionStatus,
  BadgeType,
} from "@build/db";
import {
  overrideTrustTier,
  overrideProfessionalSubscription,
  manageProfessionalBadge,
} from "@/actions/admin/subscriptions";
import { TrustTierType } from "@build/ui/trust-seal-badge";

export interface TierOverrideModalProps {
  professionalId: string;
  currentTrustTier: TrustTierType;
  currentPlanKey?: string;
  currentSubscriptionStatus?: string;
  isFoundingPro?: boolean;
}

export function TierOverrideModal({
  professionalId,
  currentTrustTier,
  currentPlanKey = "FREE",
  currentSubscriptionStatus = "ACTIVE",
  isFoundingPro = false,
}: TierOverrideModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<"trust" | "subscription" | "badges">("trust");
  const [isLoading, setIsLoading] = useState(false);

  // Trust Tier State
  const [targetTier, setTargetTier] = useState<TrustTier>(
    (currentTrustTier as TrustTier) || ("UNVERIFIED" as TrustTier),
  );
  const [trustReason, setTrustReason] = useState("");

  // Subscription State
  const [targetPlan, setTargetPlan] = useState<SubscriptionTierKey>(
    (currentPlanKey as SubscriptionTierKey) || ("FREE" as SubscriptionTierKey),
  );
  const [targetStatus, setTargetStatus] = useState<SubscriptionStatus>(
    (currentSubscriptionStatus as SubscriptionStatus) ||
      ("ACTIVE" as SubscriptionStatus),
  );
  const [foundingProFlag, setFoundingProFlag] =
    useState<boolean>(isFoundingPro);
  const [subReason, setSubReason] = useState("");

  // Badge State
  const [badgeType, setBadgeType] = useState<BadgeType>(
    "TOP_RATED" as BadgeType,
  );
  const [badgeAction, setBadgeAction] = useState<"AWARD" | "REVOKE">("AWARD");
  const [badgeReason, setBadgeReason] = useState("");

  const handleTrustTierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (trustReason.trim().length < 5) {
      toast.error("A clear reason (≥5 chars) is required for the audit log.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await overrideTrustTier({
        professionalId,
        trustTier: targetTier,
        reason: trustReason,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to update trust tier");
        return;
      }

      toast.success(
        "Trust tier successfully updated. Manual override recorded.",
      );
      setIsOpen(false);
      window.location.reload();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error executing action",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subReason.trim().length < 5) {
      toast.error("A clear reason (≥5 chars) is required for the audit log.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await overrideProfessionalSubscription({
        professionalId,
        planKey: targetPlan,
        status: targetStatus,
        isFoundingPro: foundingProFlag,
        reason: subReason,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to update subscription");
        return;
      }

      toast.success("Subscription override applied successfully.");
      setIsOpen(false);
      window.location.reload();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error executing action",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBadgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (badgeReason.trim().length < 5) {
      toast.error("A clear reason (≥5 chars) is required for the audit log.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await manageProfessionalBadge({
        professionalId,
        badgeType: badgeType,
        action: badgeAction,
        criteriaSnapshot: {
          manualOverride: true,
          adminSet: true,
          setAt: new Date().toISOString(),
        },
        reason: badgeReason,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to update badge");
        return;
      }

      toast.success(
        `Badge ${badgeAction.toLowerCase()}ed successfully. Recompute sweep protected.`,
      );
      setIsOpen(false);
      window.location.reload();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error executing action",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-amber-600/30 text-amber-900 bg-amber-50 hover:bg-amber-100 font-semibold"
        >
          🛡️ Admin Tier & Badges Override
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl font-sans">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-[#16233B]">
            Professional Tier & Badge Overrides
          </DialogTitle>
          <DialogDescription className="text-xs text-neutral-500">
            All overrides generate append-only audit trail logs. Manual
            overrides are flagged to avoid automated recompute reverts.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-200 mt-2">
          <button
            type="button"
            onClick={() => setTab("trust")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              tab === "trust"
                ? "border-b-2 border-[#16233B] text-[#16233B]"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            Trust Tier
          </button>
          <button
            type="button"
            onClick={() => setTab("subscription")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              tab === "subscription"
                ? "border-b-2 border-[#16233B] text-[#16233B]"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            Subscription Plan
          </button>
          <button
            type="button"
            onClick={() => setTab("badges")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              tab === "badges"
                ? "border-b-2 border-[#16233B] text-[#16233B]"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            Badges
          </button>
        </div>

        {/* TAB 1: TRUST TIER */}
        {tab === "trust" && (
          <form onSubmit={handleTrustTierSubmit} className="space-y-4 pt-2">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
              <strong>⚠️ Caution: Manual Verification Bypass</strong>
              <p>
                Setting trust tier manually bypasses regulator verification &
                review quotas. This override will be recorded in the audit log.
              </p>
            </div>

            <div>
              <Label className="text-xs font-bold uppercase">
                Select Target Trust Tier
              </Label>
              <Select
                value={targetTier}
                onValueChange={(val) => setTargetTier(val as TrustTier)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNVERIFIED">T0 · Unverified</SelectItem>
                  <SelectItem value="ID_VERIFIED">
                    T1 · ID Verified (Chip)
                  </SelectItem>
                  <SelectItem value="SKILLS_VERIFIED">
                    T2 · Skills Verified (Chip)
                  </SelectItem>
                  <SelectItem value="LICENSE_VERIFIED">
                    T3 · License Verified (Official Seal)
                  </SelectItem>
                  <SelectItem value="ELITE">
                    T4 · Elite Pro (Brick Engraved Seal)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold uppercase">
                Mandatory Audit Reason
              </Label>
              <Textarea
                value={trustReason}
                onChange={(e) => setTrustReason(e.target.value)}
                placeholder="State the justification, ticket ID, or offline verification reference..."
                className="mt-1 text-xs"
                rows={3}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-[#16233B] text-white"
              >
                {isLoading ? "Recording..." : "Apply Trust Tier Override"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* TAB 2: SUBSCRIPTION */}
        {tab === "subscription" && (
          <form onSubmit={handleSubscriptionSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold uppercase">Plan</Label>
                <Select
                  value={targetPlan}
                  onValueChange={(val) =>
                    setTargetPlan(val as SubscriptionTierKey)
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREE">Msingi (Free)</SelectItem>
                    <SelectItem value="GROWTH">Kuza (Growth)</SelectItem>
                    <SelectItem value="BUSINESS">Bora (Business)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase">Status</Label>
                <Select
                  value={targetStatus}
                  onValueChange={(val) =>
                    setTargetStatus(val as SubscriptionStatus)
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                    <SelectItem value="TRIALING">TRIALING</SelectItem>
                    <SelectItem value="GRACE_PERIOD">GRACE_PERIOD</SelectItem>
                    <SelectItem value="PAST_DUE">PAST_DUE</SelectItem>
                    <SelectItem value="EXPIRED">EXPIRED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="foundingPro"
                checked={foundingProFlag}
                onChange={(e) => setFoundingProFlag(e.target.checked)}
                className="rounded border-neutral-300"
              />
              <Label
                htmlFor="foundingPro"
                className="text-xs font-medium cursor-pointer"
              >
                Comp as Founding Pro (Permanent lifetime renewal discount)
              </Label>
            </div>

            <div>
              <Label className="text-xs font-bold uppercase">
                Mandatory Audit Reason
              </Label>
              <Textarea
                value={subReason}
                onChange={(e) => setSubReason(e.target.value)}
                placeholder="State the subscription comp or adjustment reason..."
                className="mt-1 text-xs"
                rows={3}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-[#16233B] text-white"
              >
                {isLoading ? "Recording..." : "Apply Subscription Override"}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* TAB 3: BADGES */}
        {tab === "badges" && (
          <form onSubmit={handleBadgeSubmit} className="space-y-4 pt-2">
            <div className="p-3 bg-[#FAF9F5] border border-[#DFDACB] rounded text-xs text-neutral-700">
              ℹ️ Badges granted with manual override will be protected with{" "}
              <code className="font-mono bg-neutral-200 px-1 rounded">
                manualOverride: true
              </code>{" "}
              and will not be revoked by monthly BullMQ sweeps.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold uppercase">
                  Badge Type
                </Label>
                <Select
                  value={badgeType}
                  onValueChange={(val) => setBadgeType(val as BadgeType)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Badge" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FOUNDING_PRO">FOUNDING_PRO</SelectItem>
                    <SelectItem value="FAST_RESPONDER">
                      FAST_RESPONDER
                    </SelectItem>
                    <SelectItem value="RISING_TALENT">RISING_TALENT</SelectItem>
                    <SelectItem value="TOP_RATED">TOP_RATED</SelectItem>
                    <SelectItem value="ELITE_PRO">ELITE_PRO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold uppercase">Action</Label>
                <Select
                  value={badgeAction}
                  onValueChange={(v) => setBadgeAction(v as "AWARD" | "REVOKE")}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AWARD">AWARD BADGE</SelectItem>
                    <SelectItem value="REVOKE">REVOKE BADGE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold uppercase">
                Mandatory Audit Reason
              </Label>
              <Textarea
                value={badgeReason}
                onChange={(e) => setBadgeReason(e.target.value)}
                placeholder="State the badge override reason..."
                className="mt-1 text-xs"
                rows={3}
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-[#16233B] text-white"
              >
                {isLoading ? "Recording..." : "Execute Badge Action"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
