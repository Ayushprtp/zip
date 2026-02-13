import { z } from "zod";
import { USER_ROLES, UserRoleNames } from "app-types/roles";

import { ActionState } from "lib/action-utils";
import { BasicUserWithLastLogin } from "app-types/user";

export const UpdateUserRoleSchema = z.object({
  userId: z.uuid("Invalid user ID"),
  role: z
    .enum(Object.values(USER_ROLES) as [UserRoleNames, ...UserRoleNames[]])
    .optional(),
});

export const UpdateUserBanStatusSchema = z.object({
  userId: z.uuid("Invalid user ID"),
  banned: z.enum(["true", "false"]).transform((value) => value === "true"),
  banReason: z.string().optional(),
});

// ============================================================================
// PRICING & BILLING ADMIN SCHEMAS
// ============================================================================

export const UpsertModelPricingSchema = z.object({
  id: z.string().optional(), // If present, update; otherwise create
  provider: z.string().min(1, "Provider is required"),
  model: z.string().min(1, "Model is required"),
  inputPricePerMillion: z.string().min(1, "Input price is required"),
  outputPricePerMillion: z.string().min(1, "Output price is required"),
  creditMultiplier: z.string().optional().default("1000"),
  isPartnerOnly: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((v) => v === "true"),
  minimumPlan: z
    .enum(["free", "pro", "plus", "enterprise"])
    .optional()
    .default("free"),
  displayName: z.string().optional(),
  description: z.string().optional(),
  contextWindow: z.string().optional(),
  maxOutputTokens: z.string().optional(),
  customRpmLimit: z.string().optional(),
  customRpdLimit: z.string().optional(),
  isEnabled: z
    .enum(["true", "false"])
    .optional()
    .default("true")
    .transform((v) => v === "true"),
  // Per-tier daily input token limits
  dailyInputTokensFree: z.string().optional(),
  dailyInputTokensPro: z.string().optional(),
  dailyInputTokensPlus: z.string().optional(),
  dailyInputTokensEnterprise: z.string().optional(),
  // Per-tier daily output token limits
  dailyOutputTokensFree: z.string().optional(),
  dailyOutputTokensPro: z.string().optional(),
  dailyOutputTokensPlus: z.string().optional(),
  dailyOutputTokensEnterprise: z.string().optional(),
  // Per-tier daily request limits
  dailyRequestsFree: z.string().optional(),
  dailyRequestsPro: z.string().optional(),
  dailyRequestsPlus: z.string().optional(),
  dailyRequestsEnterprise: z.string().optional(),
  // Per-tier RPM limits
  rpmFree: z.string().optional(),
  rpmPro: z.string().optional(),
  rpmPlus: z.string().optional(),
  rpmEnterprise: z.string().optional(),
});

export const DeleteModelPricingSchema = z.object({
  id: z.string().min(1, "Pricing ID is required"),
});

export const GrantCreditsSchema = z.object({
  userId: z.uuid("Invalid user ID"),
  amount: z.string().min(1, "Amount is required"),
  description: z.string().optional(),
});

export const AdjustCreditsSchema = z.object({
  userId: z.uuid("Invalid user ID"),
  amount: z.string().min(1, "Amount is required"),
  description: z.string().optional(),
});

export const SetCreditsSchema = z.object({
  userId: z.uuid("Invalid user ID"),
  balance: z.string().min(1, "Balance is required"),
  totalCreditsUsed: z.string().optional(),
  totalCreditsGranted: z.string().optional(),
  monthlyCreditsUsed: z.string().optional(),
  description: z.string().optional(),
});

export const SetRequestsSchema = z.object({
  userId: z.uuid("Invalid user ID"),
  dailyRequestCount: z.string().min(1, "Daily request count is required"),
  description: z.string().optional(),
});

export const UpdateSubscriptionSchema = z.object({
  userId: z.uuid("Invalid user ID"),
  plan: z.enum(["free", "pro", "plus", "enterprise"]),
  monthlyCredits: z.string().optional(),
  status: z
    .enum(["active", "canceled", "past_due", "paused", "trialing"])
    .optional()
    .default("active"),
});

// ============================================================================
// PRICING PLANS SCHEMAS
// ============================================================================

export const UpsertPricingPlanSchema = z.object({
  id: z.string().optional(),
  tier: z.enum(["free", "pro", "plus", "enterprise"]),
  pricingType: z.enum(["token_based", "request_based", "unlimited"]),
  displayName: z.string().min(1, "Display name is required"),
  description: z.string().optional(),
  monthlyPrice: z.string().min(1, "Monthly price is required"),
  yearlyPrice: z.string().min(1, "Yearly price is required"),
  tokenLimit: z.string().optional(),
  requestLimit: z.string().optional(),
  requestPeriod: z.enum(["daily", "monthly"]).optional().default("monthly"),
  monthlyCredits: z.string().optional().default("0"),
  features: z.string().optional().default("[]"),
  highlighted: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((v) => v === "true"),
  badge: z.string().optional(),
  sortOrder: z.string().optional().default("0"),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .default("true")
    .transform((v) => v === "true"),
});

export const DeletePricingPlanSchema = z.object({
  id: z.string().min(1, "Plan ID is required"),
});

// ============================================================================
// ACTION STATE TYPES
// ============================================================================

export type UpdateUserRoleActionState = ActionState & {
  user?: BasicUserWithLastLogin | null;
};

export type UpdateUserBanStatusActionState = ActionState & {
  user?: BasicUserWithLastLogin | null;
};

export type UpsertModelPricingActionState = ActionState & {
  pricing?: any;
};

export type DeleteModelPricingActionState = ActionState;

export type GrantCreditsActionState = ActionState;

export type AdjustCreditsActionState = ActionState;

export type SetCreditsActionState = ActionState;

export type SetRequestsActionState = ActionState;

export type UpdateSubscriptionActionState = ActionState;

export type UpsertPricingPlanActionState = ActionState & {
  plan?: any;
};

export type DeletePricingPlanActionState = ActionState;
