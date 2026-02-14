"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "ui/table";
import { Badge } from "ui/badge";
import { Button } from "ui/button";
import { Input } from "ui/input";
import { Card, CardContent } from "ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "ui/dialog";
import { Label } from "ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "ui/select";
import { Plus, Pencil, Trash2, ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { Switch } from "ui/switch";
import {
  upsertModelPricingAction,
  deleteModelPricingAction,
} from "@/app/api/admin/billing/actions";
import type { ModelPricingEntity } from "lib/db/pg/schema-billing.pg";

interface Props {
  initialPricing: ModelPricingEntity[];
}

interface FormData {
  id?: string;
  provider: string;
  model: string;
  inputPricePerMillion: string;
  outputPricePerMillion: string;
  creditMultiplier: string;
  isPartnerOnly: boolean;
  minimumPlan: "free" | "pro" | "plus" | "enterprise";
  displayName: string;
  description: string;
  contextWindow: string;
  maxOutputTokens: string;
  customRpmLimit: string;
  customRpdLimit: string;
  isEnabled: boolean;
  // Per-tier daily limits
  dailyInputTokensFree: string;
  dailyInputTokensPro: string;
  dailyInputTokensPlus: string;
  dailyInputTokensEnterprise: string;
  dailyOutputTokensFree: string;
  dailyOutputTokensPro: string;
  dailyOutputTokensPlus: string;
  dailyOutputTokensEnterprise: string;
  dailyRequestsFree: string;
  dailyRequestsPro: string;
  dailyRequestsPlus: string;
  dailyRequestsEnterprise: string;
  rpmFree: string;
  rpmPro: string;
  rpmPlus: string;
  rpmEnterprise: string;
}

const DEFAULT_FORM: FormData = {
  provider: "",
  model: "",
  inputPricePerMillion: "",
  outputPricePerMillion: "",
  creditMultiplier: "1000",
  isPartnerOnly: false,
  minimumPlan: "free",
  displayName: "",
  description: "",
  contextWindow: "",
  maxOutputTokens: "",
  customRpmLimit: "",
  customRpdLimit: "",
  isEnabled: true,
  dailyInputTokensFree: "",
  dailyInputTokensPro: "",
  dailyInputTokensPlus: "",
  dailyInputTokensEnterprise: "",
  dailyOutputTokensFree: "",
  dailyOutputTokensPro: "",
  dailyOutputTokensPlus: "",
  dailyOutputTokensEnterprise: "",
  dailyRequestsFree: "",
  dailyRequestsPro: "",
  dailyRequestsPlus: "",
  dailyRequestsEnterprise: "",
  rpmFree: "",
  rpmPro: "",
  rpmPlus: "",
  rpmEnterprise: "",
};

export function ModelPricingManager({ initialPricing }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const filtered = initialPricing.filter(
    (p) =>
      !search ||
      p.provider.toLowerCase().includes(search.toLowerCase()) ||
      p.model.toLowerCase().includes(search.toLowerCase()) ||
      (p.displayName || "").toLowerCase().includes(search.toLowerCase()),
  );

  const openCreate = () => {
    setFormData(DEFAULT_FORM);
    setFeedback(null);
    setIsDialogOpen(true);
  };

  const openEdit = (p: ModelPricingEntity) => {
    setFormData({
      id: p.id,
      provider: p.provider,
      model: p.model,
      inputPricePerMillion: p.inputPricePerMillion,
      outputPricePerMillion: p.outputPricePerMillion,
      creditMultiplier: p.creditMultiplier,
      isPartnerOnly: p.isPartnerOnly,
      minimumPlan: p.minimumPlan as "free" | "pro" | "plus" | "enterprise",
      displayName: p.displayName || "",
      description: p.description || "",
      contextWindow: p.contextWindow?.toString() || "",
      maxOutputTokens: p.maxOutputTokens?.toString() || "",
      customRpmLimit: p.customRpmLimit?.toString() || "",
      customRpdLimit: p.customRpdLimit?.toString() || "",
      isEnabled: p.isEnabled,
      dailyInputTokensFree: p.dailyInputTokensFree?.toString() || "",
      dailyInputTokensPro: p.dailyInputTokensPro?.toString() || "",
      dailyInputTokensPlus: p.dailyInputTokensPlus?.toString() || "",
      dailyInputTokensEnterprise:
        p.dailyInputTokensEnterprise?.toString() || "",
      dailyOutputTokensFree: p.dailyOutputTokensFree?.toString() || "",
      dailyOutputTokensPro: p.dailyOutputTokensPro?.toString() || "",
      dailyOutputTokensPlus: p.dailyOutputTokensPlus?.toString() || "",
      dailyOutputTokensEnterprise:
        p.dailyOutputTokensEnterprise?.toString() || "",
      dailyRequestsFree: p.dailyRequestsFree?.toString() || "",
      dailyRequestsPro: p.dailyRequestsPro?.toString() || "",
      dailyRequestsPlus: p.dailyRequestsPlus?.toString() || "",
      dailyRequestsEnterprise: p.dailyRequestsEnterprise?.toString() || "",
      rpmFree: p.rpmFree?.toString() || "",
      rpmPro: p.rpmPro?.toString() || "",
      rpmPlus: p.rpmPlus?.toString() || "",
      rpmEnterprise: p.rpmEnterprise?.toString() || "",
    });
    setFeedback(null);
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    const fd = new FormData();
    if (formData.id) fd.set("id", formData.id);
    fd.set("provider", formData.provider);
    fd.set("model", formData.model);
    fd.set("inputPricePerMillion", formData.inputPricePerMillion);
    fd.set("outputPricePerMillion", formData.outputPricePerMillion);
    fd.set("creditMultiplier", formData.creditMultiplier);
    fd.set("isPartnerOnly", String(formData.isPartnerOnly));
    fd.set("minimumPlan", formData.minimumPlan);
    if (formData.displayName) fd.set("displayName", formData.displayName);
    if (formData.description) fd.set("description", formData.description);
    if (formData.contextWindow) fd.set("contextWindow", formData.contextWindow);
    if (formData.maxOutputTokens)
      fd.set("maxOutputTokens", formData.maxOutputTokens);
    if (formData.customRpmLimit)
      fd.set("customRpmLimit", formData.customRpmLimit);
    if (formData.customRpdLimit)
      fd.set("customRpdLimit", formData.customRpdLimit);
    fd.set("isEnabled", String(formData.isEnabled));

    // Per-tier daily limits
    const tierFields = [
      "dailyInputTokensFree",
      "dailyInputTokensPro",
      "dailyInputTokensPlus",
      "dailyInputTokensEnterprise",
      "dailyOutputTokensFree",
      "dailyOutputTokensPro",
      "dailyOutputTokensPlus",
      "dailyOutputTokensEnterprise",
      "dailyRequestsFree",
      "dailyRequestsPro",
      "dailyRequestsPlus",
      "dailyRequestsEnterprise",
      "rpmFree",
      "rpmPro",
      "rpmPlus",
      "rpmEnterprise",
    ] as const;
    for (const field of tierFields) {
      if (formData[field]) fd.set(field, formData[field]);
    }

    startTransition(async () => {
      const result = await upsertModelPricingAction(
        { success: false, message: "" },
        fd,
      );
      if (result.success) {
        setFeedback({ type: "success", message: result.message || "Saved" });
        setIsDialogOpen(false);
        router.refresh();
      } else {
        setFeedback({ type: "error", message: result.message || "Failed" });
      }
    });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this pricing entry?")) return;
    const fd = new FormData();
    fd.set("id", id);
    startTransition(async () => {
      const result = await deleteModelPricingAction(
        { success: false, message: "" },
        fd,
      );
      if (result?.success) {
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/admin/billing">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </Link>
          <h2 className="text-xl font-semibold">Model Pricing</h2>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Add Pricing
        </Button>
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by provider or model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Input $/1M</TableHead>
                <TableHead>Output $/1M</TableHead>
                <TableHead>Multiplier</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {search
                      ? "No pricing entries match your search"
                      : "No pricing entries yet. Click 'Add Pricing' to create one."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.provider}</TableCell>
                    <TableCell>
                      <div>
                        <span>{p.displayName || p.model}</span>
                        {p.displayName && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({p.model})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>${p.inputPricePerMillion}</TableCell>
                    <TableCell>${p.outputPricePerMillion}</TableCell>
                    <TableCell>{p.creditMultiplier}x</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          p.minimumPlan === "enterprise"
                            ? "destructive"
                            : p.minimumPlan === "plus"
                              ? "default"
                              : p.minimumPlan === "pro"
                                ? "default"
                                : "secondary"
                        }
                      >
                        {p.minimumPlan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.isEnabled ? "default" : "outline"}>
                        {p.isEnabled ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(p.id)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {formData.id ? "Edit Model Pricing" : "Add Model Pricing"}
            </DialogTitle>
            <DialogDescription>
              Configure pricing per million tokens for this model.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider *</Label>
              <Input
                value={formData.provider}
                onChange={(e) =>
                  setFormData({ ...formData, provider: e.target.value })
                }
                placeholder="e.g. openai, anthropic, google"
              />
            </div>
            <div className="space-y-2">
              <Label>Model ID *</Label>
              <Input
                value={formData.model}
                onChange={(e) =>
                  setFormData({ ...formData, model: e.target.value })
                }
                placeholder="e.g. gpt-4o, claude-3.5-sonnet"
              />
            </div>
            <div className="space-y-2">
              <Label>Input Price ($/1M tokens) *</Label>
              <Input
                type="number"
                step="0.0001"
                value={formData.inputPricePerMillion}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    inputPricePerMillion: e.target.value,
                  })
                }
                placeholder="2.50"
              />
            </div>
            <div className="space-y-2">
              <Label>Output Price ($/1M tokens) *</Label>
              <Input
                type="number"
                step="0.0001"
                value={formData.outputPricePerMillion}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    outputPricePerMillion: e.target.value,
                  })
                }
                placeholder="10.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Credit Multiplier</Label>
              <Input
                type="number"
                value={formData.creditMultiplier}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    creditMultiplier: e.target.value,
                  })
                }
                placeholder="1000"
              />
              <p className="text-xs text-muted-foreground">
                Credits per $1 of cost (default: 1000)
              </p>
            </div>
            <div className="space-y-2">
              <Label>Minimum Plan</Label>
              <Select
                value={formData.minimumPlan}
                onValueChange={(v) =>
                  setFormData({
                    ...formData,
                    minimumPlan: v as "free" | "pro" | "plus" | "enterprise",
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
              <Label>Display Name</Label>
              <Input
                value={formData.displayName}
                onChange={(e) =>
                  setFormData({ ...formData, displayName: e.target.value })
                }
                placeholder="GPT-4o"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Most capable model"
              />
            </div>
            <div className="space-y-2">
              <Label>Context Window</Label>
              <Input
                type="number"
                value={formData.contextWindow}
                onChange={(e) =>
                  setFormData({ ...formData, contextWindow: e.target.value })
                }
                placeholder="128000"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Output Tokens</Label>
              <Input
                type="number"
                value={formData.maxOutputTokens}
                onChange={(e) =>
                  setFormData({ ...formData, maxOutputTokens: e.target.value })
                }
                placeholder="4096"
              />
            </div>
            <div className="space-y-2">
              <Label>Custom RPM Limit</Label>
              <Input
                type="number"
                value={formData.customRpmLimit}
                onChange={(e) =>
                  setFormData({ ...formData, customRpmLimit: e.target.value })
                }
                placeholder="Override plan RPM"
              />
            </div>
            <div className="space-y-2">
              <Label>Custom RPD Limit</Label>
              <Input
                type="number"
                value={formData.customRpdLimit}
                onChange={(e) =>
                  setFormData({ ...formData, customRpdLimit: e.target.value })
                }
                placeholder="Override plan RPD"
              />
            </div>
          </div>

          {/* Per-Tier Daily Limits */}
          <div className="space-y-3 border-t pt-4">
            <h4 className="text-sm font-medium">Per-Tier Daily Limits</h4>
            <p className="text-xs text-muted-foreground">
              Set daily token, request, and RPM limits for each plan tier. Leave
              empty for unlimited.
            </p>

            {(["free", "pro", "plus", "enterprise"] as const).map((tier) => {
              const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
              const inputKey = `dailyInputTokens${tierLabel}` as keyof FormData;
              const outputKey =
                `dailyOutputTokens${tierLabel}` as keyof FormData;
              const requestsKey = `dailyRequests${tierLabel}` as keyof FormData;
              const rpmKey = `rpm${tierLabel}` as keyof FormData;
              return (
                <div key={tier} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        tier === "enterprise"
                          ? "destructive"
                          : tier === "free"
                            ? "secondary"
                            : "default"
                      }
                      className="text-xs"
                    >
                      {tierLabel}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Daily Input Tokens</Label>
                      <Input
                        type="number"
                        value={formData[inputKey] as string}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [inputKey]: e.target.value,
                          })
                        }
                        placeholder="e.g. 10000"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Daily Output Tokens</Label>
                      <Input
                        type="number"
                        value={formData[outputKey] as string}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [outputKey]: e.target.value,
                          })
                        }
                        placeholder="e.g. 200000"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Daily Requests</Label>
                      <Input
                        type="number"
                        value={formData[requestsKey] as string}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [requestsKey]: e.target.value,
                          })
                        }
                        placeholder="e.g. 100"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">RPM</Label>
                      <Input
                        type="number"
                        value={formData[rpmKey] as string}
                        onChange={(e) =>
                          setFormData({ ...formData, [rpmKey]: e.target.value })
                        }
                        placeholder="e.g. 10"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-6 pt-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isEnabled}
                onCheckedChange={(v) =>
                  setFormData({ ...formData, isEnabled: v })
                }
              />
              <Label>Enabled</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.isPartnerOnly}
                onCheckedChange={(v) =>
                  setFormData({ ...formData, isPartnerOnly: v })
                }
              />
              <Label>Partner Only</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Saving..." : formData.id ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
