"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "ui/card";
import { Badge } from "ui/badge";
import { Button } from "ui/button";
import { Input } from "ui/input";
import { Label } from "ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "ui/dialog";
import {
  CreditCard,
  Coins,
  Zap,
  Hash,
  Infinity,
  Star,
  Pencil,
  Plus,
} from "lucide-react";
import {
  updateSubscriptionAction,
  grantCreditsAction,
  setCreditsAction,
  setRequestsAction,
} from "@/app/api/admin/billing/actions";
import type {
  SubscriptionEntity,
  PricingPlanEntity,
} from "lib/db/pg/schema-billing.pg";

interface UserCreditsInfo {
  balance: string;
  totalCreditsUsed: string;
  totalCreditsGranted: string;
  totalCreditsPurchased: string;
  monthlyCreditsUsed: string;
  dailyRequestCount: number;
  dailyResetAt: string | null;
}

interface UserPlanCardProps {
  userId: string;
  userName: string;
  subscription: SubscriptionEntity | null;
  credits: UserCreditsInfo | null;
  pricingPlans: PricingPlanEntity[];
  view?: "admin" | "user";
}

const TIER_COLORS: Record<
  string,
  "secondary" | "default" | "destructive" | "outline"
> = {
  free: "secondary",
  pro: "default",
  premium: "default",
  plus: "outline",
  enterprise: "destructive",
};

