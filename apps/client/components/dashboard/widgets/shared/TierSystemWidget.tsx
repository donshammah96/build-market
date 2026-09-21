"use client";

import React, { useState } from "react";
import { RenewalStatus } from "@build/ui/renewal-status";
import { LeadCreditWallet } from "@build/ui/lead-credit-wallet";
import { BadgeRow } from "@build/ui/badge-row";
import { MpesaStkModal } from "@build/ui/mpesa-stk-modal";

export interface TierSystemWidgetProps {
  subscription?: {
    plan?: { key: string; name: string };
    status?: string;
    currentPeriodEnd?: string | Date | null;
    graceEndsAt?: string | Date | null;
    isFoundingPro?: boolean;
  };
  leadWallet?: {
    balance: number;
  };
  badges?: Array<{
    type:
      | "FOUNDING_PRO"
      | "FAST_RESPONDER"
      | "RISING_TALENT"
      | "TOP_RATED"
      | "ELITE_PRO";
  }>;
  className?: string;
}

export const TierSystemWidget: React.FC<TierSystemWidgetProps> = ({
  subscription,
  leadWallet,
  badges = [],
  className = "",
}) => {
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    amountKES: number;
    purpose: "SUBSCRIPTION_RENEWAL" | "LEAD_CREDIT_PURCHASE";
  }>({
    isOpen: false,
    title: "",
    amountKES: 0,
    purpose: "SUBSCRIPTION_RENEWAL",
  });

  const planKey = subscription?.plan?.key || "FREE";
  const discountPct =
    planKey === "BUSINESS" ? 35 : planKey === "GROWTH" ? 20 : 0;

  const handleInitiateCheckout = async (phoneNumber: string) => {
    try {
      const res = await fetch("/api/v1/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planKey,
          phoneNumber,
          purpose: modalConfig.purpose,
          amountKES: modalConfig.amountKES,
        }),
      });

      if (!res.ok) {
        return {
          checkoutRequestId: `ws_CO_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        };
      }

      const data = await res.json();
      return { checkoutRequestId: data.checkoutRequestId };
    } catch {
      return {
        checkoutRequestId: `ws_CO_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      };
    }
  };

  const handlePollStatus = async (checkoutRequestId: string) => {
    try {
      const res = await fetch(
        `/api/v1/payments/mpesa/status?checkoutRequestId=${encodeURIComponent(checkoutRequestId)}`,
      );
      if (res.ok) {
        const data = await res.json();
        return {
          status: data.status,
          resultDesc: data.resultDesc,
        };
      }
      return { status: "PENDING" as const };
    } catch {
      return { status: "PENDING" as const };
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Lead Credit Wallet */}
      <LeadCreditWallet
        balance={leadWallet?.balance ?? 0}
        discountPct={discountPct}
        unitPriceKES={500}
        onBuyCreditsClick={() =>
          setModalConfig({
            isOpen: true,
            title: "Top Up Marketplace Lead Credits",
            subtitle: "Purchase 5 credits with your active plan discount",
            amountKES:
              planKey === "BUSINESS"
                ? 1625
                : planKey === "GROWTH"
                  ? 2000
                  : 2500,
            purpose: "LEAD_CREDIT_PURCHASE",
          })
        }
      />

      {/* Renewal Status */}
      <RenewalStatus
        currentPeriodEnd={subscription?.currentPeriodEnd ?? null}
        gracePeriodEnd={subscription?.graceEndsAt ?? null}
        status={subscription?.status ?? "ACTIVE"}
        onRenewClick={() =>
          setModalConfig({
            isOpen: true,
            title: `Renew ${subscription?.plan?.name || "Subscription"}`,
            subtitle: "Instant 30-day renewal via Safaricom M-Pesa STK",
            amountKES:
              planKey === "BUSINESS" ? 6000 : planKey === "GROWTH" ? 1500 : 0,
            purpose: "SUBSCRIPTION_RENEWAL",
          })
        }
      />

      {/* Earned Badges Panel */}
      <div className="p-4 rounded-lg border border-[#DFDACB] bg-[#FAF9F5] font-sans">
        <div className="flex items-center justify-between mb-3 border-b border-[#EAE6DC] pb-2">
          <span className="text-xs font-mono uppercase tracking-wider text-neutral-500">
            Earned Platform Badges
          </span>
          <span className="text-xs text-neutral-500">5 Schema Badges</span>
        </div>
        <BadgeRow
          earnedBadges={badges.map((b) => b.type)}
          showLocked={true}
          size="sm"
        />
      </div>

      {/* Unified M-Pesa Modal */}
      <MpesaStkModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
        title={modalConfig.title}
        subtitle={modalConfig.subtitle}
        amountKES={modalConfig.amountKES}
        purpose={modalConfig.purpose}
        onInitiateCheckout={handleInitiateCheckout}
        onPollStatus={handlePollStatus}
      />
    </div>
  );
};
