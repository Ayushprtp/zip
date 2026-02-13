"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "ui/badge";
import { Button } from "ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "ui/tabs";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "ui/alert-dialog";
import {
  Zap,
  Hash,
  Infinity,
  Check,
  Star,
  Coins,
  TrendingUp,
  Crown,
  Shield,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type {
  PricingPlanEntity,
  SubscriptionEntity,
} from "lib/db/pg/schema-billing.pg";
import { changePlanAction } from "@/app/actions/billing";
import { TIER_HIERARCHY } from "app-types/roles";

interface BillingPageProps {
  plans: PricingPlanEntity[];
  currentPlan: string;
  subscription: SubscriptionEntity | null;
  credits: {
    balance: string;
    totalCreditsUsed: string;
    monthlyCreditsUsed: string;
  } | null;
}

const PRICING_SECTIONS = [
  {
    value: "token_based" as const,
    label: "Token Based",
    icon: Zap,
    description: "Unlimited requests — use until your tokens run out",
    color: "text-amber-500",
  },
  {
    value: "request_based" as const,
    label: "Request Based",
    icon: Hash,
    description: "Unlimited tokens per request — pay per request count",
    color: "text-blue-500",
  },
  {
    value: "unlimited" as const,
    label: "Unlimited",
    icon: Infinity,
    description: "No limits on tokens or requests",
    color: "text-green-500",
  },
];

const TIER_GRADIENT: Record<string, string> = {
  free: "from-zinc-500/10 to-zinc-500/5",
  pro: "from-blue-500/10 to-blue-500/5",
  plus: "from-purple-500/10 to-purple-500/5",
  enterprise: "from-amber-500/10 to-amber-500/5",
};

const TIER_BORDER: Record<string, string> = {
  free: "border-zinc-500/20",
  pro: "border-blue-500/30",
  plus: "border-purple-500/30",
  enterprise: "border-amber-500/30",
};

const TIER_ICON: Record<string, React.ReactNode> = {
  free: <Star className="h-5 w-5 text-zinc-400" />,
  pro: <Zap className="h-5 w-5 text-blue-500" />,
  plus: <TrendingUp className="h-5 w-5 text-purple-500" />,
  enterprise: <Crown className="h-5 w-5 text-amber-500" />,
};

function parseFeatures(features: string | null): string[] {
  if (!features) return [];
  try {
    return JSON.parse(features);
  } catch {
    return [];
  }
}

function formatNumber(val: number | null | undefined) {
  if (val == null) return "Unlimited";
  return val.toLocaleString();
}

function formatCredits(val: string | number) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function BillingPage({
  plans,
  currentPlan,
  subscription,
  credits,
}: BillingPageProps) {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [confirmPlan, setConfirmPlan] = useState<PricingPlanEntity | null>(
    null,
  );
  const [isChanging, setIsChanging] = useState(false);
  const [changeError, setChangeError] = useState<string | null>(null);

  const handlePlanSelect = useCallback((plan: PricingPlanEntity) => {
    setChangeError(null);
    setConfirmPlan(plan);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!confirmPlan) return;
    setIsChanging(true);
    setChangeError(null);

    try {
      const formData = new FormData();
      formData.append("plan", confirmPlan.tier);
      const result = await changePlanAction(null, formData);

      if (result?.success) {
        toast.success(result.message || "Plan updated successfully");
        setConfirmPlan(null);
        router.refresh();
      } else {
        setChangeError(result?.message || "Failed to change plan");
      }
    } catch {
      setChangeError("An unexpected error occurred. Please try again.");
    } finally {
      setIsChanging(false);
    }
  }, [confirmPlan, router]);

  const getDirection = (targetTier: string) => {
    const currentLevel =
      TIER_HIERARCHY[currentPlan as keyof typeof TIER_HIERARCHY] ?? 0;
    const targetLevel =
      TIER_HIERARCHY[targetTier as keyof typeof TIER_HIERARCHY] ?? 0;
    if (targetLevel > currentLevel) return "upgrade";
    if (targetLevel < currentLevel) return "downgrade";
    return "same";
  };

  const plansByType = (type: string) =>
    plans
      .filter((p) => p.pricingType === type)
      .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">Plans & Billing</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your needs. Upgrade, downgrade, or switch
            pricing models anytime.
          </p>
        </div>

        {/* Current Plan Summary */}
        <Card className="max-w-2xl mx-auto">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                {TIER_ICON[currentPlan] || TIER_ICON.free}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <p className="text-lg font-semibold capitalize">
                  {currentPlan}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {credits && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    Credit Balance
                  </p>
                  <p className="text-lg font-semibold font-mono flex items-center gap-1.5">
                    <Coins className="h-4 w-4 text-amber-500" />
                    {formatCredits(credits.balance)}
                  </p>
                </div>
              )}
              {subscription?.status && (
                <Badge
                  variant={
                    subscription.status === "active" ? "default" : "outline"
                  }
                >
                  {subscription.status}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant={billingCycle === "monthly" ? "default" : "outline"}
            size="sm"
            onClick={() => setBillingCycle("monthly")}
          >
            Monthly
          </Button>
          <Button
            variant={billingCycle === "yearly" ? "default" : "outline"}
            size="sm"
            onClick={() => setBillingCycle("yearly")}
            className="gap-1.5"
          >
            Yearly
            <Badge
              variant="secondary"
              className="text-xs bg-green-500/10 text-green-600"
            >
              Save up to 20%
            </Badge>
          </Button>
        </div>

        {/* Pricing Sections */}
        <Tabs defaultValue="token_based" className="space-y-6">
          <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3">
            {PRICING_SECTIONS.map((section) => (
              <TabsTrigger
                key={section.value}
                value={section.value}
                className="gap-1.5"
              >
                <section.icon className={`h-4 w-4 ${section.color}`} />
                <span className="hidden sm:inline">{section.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {PRICING_SECTIONS.map((section) => (
            <TabsContent
              key={section.value}
              value={section.value}
              className="space-y-6"
            >
              <div className="text-center">
                <p className="text-muted-foreground">{section.description}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {plansByType(section.value).map((plan) => (
                  <PricingCard
                    key={plan.id}
                    plan={plan}
                    billingCycle={billingCycle}
                    isCurrentPlan={plan.tier === currentPlan}
                    pricingType={section.value}
                    direction={getDirection(plan.tier)}
                    onSelect={handlePlanSelect}
                    isLoading={isChanging && confirmPlan?.tier === plan.tier}
                  />
                ))}
              </div>

              {plansByType(section.value).length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <section.icon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No plans available in this category yet.</p>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Usage Summary */}
        {credits && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Usage Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="text-xl font-bold font-mono">
                    {formatCredits(credits.balance)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Usage</p>
                  <p className="text-xl font-bold font-mono">
                    {formatCredits(credits.monthlyCreditsUsed)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Lifetime Usage
                  </p>
                  <p className="text-xl font-bold font-mono">
                    {formatCredits(credits.totalCreditsUsed)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Limits by Plan */}
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Daily Limits by Plan
            </CardTitle>
            <CardDescription>
              Each plan has daily token and request limits. Limits reset at
              midnight UTC.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                      Limit
                    </th>
                    {(["free", "pro", "plus", "enterprise"] as const).map(
                      (tier) => (
                        <th
                          key={tier}
                          className="text-center py-2 px-3 font-medium"
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            {TIER_ICON[tier]}
                            <span className="capitalize">{tier}</span>
                          </div>
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      Daily Input Tokens
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">10K</td>
                    <td className="py-2.5 px-3 text-center font-mono">100K</td>
                    <td className="py-2.5 px-3 text-center font-mono">500K</td>
                    <td className="py-2.5 px-3 text-center font-mono text-green-600">
                      Unlimited
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      Daily Output Tokens
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">200K</td>
                    <td className="py-2.5 px-3 text-center font-mono">2.5M</td>
                    <td className="py-2.5 px-3 text-center font-mono">12M</td>
                    <td className="py-2.5 px-3 text-center font-mono text-green-600">
                      Unlimited
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      Daily Requests
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">100</td>
                    <td className="py-2.5 px-3 text-center font-mono">1,000</td>
                    <td className="py-2.5 px-3 text-center font-mono">5,000</td>
                    <td className="py-2.5 px-3 text-center font-mono text-green-600">
                      Unlimited
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      Requests/min
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">5</td>
                    <td className="py-2.5 px-3 text-center font-mono">30</td>
                    <td className="py-2.5 px-3 text-center font-mono">60</td>
                    <td className="py-2.5 px-3 text-center font-mono">100</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      Monthly Credits
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">1K</td>
                    <td className="py-2.5 px-3 text-center font-mono">20K</td>
                    <td className="py-2.5 px-3 text-center font-mono">50K</td>
                    <td className="py-2.5 px-3 text-center font-mono">100K</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      Concurrent Requests
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">1</td>
                    <td className="py-2.5 px-3 text-center font-mono">5</td>
                    <td className="py-2.5 px-3 text-center font-mono">10</td>
                    <td className="py-2.5 px-3 text-center font-mono">20</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Individual models may have additional per-model limits configured
              by the admin. Your current plan:{" "}
              <Badge variant="outline" className="ml-1 capitalize">
                {currentPlan}
              </Badge>
            </p>
          </CardContent>
        </Card>

        {/* Plan Change Confirmation Dialog */}
        <AlertDialog
          open={confirmPlan !== null}
          onOpenChange={(open) => {
            if (!open && !isChanging) {
              setConfirmPlan(null);
              setChangeError(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                {confirmPlan &&
                  getDirection(confirmPlan.tier) === "upgrade" && (
                    <ArrowUp className="h-5 w-5 text-green-500" />
                  )}
                {confirmPlan &&
                  getDirection(confirmPlan.tier) === "downgrade" && (
                    <ArrowDown className="h-5 w-5 text-orange-500" />
                  )}
                {confirmPlan && getDirection(confirmPlan.tier) === "upgrade"
                  ? "Upgrade"
                  : "Downgrade"}{" "}
                to {confirmPlan?.displayName}?
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>
                    You are about to{" "}
                    {confirmPlan && getDirection(confirmPlan.tier) === "upgrade"
                      ? "upgrade"
                      : "downgrade"}{" "}
                    from{" "}
                    <span className="font-semibold capitalize">
                      {currentPlan}
                    </span>{" "}
                    to{" "}
                    <span className="font-semibold">
                      {confirmPlan?.displayName}
                    </span>
                    .
                  </p>
                  {confirmPlan &&
                    getDirection(confirmPlan.tier) === "upgrade" && (
                      <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
                        You&apos;ll get access to higher limits and more
                        features. Monthly credits will be added to your balance.
                      </div>
                    )}
                  {confirmPlan &&
                    getDirection(confirmPlan.tier) === "downgrade" && (
                      <div className="rounded-md bg-orange-500/10 p-3 text-sm text-orange-700 dark:text-orange-400">
                        Your limits will be reduced. You&apos;ll keep your
                        existing credit balance, but monthly allocation will
                        decrease.
                      </div>
                    )}
                  {changeError && (
                    <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                      {changeError}
                    </div>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isChanging}>
                Cancel
              </AlertDialogCancel>
              <Button
                onClick={handleConfirm}
                disabled={isChanging}
                variant={
                  confirmPlan && getDirection(confirmPlan.tier) === "downgrade"
                    ? "outline"
                    : "default"
                }
              >
                {isChanging ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                    Processing...
                  </>
                ) : confirmPlan &&
                  getDirection(confirmPlan.tier) === "upgrade" ? (
                  <>
                    <ArrowUp className="h-4 w-4 mr-1.5" />
                    Confirm Upgrade
                  </>
                ) : (
                  <>
                    <ArrowDown className="h-4 w-4 mr-1.5" />
                    Confirm Downgrade
                  </>
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ============================================================================
// PRICING CARD
// ============================================================================

function PricingCard({
  plan,
  billingCycle,
  isCurrentPlan,
  pricingType,
  direction,
  onSelect,
  isLoading,
}: {
  plan: PricingPlanEntity;
  billingCycle: "monthly" | "yearly";
  isCurrentPlan: boolean;
  pricingType: string;
  direction: "upgrade" | "downgrade" | "same";
  onSelect: (plan: PricingPlanEntity) => void;
  isLoading: boolean;
}) {
  const features = parseFeatures(plan.features);
  const monthlyPrice = parseFloat(plan.monthlyPrice);
  const yearlyPrice = parseFloat(plan.yearlyPrice);
  const price = billingCycle === "monthly" ? monthlyPrice : yearlyPrice;
  const monthlyEquivalent =
    billingCycle === "yearly" ? yearlyPrice / 12 : monthlyPrice;
  const isFree = monthlyPrice === 0 && yearlyPrice === 0;

  return (
    <Card
      className={`relative flex flex-col transition-all duration-200 hover:shadow-lg ${
        plan.highlighted
          ? `border-2 border-primary shadow-md ring-1 ring-primary/10`
          : isCurrentPlan
            ? `border-2 ${TIER_BORDER[plan.tier]}`
            : "hover:border-muted-foreground/30"
      }`}
    >
      {/* Badge */}
      {(plan.badge || isCurrentPlan) && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
          <Badge
            className={
              isCurrentPlan
                ? "bg-green-600 text-white hover:bg-green-600"
                : "bg-primary text-primary-foreground"
            }
          >
            {isCurrentPlan ? "Current Plan" : plan.badge}
          </Badge>
        </div>
      )}

      <CardHeader
        className={`pb-3 bg-gradient-to-b ${TIER_GRADIENT[plan.tier]} rounded-t-lg`}
      >
        <div className="flex items-center gap-2">
          {TIER_ICON[plan.tier]}
          <CardTitle className="text-lg">{plan.displayName}</CardTitle>
        </div>
        {plan.description && (
          <CardDescription className="text-xs mt-1">
            {plan.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col pt-5 space-y-5">
        {/* Price */}
        <div>
          {isFree ? (
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">Free</span>
            </div>
          ) : (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold">
                  $
                  {billingCycle === "monthly"
                    ? price.toFixed(2)
                    : monthlyEquivalent.toFixed(2)}
                </span>
                <span className="text-muted-foreground text-sm">/mo</span>
              </div>
              {billingCycle === "yearly" && (
                <p className="text-xs text-muted-foreground mt-1">
                  ${yearlyPrice.toFixed(2)} billed yearly
                  {monthlyPrice > 0 && (
                    <span className="text-green-600 ml-1 font-medium">
                      Save{" "}
                      {Math.round(
                        (1 - yearlyPrice / (monthlyPrice * 12)) * 100,
                      )}
                      %
                    </span>
                  )}
                </p>
              )}
            </>
          )}
        </div>

        {/* Limits */}
        <div className="space-y-2 text-sm">
          {pricingType === "token_based" && (
            <div className="flex items-center gap-2 font-medium">
              <Zap className="h-4 w-4 text-amber-500 shrink-0" />
              {formatNumber(plan.tokenLimit)} tokens/month
            </div>
          )}
          {pricingType === "request_based" && (
            <div className="flex items-center gap-2 font-medium">
              <Hash className="h-4 w-4 text-blue-500 shrink-0" />
              {formatNumber(plan.requestLimit)} requests/
              {plan.requestPeriod || "month"}
            </div>
          )}
          {pricingType === "unlimited" && (
            <div className="flex items-center gap-2 font-medium">
              <Infinity className="h-4 w-4 text-green-500 shrink-0" />
              Unlimited usage
            </div>
          )}
          {parseFloat(plan.monthlyCredits || "0") > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Coins className="h-4 w-4 shrink-0" />
              {formatCredits(plan.monthlyCredits)} credits/mo included
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t" />

        {/* Features */}
        <div className="flex-1">
          {features.length > 0 && (
            <ul className="space-y-2">
              {features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* CTA */}
        <Button
          className="w-full mt-auto"
          variant={
            isCurrentPlan
              ? "outline"
              : plan.highlighted
                ? "default"
                : "secondary"
          }
          disabled={isCurrentPlan || isLoading}
          onClick={() => !isCurrentPlan && onSelect(plan)}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              Processing...
            </>
          ) : isCurrentPlan ? (
            "Current Plan"
          ) : direction === "upgrade" ? (
            <>
              <ArrowUp className="h-4 w-4 mr-1" />
              Upgrade
            </>
          ) : direction === "downgrade" ? (
            <>
              <ArrowDown className="h-4 w-4 mr-1" />
              Downgrade
            </>
          ) : (
            "Get Started"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