function formatCredits(val: string | number) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function UserPlanCard({
  userId,
  userName,
  subscription: initialSubscription,
  credits: initialCredits,
  pricingPlans,
  view,
}: UserPlanCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Real-time credits polling (every 5s)
  const { data: liveData, mutate: mutateCredits } = useSWR<{
    credits: UserCreditsInfo | null;
    subscription: SubscriptionEntity | null;
  }>(view === "admin" ? `/api/admin/users/${userId}/credits` : null, fetcher, {
    fallbackData: {
      credits: initialCredits,
      subscription: initialSubscription,
    },
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  const credits = liveData?.credits ?? initialCredits;
  const subscription = liveData?.subscription ?? initialSubscription;

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Plan change dialog
  const [planDialog, setPlanDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>(
    subscription?.plan || "free",
  );
  const [selectedMonthlyCredits, setSelectedMonthlyCredits] = useState(
    subscription?.monthlyCredits || "",
  );

  // Grant credits dialog
  const [grantDialog, setGrantDialog] = useState(false);
  const [grantAmount, setGrantAmount] = useState("");
  const [grantDescription, setGrantDescription] = useState("");

  // Edit credits dialog
  const [editCreditsDialog, setEditCreditsDialog] = useState(false);
  const [editBalance, setEditBalance] = useState("");
  const [editTotalUsed, setEditTotalUsed] = useState("");
  const [editTotalGranted, setEditTotalGranted] = useState("");
  const [editMonthlyUsed, setEditMonthlyUsed] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Edit requests dialog
  const [editRequestsDialog, setEditRequestsDialog] = useState(false);
  const [editDailyRequestCount, setEditDailyRequestCount] = useState("");
  const [editRequestsDescription, setEditRequestsDescription] = useState("");

  const currentPlan = subscription?.plan || "free";
  const currentStatus = subscription?.status || "active";

  // Group plans by pricing type for display
  const plansByType = pricingPlans.reduce(
    (acc, plan) => {
      if (!acc[plan.pricingType]) acc[plan.pricingType] = [];
      acc[plan.pricingType].push(plan);
      return acc;
    },
    {} as Record<string, PricingPlanEntity[]>,
  );

  // Find the user's current active plan details
  const currentPlanDetails = pricingPlans.find(
    (p) => p.tier === currentPlan && p.isActive,
  );

  const handleUpdatePlan = () => {
    const fd = new FormData();
    fd.set("userId", userId);
    fd.set("plan", selectedPlan);
    if (selectedMonthlyCredits) {
      fd.set("monthlyCredits", selectedMonthlyCredits);
    }

    startTransition(async () => {
      const result = await updateSubscriptionAction(
        { success: false, message: "" },
        fd,
      );
      if (result?.success) {
        setFeedback({
          type: "success",
          message: result.message || "Plan updated",
        });
        setPlanDialog(false);
        mutateCredits();
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: result?.message || "Failed to update plan",
        });
      }
    });
  };

  const handleGrantCredits = () => {
    const fd = new FormData();
    fd.set("userId", userId);
    fd.set("amount", grantAmount);
    if (grantDescription) fd.set("description", grantDescription);

    startTransition(async () => {
      const result = await grantCreditsAction(
        { success: false, message: "" },
        fd,
      );
      if (result?.success) {
        setFeedback({
          type: "success",
          message: result.message || "Credits granted",
        });
        setGrantDialog(false);
        setGrantAmount("");
        setGrantDescription("");
        mutateCredits();
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: result?.message || "Failed to grant credits",
        });
      }
    });
  };

  const handleSetCredits = () => {
    const fd = new FormData();
    fd.set("userId", userId);
    fd.set("balance", editBalance);
    if (editTotalUsed) fd.set("totalCreditsUsed", editTotalUsed);
    if (editTotalGranted) fd.set("totalCreditsGranted", editTotalGranted);
    if (editMonthlyUsed) fd.set("monthlyCreditsUsed", editMonthlyUsed);
    if (editDescription) fd.set("description", editDescription);

    startTransition(async () => {
      const result = await setCreditsAction(
        { success: false, message: "" },
        fd,
      );
      if (result?.success) {
        setFeedback({
          type: "success",
          message: result.message || "Credits updated",
        });
        setEditCreditsDialog(false);
        setEditDescription("");
        mutateCredits();
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: result?.message || "Failed to update credits",
        });
      }
    });
  };

  const handleSetRequests = () => {
    const fd = new FormData();
    fd.set("userId", userId);
    fd.set("dailyRequestCount", editDailyRequestCount);
    if (editRequestsDescription) fd.set("description", editRequestsDescription);

    startTransition(async () => {
      const result = await setRequestsAction(
        { success: false, message: "" },
        fd,
      );
      if (result?.success) {
        setFeedback({
          type: "success",
          message: result.message || "Requests updated",
        });
        setEditRequestsDialog(false);
        setEditRequestsDescription("");
        mutateCredits();
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: result?.message || "Failed to update requests",
        });
      }
    });
  };

  if (view !== "admin") return null;

  return (
    <>
      <Card className="transition-all duration-200 hover:shadow-md">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Subscription & Credits
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Manage subscription plan and credit balance
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {feedback && (
            <div
              className={`p-3 rounded text-sm ${
                feedback.type === "success"
                  ? "bg-green-500/10 text-green-600"
                  : "bg-red-500/10 text-red-600"
              }`}
            >
              {feedback.message}
            </div>
          )}

          {/* Current Plan Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Star className="h-4 w-4" />
                Current Plan
              </Label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSelectedPlan(currentPlan);
                  setSelectedMonthlyCredits(subscription?.monthlyCredits || "");
                  setPlanDialog(true);
                }}
                className="h-8 text-xs"
              >
                <Pencil className="w-3 h-3 mr-1" />
                Change Plan
              </Button>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={TIER_COLORS[currentPlan] || "secondary"}
                    className="text-sm"
                  >
                    {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
                  </Badge>
                  <Badge
                    variant={currentStatus === "active" ? "default" : "outline"}
                    className="text-xs"
                  >
                    {currentStatus}
                  </Badge>
                </div>
                {subscription?.billingCycle && (
                  <span className="text-xs text-muted-foreground">
                    {subscription.billingCycle}
                  </span>
                )}
              </div>

              {currentPlanDetails && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    {currentPlanDetails.pricingType === "token_based" ? (
                      <>
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                        <span>
                          {currentPlanDetails.tokenLimit
                            ? `${currentPlanDetails.tokenLimit.toLocaleString()} tokens`
                            : "Unlimited tokens"}
                        </span>
                      </>
                    ) : currentPlanDetails.pricingType === "request_based" ? (
                      <>
                        <Hash className="h-3.5 w-3.5 text-blue-500" />
                        <span>
                          {currentPlanDetails.requestLimit
                            ? `${currentPlanDetails.requestLimit.toLocaleString()} requests`
                            : "Unlimited requests"}
                        </span>
                      </>
                    ) : (
                      <>
                        <Infinity className="h-3.5 w-3.5 text-green-500" />
                        <span>Unlimited usage</span>
                      </>
                    )}
                  </div>
                  {parseFloat(currentPlanDetails.monthlyCredits) > 0 && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Coins className="h-3.5 w-3.5" />
                      <span>
                        {formatCredits(currentPlanDetails.monthlyCredits)}{" "}
                        credits/mo
                      </span>
                    </div>
                  )}
                </div>
              )}

              {subscription?.currentPeriodEnd && (
                <p className="text-xs text-muted-foreground">
                  Current period ends:{" "}
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Credits Balance Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Coins className="h-4 w-4" />
                Credits
              </Label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setGrantDialog(true)}
                className="h-8 text-xs"
              >
                <Plus className="w-3 h-3 mr-1" />
                Grant Credits
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditBalance(credits?.balance || "0");
                  setEditTotalUsed(credits?.totalCreditsUsed || "0");
                  setEditTotalGranted(credits?.totalCreditsGranted || "0");
                  setEditMonthlyUsed(credits?.monthlyCreditsUsed || "0");
                  setEditDescription("");
                  setEditCreditsDialog(true);
                }}
                className="h-8 text-xs"
              >
                <Pencil className="w-3 h-3 mr-1" />
                Edit Credits
              </Button>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              {credits ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className="text-lg font-semibold font-mono">
                      {formatCredits(credits.balance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Monthly Used
                    </p>
                    <p className="text-lg font-semibold font-mono">
                      {formatCredits(credits.monthlyCreditsUsed)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Used</p>
                    <p className="text-sm font-mono text-muted-foreground">
                      {formatCredits(credits.totalCreditsUsed)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Total Granted
                    </p>
                    <p className="text-sm font-mono text-muted-foreground">
                      {formatCredits(credits.totalCreditsGranted)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No credit records yet
                </p>
              )}
            </div>
          </div>

          {/* Requests Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Requests
              </Label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditDailyRequestCount(
                    String(credits?.dailyRequestCount ?? 0),
                  );
                  setEditRequestsDescription("");
                  setEditRequestsDialog(true);
                }}
                className="h-8 text-xs"
              >
                <Pencil className="w-3 h-3 mr-1" />
                Edit Requests
              </Button>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              {credits ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Daily Request Count
                    </p>
                    <p className="text-lg font-semibold font-mono">
                      {credits.dailyRequestCount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Daily Reset At
                    </p>
                    <p className="text-sm font-mono text-muted-foreground">
                      {credits.dailyResetAt
                        ? new Date(credits.dailyResetAt).toLocaleString()
                        : "—"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No request records yet
                </p>
              )}
            </div>
          </div>

          {/* Available Plans Preview */}
          {Object.keys(plansByType).length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Available Plan Tiers
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {pricingPlans
                  .filter((p) => p.isActive)
                  .reduce((unique, plan) => {
                    if (!unique.find((u) => u.tier === plan.tier)) {
                      unique.push(plan);
                    }
                    return unique;
                  }, [] as PricingPlanEntity[])
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((plan) => (
                    <Badge
                      key={plan.id}
                      variant={
                        plan.tier === currentPlan ? "default" : "outline"
                      }
                      className="text-xs"
                    >
                      {plan.displayName}
                      {plan.tier === currentPlan && " ✓"}
                    </Badge>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Plan Dialog */}
      <Dialog open={planDialog} onOpenChange={setPlanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Subscription Plan</DialogTitle>
            <DialogDescription>
              Update the subscription plan for {userName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="plus">Plus</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Show matching pricing plans for the selected plan tier */}
            {pricingPlans.filter((p) => p.isActive && p.tier === selectedPlan)
              .length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Matching pricing plans
                </Label>
                <div className="space-y-1.5">
                  {pricingPlans
                    .filter((p) => p.isActive && p.tier === selectedPlan)
                    .map((plan) => (
                      <div
                        key={plan.id}
                        className="flex items-center justify-between rounded border p-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {plan.pricingType === "token_based"
                              ? "Token"
                              : plan.pricingType === "request_based"
                                ? "Request"
                                : "Unlimited"}
                          </Badge>
                          <span>{plan.displayName}</span>
                        </div>
                        <span className="text-muted-foreground">
                          ${parseFloat(plan.monthlyPrice).toFixed(2)}/mo
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Monthly Credits</Label>
              <Input
                type="number"
                value={selectedMonthlyCredits}
                onChange={(e) => setSelectedMonthlyCredits(e.target.value)}
                placeholder="Leave empty for plan default"
              />
              <p className="text-xs text-muted-foreground">
                Free: 1,000 | Premium: 10,000 | Enterprise: unlimited
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePlan} disabled={isPending}>
              {isPending ? "Updating..." : "Update Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant Credits Dialog */}
      <Dialog open={grantDialog} onOpenChange={setGrantDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Credits</DialogTitle>
            <DialogDescription>Grant credits to {userName}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                placeholder="e.g. 1000"
              />
              <p className="text-xs text-muted-foreground">
                1000 credits = $1 USD
              </p>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={grantDescription}
                onChange={(e) => setGrantDescription(e.target.value)}
                placeholder="Reason for granting credits"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleGrantCredits}
              disabled={isPending || !grantAmount}
            >
              {isPending ? "Granting..." : "Grant Credits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Credits Dialog */}
      <Dialog open={editCreditsDialog} onOpenChange={setEditCreditsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Credits</DialogTitle>
            <DialogDescription>
              Directly edit credit values for {userName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Balance *</Label>
              <Input
                type="number"
                step="0.01"
                value={editBalance}
                onChange={(e) => setEditBalance(e.target.value)}
                placeholder="e.g. 1000"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Total Used</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editTotalUsed}
                  onChange={(e) => setEditTotalUsed(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Total Granted</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editTotalGranted}
                  onChange={(e) => setEditTotalGranted(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Monthly Used</Label>
              <Input
                type="number"
                step="0.01"
                value={editMonthlyUsed}
                onChange={(e) => setEditMonthlyUsed(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Reason for editing credits"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditCreditsDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSetCredits}
              disabled={isPending || !editBalance}
            >
              {isPending ? "Saving..." : "Save Credits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Requests Dialog */}
      <Dialog open={editRequestsDialog} onOpenChange={setEditRequestsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Requests</DialogTitle>
            <DialogDescription>
              Directly edit the daily request count for {userName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Daily Request Count *</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={editDailyRequestCount}
                onChange={(e) => setEditDailyRequestCount(e.target.value)}
                placeholder="e.g. 0"
              />
              <p className="text-xs text-muted-foreground">
                Set to 0 to reset the daily request counter
              </p>
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                value={editRequestsDescription}
                onChange={(e) => setEditRequestsDescription(e.target.value)}
                placeholder="Reason for editing requests"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditRequestsDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSetRequests}
              disabled={isPending || editDailyRequestCount === ""}
            >
              {isPending ? "Saving..." : "Save Requests"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
