"use client";

import React, { useState, useEffect } from "react";
import { PlanChip } from "@build/ui/plan-chip";
import { RenewalStatus } from "@build/ui/renewal-status";
import { LeadCreditWallet } from "@build/ui/lead-credit-wallet";
import { MpesaStkModal } from "@build/ui/mpesa-stk-modal";

interface PlanItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  priceMonthlyKES: number;
  priceAnnualKES: number | null;
  monthlyLeadCredits: number;
  leadCreditDiscountPct: number;
  maxPortfolioProjects: number | null;
  maxTeamMembers: number | null;
}

export default function BillingManagementPage() {
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [wallet, setWallet] = useState<{ balance: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // M-Pesa Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    amountKES: number;
    purpose: "SUBSCRIPTION_RENEWAL";
    billingInterval: "MONTHLY" | "ANNUAL";
    planKey?: string;
    leadCreditsPack?: number;
  }>({
    isOpen: false,
    title: "",
    amountKES: 0,
    purpose: "SUBSCRIPTION_RENEWAL",
    billingInterval: "MONTHLY",
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Mock / dynamic load for plans and user subscription
      const [plansRes] = await Promise.all([
        fetch("/api/v1/subscriptions/plans").catch(() => null),
        fetch("/api/v1/subscriptions/my-subscription").catch(() => null),
      ]);

      if (plansRes?.ok) {
        const data = await plansRes.json();
        setPlans(data.plans || []);
      } else {
        // Fallback default plans
        setPlans([
          {
            id: "plan-free",
            key: "FREE",
            name: "Msingi (Free)",
            description:
              "Essential tools to create your profile and browse opportunities.",
            priceMonthlyKES: 0,
            priceAnnualKES: 0,
            monthlyLeadCredits: 0,
            leadCreditDiscountPct: 0,
            maxPortfolioProjects: 3,
            maxTeamMembers: 1,
          },
          {
            id: "plan-growth",
            key: "GROWTH",
            name: "Kuza (Growth)",
            description:
              "Accelerate your local business with lead credits and expanded reach.",
            priceMonthlyKES: 1500,
            priceAnnualKES: 15000,
            monthlyLeadCredits: 3,
            leadCreditDiscountPct: 20,
            maxPortfolioProjects: 15,
            maxTeamMembers: 3,
          },
          {
            id: "plan-business",
            key: "BUSINESS",
            name: "Bora (Business)",
            description:
              "Full enterprise pipeline, dedicated lead routing, and priority review SLA.",
            priceMonthlyKES: 6000,
            priceAnnualKES: 60000,
            monthlyLeadCredits: 15,
            leadCreditDiscountPct: 35,
            maxPortfolioProjects: null,
            maxTeamMembers: null,
          },
        ]);
      }

      setWallet({ balance: 3 });
      setSubscription({
        plan: { key: "GROWTH", name: "Kuza (Growth)" },
        status: "ACTIVE",
        currentPeriodEnd: new Date(
          Date.now() + 18 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        isFoundingPro: false,
      });
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInitiateCheckout = async (phoneNumber: string) => {
    try {
      const res = await fetch("/api/v1/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planKey: modalConfig.planKey,
          phoneNumber,
          billingInterval: modalConfig.billingInterval,
          idempotencyKey: crypto.randomUUID(),
        }),
      });

      if (!res.ok) {
        return {
          checkoutRequestId: "",
          error: "Unable to start M-Pesa checkout",
        };
      }

      const payload = await res.json();
      return { checkoutRequestId: payload.data?.checkoutRequestId ?? "" };
    } catch {
      return {
        checkoutRequestId: "",
        error: "Unable to start M-Pesa checkout",
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

  const currentPlanKey = subscription?.plan?.key || "FREE";

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-12 text-center text-sm font-mono text-neutral-500">
        Loading billing & subscription details...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 font-sans pb-16">
      {/* Top Header */}
      <div className="p-6 bg-[#FAF9F5] border border-[#DFDACB] rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-neutral-500">
            Monetization & Invoicing
          </span>
          <h1 className="text-2xl font-extrabold text-[#16233B] tracking-tight">
            Subscription & Billing Management
          </h1>
          <p className="text-sm text-neutral-600 mt-1">
            Manage your subscription tier, renew with M-Pesa STK, and top up
            marketplace lead credits.
          </p>
        </div>

        {subscription && (
          <PlanChip
            planKey={subscription.plan?.key}
            planName={subscription.plan?.name}
            status={subscription.status}
            isFoundingPro={subscription.isFoundingPro}
            size="md"
          />
        )}
      </div>

      {/* Overview Grid: Renewal Status + Lead Credits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RenewalStatus
          currentPeriodEnd={subscription?.currentPeriodEnd}
          gracePeriodEnd={subscription?.graceEndsAt}
          status={subscription?.status}
          onRenewClick={() =>
            setModalConfig({
              isOpen: true,
              title: "Renew Kuza (Growth) Subscription",
              subtitle: "Instant 30-day renewal via Safaricom M-Pesa",
              amountKES: 1500,
              purpose: "SUBSCRIPTION_RENEWAL",
              planKey: currentPlanKey,
            })
          }
        />

        <LeadCreditWallet
          balance={wallet?.balance || 0}
          discountPct={
            currentPlanKey === "BUSINESS"
              ? 35
              : currentPlanKey === "GROWTH"
                ? 20
                : 0
          }
          unitPriceKES={500}
          // Lead-credit top-ups remain disabled until their ledger settlement
          // handler is implemented; do not route them through subscription checkout.
        />
      </div>

      {/* Plan Comparison Cards */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-[#16233B]">
          Choose or Change Your Plan
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.key === currentPlanKey;

            return (
              <div
                key={plan.id}
                className={`p-6 rounded-xl border flex flex-col justify-between transition-all ${
                  isCurrent
                    ? "border-[#16233B] bg-white ring-2 ring-[#16233B]/10 shadow-sm"
                    : "border-[#DFDACB] bg-[#FAF9F5] hover:border-[#16233B]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-base text-[#16233B]">
                      {plan.name}
                    </h3>
                    {isCurrent && (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[#16233B] text-white px-2 py-0.5 rounded">
                        Current
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-neutral-600 mt-2 min-h-9">
                    {plan.description}
                  </p>

                  <div className="mt-4 pb-4 border-b border-[#EAE6DC]">
                    <span className="text-2xl font-black text-[#16233B] font-mono">
                      KES {plan.priceMonthlyKES.toLocaleString()}
                    </span>
                    <span className="text-xs text-neutral-500 font-mono">
                      {" "}
                      / month
                    </span>
                  </div>

                  {/* Feature Checklist */}
                  <ul className="space-y-2 mt-4 text-xs text-neutral-700">
                    <li className="flex items-center gap-2">
                      <span className="text-[#3F6B4E] font-bold">✓</span>
                      <span>
                        Portfolio Projects:{" "}
                        <strong>
                          {plan.maxPortfolioProjects ?? "Unlimited"}
                        </strong>
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#3F6B4E] font-bold">✓</span>
                      <span>
                        Included Lead Credits:{" "}
                        <strong>{plan.monthlyLeadCredits}/mo</strong>
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#3F6B4E] font-bold">✓</span>
                      <span>
                        Lead Credit Discount:{" "}
                        <strong>{plan.leadCreditDiscountPct}%</strong>
                      </span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-[#3F6B4E] font-bold">✓</span>
                      <span>
                        Team Members:{" "}
                        <strong>{plan.maxTeamMembers ?? "Unlimited"}</strong>
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="pt-6 mt-6 border-t border-[#EAE6DC]">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 bg-neutral-100 text-neutral-500 rounded text-xs font-bold uppercase tracking-wider cursor-not-allowed"
                    >
                      Active Plan
                    </button>
                  ) : plan.priceMonthlyKES === 0 ? (
                    <button
                      type="button"
                      className="w-full py-2 border border-[#DFDACB] hover:bg-neutral-100 text-neutral-800 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Downgrade to Free
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setModalConfig({
                          isOpen: true,
                          title: `Upgrade to ${plan.name}`,
                          subtitle:
                            "Immediate upgrade via Safaricom M-Pesa STK",
                          amountKES: plan.priceMonthlyKES,
                          purpose: "SUBSCRIPTION_RENEWAL",
                          planKey: plan.key,
                        })
                      }
                      className="w-full py-2 bg-[#3F6B4E] hover:bg-[#32563E] text-white rounded text-xs font-bold uppercase tracking-wider transition-colors shadow-2xs cursor-pointer"
                    >
                      Upgrade with M-Pesa
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unified M-Pesa STK Checkout Modal */}
      <MpesaStkModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig((prev) => ({ ...prev, isOpen: false }))}
        title={modalConfig.title}
        subtitle={modalConfig.subtitle}
        amountKES={modalConfig.amountKES}
        purpose={modalConfig.purpose}
        onInitiateCheckout={handleInitiateCheckout}
        onPollStatus={handlePollStatus}
        onSuccess={() => {
          fetchData();
        }}
      />
    </div>
  );
}
