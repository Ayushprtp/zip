"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "ui/card";
import { Badge } from "ui/badge";
import { Button } from "ui/button";
import { Input } from "ui/input";
import { Label } from "ui/label";
import { Switch } from "ui/switch";
import { Textarea } from "ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "ui/select";
import {
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  Zap,
  Hash,
  Infinity,
  Star,
} from "lucide-react";
import Link from "next/link";
import {
  upsertPricingPlanAction,
  deletePricingPlanAction,
} from "@/app/api/admin/billing/actions";
import type { PricingPlanEntity } from "lib/db/pg/schema-billing.pg";

interface PlanFormData {
  id?: string;
  tier: "free" | "pro" | "plus" | "enterprise";
  pricingType: "token_based" | "request_based" | "unlimited";
  displayName: string;
  description: string;
  monthlyPrice: string;
  yearlyPrice: string;
  tokenLimit: string;
  requestLimit: string;
  requestPeriod: "daily" | "monthly";
  monthlyCredits: string;
  features: string;
  highlighted: boolean;
  badge: string;
  sortOrder: string;
  isActive: boolean;
}

const DEFAULT_FORM: PlanFormData = {
  tier: "free",
  pricingType: "token_based",
  displayName: "",
  description: "",
  monthlyPrice: "0",
  yearlyPrice: "0",
  tokenLimit: "",
  requestLimit: "",
  requestPeriod: "monthly",
  monthlyCredits: "0",
  features: "[]",
  highlighted: false,
  badge: "",
  sortOrder: "0",
  isActive: true,
};

const PRICING_TYPES = [
  {
    value: "token_based" as const,
    label: "Token Based",
    icon: Zap,
    description: "Unlimited requests until tokens run out",
  },
  {
    value: "request_based" as const,
    label: "Request Based",
    icon: Hash,
    description: "Unlimited tokens with limited requests",
  },
  {
    value: "unlimited" as const,
    label: "Unlimited",
    icon: Infinity,
    description: "Unlimited tokens and unlimited requests",
  },
];

const TIER_COLORS: Record<
  string,
  "secondary" | "default" | "destructive" | "outline"
> = {
  free: "secondary",
  pro: "default",
  plus: "outline",
  enterprise: "destructive",
};

function parseFeatures(features: string | null): string[] {
  if (!features) return [];
  try {
    return JSON.parse(features);
  } catch {
    return [];
  }
}

function formatPrice(val: string | number) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (n === 0) return "Free";
  return `$${n.toFixed(2)}`;
}

function formatNumber(val: number | null | undefined) {
  if (val == null) return "Unlimited";
  return val.toLocaleString();
}

interface Props {
  initialPlans?: PricingPlanEntity[];
}

