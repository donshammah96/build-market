"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "react-toastify";
import { PlanChip } from "@build/ui/plan-chip";
import {
  getSubscriptionPlans,
  updateSubscriptionPlan,
} from "@/actions/admin/subscriptions";

interface SubscriptionPlanRow {
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
  platformFeePct: number;
  isActive: boolean;
}

export default function SubscriptionPlansAdminPage() {
  const [plans, setPlans] = useState<SubscriptionPlanRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlanRow | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  // Form State for editing
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    priceMonthlyKES: 0,
    priceAnnualKES: 0,
    monthlyLeadCredits: 0,
    leadCreditDiscountPct: 0,
    maxPortfolioProjects: 0 as number | null,
    maxTeamMembers: 0 as number | null,
    platformFeePct: 10,
  });

  const loadPlans = async () => {
    setIsLoading(true);
    try {
      const res = await getSubscriptionPlans();
      if (res.success && res.data) {
        setPlans(res.data as unknown as SubscriptionPlanRow[]);
      } else {
        // Mock fallback plans
        setPlans([
          {
            id: "plan-1",
            key: "FREE",
            name: "Msingi (Free)",
            description: "Essential tools for artisans and starting pros",
            priceMonthlyKES: 0,
            priceAnnualKES: 0,
            monthlyLeadCredits: 0,
            leadCreditDiscountPct: 0,
            maxPortfolioProjects: 3,
            maxTeamMembers: 1,
            platformFeePct: 10,
            isActive: true,
          },
          {
            id: "plan-2",
            key: "GROWTH",
            name: "Kuza (Growth)",
            description: "Growing contractors and active service providers",
            priceMonthlyKES: 1500,
            priceAnnualKES: 15000,
            monthlyLeadCredits: 3,
            leadCreditDiscountPct: 20,
            maxPortfolioProjects: 15,
            maxTeamMembers: 3,
            platformFeePct: 7,
            isActive: true,
          },
          {
            id: "plan-3",
            key: "BUSINESS",
            name: "Bora (Business)",
            description:
              "Enterprise tier with unlimited pipeline and dedicated lead flow",
            priceMonthlyKES: 6000,
            priceAnnualKES: 60000,
            monthlyLeadCredits: 15,
            leadCreditDiscountPct: 35,
            maxPortfolioProjects: null,
            maxTeamMembers: null,
            platformFeePct: 4,
            isActive: true,
          },
        ]);
      }
    } catch {
      // Graceful fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  const handleEditClick = (plan: SubscriptionPlanRow) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name || "",
      description: plan.description || "",
      priceMonthlyKES: Number(plan.priceMonthlyKES || 0),
      priceAnnualKES: Number(plan.priceAnnualKES || 0),
      monthlyLeadCredits: Number(plan.monthlyLeadCredits || 0),
      leadCreditDiscountPct: Number(plan.leadCreditDiscountPct || 0),
      maxPortfolioProjects: plan.maxPortfolioProjects,
      maxTeamMembers: plan.maxTeamMembers,
      platformFeePct: Number(plan.platformFeePct || 10),
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    setIsSaving(true);
    try {
      const res = await updateSubscriptionPlan(editingPlan.id, {
        name: formData.name,
        description: formData.description,
        priceMonthlyKES: formData.priceMonthlyKES,
        priceAnnualKES: formData.priceAnnualKES,
        monthlyLeadCredits: formData.monthlyLeadCredits,
        leadCreditDiscountPct: formData.leadCreditDiscountPct,
        maxPortfolioProjects: formData.maxPortfolioProjects,
        maxTeamMembers: formData.maxTeamMembers,
        platformFeePct: formData.platformFeePct,
      });

      if (!res.success) {
        toast.error(res.error || "Failed to update plan");
        return;
      }

      toast.success("Subscription plan updated successfully.");
      setEditingPlan(null);
      void loadPlans();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error saving plan");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl font-sans pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#16233B]">
            Subscription Plans Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure platform subscription tiers, monthly lead credits, and
            discount structures.
          </p>
        </div>
      </div>

      {/* Grid of Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.id}
            className="border-[#DFDACB] bg-[#FAF9F5] flex flex-col justify-between"
          >
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <PlanChip planKey={plan.key} planName={plan.name} size="md" />
                <span className="text-xs font-mono font-bold text-neutral-500">
                  {plan.isActive ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>
              <CardTitle className="text-lg font-bold text-[#16233B] mt-2">
                {plan.name}
              </CardTitle>
              <CardDescription className="text-xs text-neutral-600">
                {plan.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="p-3 bg-white border border-[#EAE6DC] rounded-lg">
                <span className="text-xs font-mono text-neutral-500 block">
                  Pricing
                </span>
                <div className="text-xl font-extrabold text-[#16233B] font-mono">
                  KES {Number(plan.priceMonthlyKES).toLocaleString()}{" "}
                  <span className="text-xs font-normal text-neutral-500">
                    / mo
                  </span>
                </div>
                <div className="text-xs text-neutral-500 font-mono mt-1">
                  KES {Number(plan.priceAnnualKES || 0).toLocaleString()} / yr
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-neutral-700">
                <div className="flex justify-between">
                  <span>Monthly Lead Credits:</span>
                  <strong className="font-mono">
                    {plan.monthlyLeadCredits}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Lead Credit Discount:</span>
                  <strong className="font-mono">
                    {plan.leadCreditDiscountPct}%
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Max Portfolio Projects:</span>
                  <strong className="font-mono">
                    {plan.maxPortfolioProjects ?? "Unlimited"}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Max Team Members:</span>
                  <strong className="font-mono">
                    {plan.maxTeamMembers ?? "Unlimited"}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Platform Fee:</span>
                  <strong className="font-mono">{plan.platformFeePct}%</strong>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEditClick(plan)}
                className="w-full mt-4 border-[#DFDACB] hover:bg-neutral-100 font-semibold"
              >
                Edit Plan Parameters
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Plan Dialog */}
      <Dialog
        open={Boolean(editingPlan)}
        onOpenChange={(open) => !open && setEditingPlan(null)}
      >
        <DialogContent className="max-w-lg font-sans">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-[#16233B]">
              Edit {editingPlan?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-neutral-500">
              Update plan parameters and monetization rules.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            {/* Price Change Caution Notice */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
              <strong>ℹ️ Policy on Price Updates:</strong>
              <p>
                Updating monthly or annual prices applies to{" "}
                <strong>new subscribers</strong> immediately. Existing
                subscribers retain their grandfathered renewal rate unless
                modified via individual override.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold uppercase">
                  Monthly Price (KES)
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.priceMonthlyKES}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priceMonthlyKES: Number(e.target.value),
                    })
                  }
                  className="mt-1 font-mono text-sm"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase">
                  Annual Price (KES)
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.priceAnnualKES}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      priceAnnualKES: Number(e.target.value),
                    })
                  }
                  className="mt-1 font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold uppercase">
                  Monthly Lead Credits
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.monthlyLeadCredits}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      monthlyLeadCredits: Number(e.target.value),
                    })
                  }
                  className="mt-1 font-mono text-sm"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase">
                  Lead Credit Discount (%)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.leadCreditDiscountPct}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      leadCreditDiscountPct: Number(e.target.value),
                    })
                  }
                  className="mt-1 font-mono text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold uppercase">Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
                className="mt-1 text-xs"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingPlan(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-[#16233B] text-white"
              >
                {isSaving ? "Saving..." : "Save Plan Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