export function PlansManager({ initialPlans = [] }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<string>("token_based");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<PlanFormData>(DEFAULT_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    planId: string;
    planName: string;
  }>({ open: false, planId: "", planName: "" });
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [featuresInput, setFeaturesInput] = useState("");

  const plansByType = (type: string) =>
    initialPlans
      .filter((p) => p.pricingType === type)
      .sort((a, b) => a.sortOrder - b.sortOrder);

  const openCreate = (
    pricingType: "token_based" | "request_based" | "unlimited",
  ) => {
    const plans = plansByType(pricingType);
    setFormData({
      ...DEFAULT_FORM,
      pricingType,
      sortOrder: String(plans.length),
    });
    setFeaturesInput("");
    setFeedback(null);
    setIsDialogOpen(true);
  };

  const openEdit = (plan: PricingPlanEntity) => {
    const features = parseFeatures(plan.features);
    setFormData({
      id: plan.id,
      tier: plan.tier as PlanFormData["tier"],
      pricingType: plan.pricingType as PlanFormData["pricingType"],
      displayName: plan.displayName,
      description: plan.description || "",
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      tokenLimit: plan.tokenLimit?.toString() || "",
      requestLimit: plan.requestLimit?.toString() || "",
      requestPeriod: (plan.requestPeriod as "daily" | "monthly") || "monthly",
      monthlyCredits: plan.monthlyCredits || "0",
      features: plan.features || "[]",
      highlighted: plan.highlighted,
      badge: plan.badge || "",
      sortOrder: plan.sortOrder.toString(),
      isActive: plan.isActive,
    });
    setFeaturesInput(features.join("\n"));
    setFeedback(null);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    // Convert features lines to JSON array
    const featuresArray = featuresInput
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
    const featuresJson = JSON.stringify(featuresArray);

    const fd = new FormData();
    if (formData.id) fd.set("id", formData.id);
    fd.set("tier", formData.tier);
    fd.set("pricingType", formData.pricingType);
    fd.set("displayName", formData.displayName);
    fd.set("description", formData.description);
    fd.set("monthlyPrice", formData.monthlyPrice);
    fd.set("yearlyPrice", formData.yearlyPrice);
    if (formData.tokenLimit) fd.set("tokenLimit", formData.tokenLimit);
    if (formData.requestLimit) fd.set("requestLimit", formData.requestLimit);
    fd.set("requestPeriod", formData.requestPeriod);
    fd.set("monthlyCredits", formData.monthlyCredits);
    fd.set("features", featuresJson);
    fd.set("highlighted", String(formData.highlighted));
    if (formData.badge) fd.set("badge", formData.badge);
    fd.set("sortOrder", formData.sortOrder);
    fd.set("isActive", String(formData.isActive));

    startTransition(async () => {
      const result = await upsertPricingPlanAction(
        { success: false, message: "" },
        fd,
      );
      if (result?.success) {
        setFeedback({ type: "success", message: result.message || "Saved" });
        setIsDialogOpen(false);
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: result?.message || "Failed to save",
        });
      }
    });
  };

  const handleDelete = (planId: string) => {
    const fd = new FormData();
    fd.set("id", planId);

    startTransition(async () => {
      const result = await deletePricingPlanAction(
        { success: false, message: "" },
        fd,
      );
      if (result?.success) {
        setFeedback({ type: "success", message: result.message || "Deleted" });
        setDeleteConfirm({ open: false, planId: "", planName: "" });
        router.refresh();
      } else {
        setFeedback({
          type: "error",
          message: result?.message || "Failed to delete",
        });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/admin/billing">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <h2 className="text-xl font-semibold">Pricing Plans</h2>
      </div>

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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          {PRICING_TYPES.map((pt) => (
            <TabsTrigger key={pt.value} value={pt.value} className="gap-2">
              <pt.icon className="h-4 w-4" />
              {pt.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {PRICING_TYPES.map((pt) => (
          <TabsContent key={pt.value} value={pt.value} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {pt.description}
                </p>
              </div>
              <Button
                onClick={() => openCreate(pt.value)}
                size="sm"
                className="gap-1"
              >
                <Plus className="h-4 w-4" /> Add Plan
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {plansByType(pt.value).map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  pricingType={pt.value}
                  onEdit={() => openEdit(plan)}
                  onDelete={() =>
                    setDeleteConfirm({
                      open: true,
                      planId: plan.id,
                      planName: plan.displayName,
                    })
                  }
                />
              ))}

              {plansByType(pt.value).length === 0 && (
                <Card className="col-span-full border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <pt.icon className="h-8 w-8 mb-2" />
                    <p>No {pt.label.toLowerCase()} plans configured</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 gap-1"
                      onClick={() => openCreate(pt.value)}
                    >
                      <Plus className="h-4 w-4" /> Create First Plan
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {formData.id ? "Edit" : "Create"} Pricing Plan
            </DialogTitle>
            <DialogDescription>
              Configure the pricing plan details for the{" "}
              {PRICING_TYPES.find((pt) => pt.value === formData.pricingType)
                ?.label || ""}{" "}
              section.
            </DialogDescription>
          </DialogHeader>

          {feedback && isDialogOpen && (
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

          <div className="grid gap-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tier *</Label>
                <Select
                  value={formData.tier}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      tier: v as PlanFormData["tier"],
                    })
                  }
                >
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

              <div className="space-y-2">
                <Label>Display Name *</Label>
                <Input
                  value={formData.displayName}
                  onChange={(e) =>
                    setFormData({ ...formData, displayName: e.target.value })
                  }
                  placeholder="e.g. Pro Plan"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Short plan description"
              />
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Monthly Price ($) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.monthlyPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, monthlyPrice: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Yearly Price ($) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.yearlyPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, yearlyPrice: e.target.value })
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Type-specific limits */}
            {formData.pricingType === "token_based" && (
              <div className="space-y-2">
                <Label>Token Limit</Label>
                <Input
                  type="number"
                  value={formData.tokenLimit}
                  onChange={(e) =>
                    setFormData({ ...formData, tokenLimit: e.target.value })
                  }
                  placeholder="Leave empty for unlimited"
                />
                <p className="text-xs text-muted-foreground">
                  Maximum tokens per month. Leave empty for unlimited.
                </p>
              </div>
            )}

            {formData.pricingType === "request_based" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Request Limit</Label>
                  <Input
                    type="number"
                    value={formData.requestLimit}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        requestLimit: e.target.value,
                      })
                    }
                    placeholder="Leave empty for unlimited"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Select
                    value={formData.requestPeriod}
                    onValueChange={(v) =>
                      setFormData({
                        ...formData,
                        requestPeriod: v as "daily" | "monthly",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Credits */}
            <div className="space-y-2">
              <Label>Monthly Credits</Label>
              <Input
                type="number"
                value={formData.monthlyCredits}
                onChange={(e) =>
                  setFormData({ ...formData, monthlyCredits: e.target.value })
                }
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Credits included with this plan each month.
              </p>
            </div>

            {/* Features */}
            <div className="space-y-2">
              <Label>Features (one per line)</Label>
              <Textarea
                value={featuresInput}
                onChange={(e) => setFeaturesInput(e.target.value)}
                placeholder={"Feature 1\nFeature 2\nFeature 3"}
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Enter one feature per line. These will be displayed as a bullet
                list on the pricing card.
              </p>
            </div>

            {/* UI Options */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Badge Text</Label>
                <Input
                  value={formData.badge}
                  onChange={(e) =>
                    setFormData({ ...formData, badge: e.target.value })
                  }
                  placeholder='e.g. "Most Popular"'
                />
              </div>

              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData({ ...formData, sortOrder: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.highlighted}
                  onCheckedChange={(v) =>
                    setFormData({ ...formData, highlighted: v })
                  }
                />
                <Label>Highlighted</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(v) =>
                    setFormData({ ...formData, isActive: v })
                  }
                />
                <Label>Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                isPending || !formData.displayName || !formData.monthlyPrice
              }
            >
              {isPending
                ? "Saving..."
                : formData.id
                  ? "Update Plan"
                  : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        open={deleteConfirm.open}
        onOpenChange={(open) => setDeleteConfirm({ ...deleteConfirm, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteConfirm.planName}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDeleteConfirm({ open: false, planId: "", planName: "" })
              }
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(deleteConfirm.planId)}
              disabled={isPending}
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// PLAN CARD COMPONENT
// ============================================================================

function PlanCard({
  plan,
  pricingType,
  onEdit,
  onDelete,
}: {
  plan: PricingPlanEntity;
  pricingType: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const features = parseFeatures(plan.features);
  const monthlyPrice = parseFloat(plan.monthlyPrice);
  const yearlyPrice = parseFloat(plan.yearlyPrice);

  return (
    <Card
      className={`relative flex flex-col ${
        plan.highlighted ? "border-primary ring-2 ring-primary/20" : ""
      } ${!plan.isActive ? "opacity-60" : ""}`}
    >
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground">
            {plan.badge}
          </Badge>
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge variant={TIER_COLORS[plan.tier] || "secondary"}>
            {plan.tier.toUpperCase()}
          </Badge>
          {!plan.isActive && (
            <Badge variant="outline" className="text-xs">
              Inactive
            </Badge>
          )}
        </div>
        <CardTitle className="text-lg">{plan.displayName}</CardTitle>
        {plan.description && (
          <CardDescription className="text-xs">
            {plan.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {/* Pricing */}
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">
              {formatPrice(monthlyPrice)}
            </span>
            {monthlyPrice > 0 && (
              <span className="text-muted-foreground text-sm">/mo</span>
            )}
          </div>
          {yearlyPrice > 0 && (
            <p className="text-xs text-muted-foreground">
              ${yearlyPrice.toFixed(2)}/year
              {monthlyPrice > 0 && (
                <span className="text-green-600 ml-1">
                  (Save{" "}
                  {Math.round((1 - yearlyPrice / (monthlyPrice * 12)) * 100)}
                  %)
                </span>
              )}
            </p>
          )}
        </div>

        {/* Limits */}
        <div className="space-y-1 text-sm">
          {pricingType === "token_based" && (
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>{formatNumber(plan.tokenLimit)} tokens</span>
            </div>
          )}
          {pricingType === "request_based" && (
            <div className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5 text-blue-500" />
              <span>
                {formatNumber(plan.requestLimit)} requests/
                {plan.requestPeriod || "month"}
              </span>
            </div>
          )}
          {pricingType === "unlimited" && (
            <div className="flex items-center gap-1.5">
              <Infinity className="h-3.5 w-3.5 text-green-500" />
              <span>Unlimited usage</span>
            </div>
          )}
          {parseFloat(plan.monthlyCredits || "0") > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Star className="h-3.5 w-3.5" />
              <span>
                {parseFloat(plan.monthlyCredits).toLocaleString()} credits/mo
              </span>
            </div>
          )}
        </div>

        {/* Features */}
        {features.length > 0 && (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {features.slice(0, 5).map((f, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-green-500 mt-0.5">✓</span>
                <span>{f}</span>
              </li>
            ))}
            {features.length > 5 && (
              <li className="text-xs italic">
                +{features.length - 5} more features
              </li>
            )}
          </ul>
        )}
      </CardContent>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1 p-3 pt-0">
        <Button variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5 mr-1" />
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1" />
          Delete
        </Button>
      </div>
    </Card>
  );
}
