"use server";

import { validatedActionWithAdminPermission } from "lib/action-utils";
import {
  UpsertModelPricingSchema,
  DeleteModelPricingSchema,
  GrantCreditsSchema,
  AdjustCreditsSchema,
  SetCreditsSchema,
  SetRequestsSchema,
  UpdateSubscriptionSchema,
  UpsertPricingPlanSchema,
  DeletePricingPlanSchema,
  type UpsertModelPricingActionState,
  type DeleteModelPricingActionState,
  type GrantCreditsActionState,
  type AdjustCreditsActionState,
  type SetCreditsActionState,
  type SetRequestsActionState,
  type UpdateSubscriptionActionState,
  type UpsertPricingPlanActionState,
  type DeletePricingPlanActionState,
} from "../validations";
import {
  upsertModelPricing,
  deleteModelPricing,
  adminGrantCredits,
  adminSetCredits,
  adminSetRequests,
  upsertSubscription,
  upsertPricingPlan,
  deletePricingPlan,
} from "lib/admin/billing-repository";
import logger from "lib/logger";

// ============================================================================
// MODEL PRICING ACTIONS
// ============================================================================

export const upsertModelPricingAction = validatedActionWithAdminPermission(
  UpsertModelPricingSchema,
  async (
    data,
    _formData,
    _userSession,
  ): Promise<UpsertModelPricingActionState> => {
    try {
      const pricing = await upsertModelPricing({
        id: data.id,
        provider: data.provider,
        model: data.model,
        inputPricePerMillion: data.inputPricePerMillion,
        outputPricePerMillion: data.outputPricePerMillion,
        creditMultiplier: data.creditMultiplier,
        isPartnerOnly: data.isPartnerOnly,
        minimumPlan: data.minimumPlan,
        displayName: data.displayName,
        description: data.description,
        contextWindow: data.contextWindow
          ? parseInt(data.contextWindow, 10)
          : undefined,
        maxOutputTokens: data.maxOutputTokens
          ? parseInt(data.maxOutputTokens, 10)
          : undefined,
        customRpmLimit: data.customRpmLimit
          ? parseInt(data.customRpmLimit, 10)
          : undefined,
        customRpdLimit: data.customRpdLimit
          ? parseInt(data.customRpdLimit, 10)
          : undefined,
        isEnabled: data.isEnabled,
        // Per-tier daily limits
        dailyInputTokensFree: data.dailyInputTokensFree || undefined,
        dailyInputTokensPro: data.dailyInputTokensPro || undefined,
        dailyInputTokensPlus: data.dailyInputTokensPlus || undefined,
        dailyInputTokensEnterprise:
          data.dailyInputTokensEnterprise || undefined,
        dailyOutputTokensFree: data.dailyOutputTokensFree || undefined,
        dailyOutputTokensPro: data.dailyOutputTokensPro || undefined,
        dailyOutputTokensPlus: data.dailyOutputTokensPlus || undefined,
        dailyOutputTokensEnterprise:
          data.dailyOutputTokensEnterprise || undefined,
        dailyRequestsFree: data.dailyRequestsFree
          ? parseInt(data.dailyRequestsFree, 10)
          : undefined,
        dailyRequestsPro: data.dailyRequestsPro
          ? parseInt(data.dailyRequestsPro, 10)
          : undefined,
        dailyRequestsPlus: data.dailyRequestsPlus
          ? parseInt(data.dailyRequestsPlus, 10)
          : undefined,
        dailyRequestsEnterprise: data.dailyRequestsEnterprise
          ? parseInt(data.dailyRequestsEnterprise, 10)
          : undefined,
        rpmFree: data.rpmFree ? parseInt(data.rpmFree, 10) : undefined,
        rpmPro: data.rpmPro ? parseInt(data.rpmPro, 10) : undefined,
        rpmPlus: data.rpmPlus ? parseInt(data.rpmPlus, 10) : undefined,
        rpmEnterprise: data.rpmEnterprise
          ? parseInt(data.rpmEnterprise, 10)
          : undefined,
      });

      return {
        success: true,
        message: data.id
          ? "Model pricing updated successfully"
          : "Model pricing created successfully",
        pricing,
      };
    } catch (error) {
      logger.error("Failed to upsert model pricing:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to save pricing",
      };
    }
  },
);

export const deleteModelPricingAction = validatedActionWithAdminPermission(
  DeleteModelPricingSchema,
  async (data): Promise<DeleteModelPricingActionState> => {
    try {
      await deleteModelPricing(data.id);
      return {
        success: true,
        message: "Model pricing deleted successfully",
      };
    } catch (error) {
      logger.error("Failed to delete model pricing:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to delete pricing",
      };
    }
  },
);

// ============================================================================
// CREDITS ACTIONS
// ============================================================================

export const grantCreditsAction = validatedActionWithAdminPermission(
  GrantCreditsSchema,
  async (data, _formData, userSession): Promise<GrantCreditsActionState> => {
    try {
      const amount = parseFloat(data.amount);
      if (isNaN(amount) || amount <= 0) {
        return { success: false, message: "Amount must be a positive number" };
      }

      await adminGrantCredits({
        userId: data.userId,
        amount,
        grantedBy: userSession.user.id,
        description: data.description || `Admin grant of ${amount} credits`,
      });

      return {
        success: true,
        message: `Successfully granted ${amount} credits`,
      };
    } catch (error) {
      logger.error("Failed to grant credits:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to grant credits",
      };
    }
  },
);

export const adjustCreditsAction = validatedActionWithAdminPermission(
  AdjustCreditsSchema,
  async (data, _formData, userSession): Promise<AdjustCreditsActionState> => {
    try {
      const amount = parseFloat(data.amount);
      if (isNaN(amount)) {
        return { success: false, message: "Amount must be a valid number" };
      }

      await adminGrantCredits({
        userId: data.userId,
        amount,
        grantedBy: userSession.user.id,
        description:
          data.description || `Admin adjustment of ${amount} credits`,
      });

      return {
        success: true,
        message: `Successfully adjusted credits by ${amount}`,
      };
    } catch (error) {
      logger.error("Failed to adjust credits:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to adjust credits",
      };
    }
  },
);

export const setCreditsAction = validatedActionWithAdminPermission(
  SetCreditsSchema,
  async (data, _formData, userSession): Promise<SetCreditsActionState> => {
    try {
      const balance = parseFloat(data.balance);
      if (isNaN(balance) || balance < 0) {
        return {
          success: false,
          message: "Balance must be a non-negative number",
        };
      }

      const totalCreditsUsed = data.totalCreditsUsed
        ? parseFloat(data.totalCreditsUsed)
        : undefined;
      const totalCreditsGranted = data.totalCreditsGranted
        ? parseFloat(data.totalCreditsGranted)
        : undefined;
      const monthlyCreditsUsed = data.monthlyCreditsUsed
        ? parseFloat(data.monthlyCreditsUsed)
        : undefined;

      await adminSetCredits({
        userId: data.userId,
        balance,
        totalCreditsUsed:
          totalCreditsUsed !== undefined && !isNaN(totalCreditsUsed)
            ? totalCreditsUsed
            : undefined,
        totalCreditsGranted:
          totalCreditsGranted !== undefined && !isNaN(totalCreditsGranted)
            ? totalCreditsGranted
            : undefined,
        monthlyCreditsUsed:
          monthlyCreditsUsed !== undefined && !isNaN(monthlyCreditsUsed)
            ? monthlyCreditsUsed
            : undefined,
        grantedBy: userSession.user.id,
        description: data.description || `Admin set balance to ${balance}`,
      });

      return {
        success: true,
        message: `Successfully set credits balance to ${balance}`,
      };
    } catch (error) {
      logger.error("Failed to set credits:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to set credits",
      };
    }
  },
);

export const setRequestsAction = validatedActionWithAdminPermission(
  SetRequestsSchema,
  async (data, _formData, userSession): Promise<SetRequestsActionState> => {
    try {
      const dailyRequestCount = parseInt(data.dailyRequestCount, 10);
      if (isNaN(dailyRequestCount) || dailyRequestCount < 0) {
        return {
          success: false,
          message: "Daily request count must be a non-negative integer",
        };
      }

      await adminSetRequests({
        userId: data.userId,
        dailyRequestCount,
        grantedBy: userSession.user.id,
        description:
          data.description ||
          `Admin set daily request count to ${dailyRequestCount}`,
      });

      return {
        success: true,
        message: `Successfully set daily request count to ${dailyRequestCount}`,
      };
    } catch (error) {
      logger.error("Failed to set requests:", error);
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to set requests",
      };
    }
  },
);

// ============================================================================
// SUBSCRIPTION ACTIONS
// ============================================================================

export const updateSubscriptionAction = validatedActionWithAdminPermission(
  UpdateSubscriptionSchema,
  async (data): Promise<UpdateSubscriptionActionState> => {
    try {
      await upsertSubscription({
        userId: data.userId,
        plan: data.plan,
        monthlyCredits: data.monthlyCredits,
        status: data.status,
      });

      return {
        success: true,
        message: `Subscription updated to ${data.plan} plan`,
      };
    } catch (error) {
      logger.error("Failed to update subscription:", error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to update subscription",
      };
    }
  },
);

// ============================================================================
// PRICING PLAN ACTIONS
// ============================================================================

export const upsertPricingPlanAction = validatedActionWithAdminPermission(
  UpsertPricingPlanSchema,
  async (data): Promise<UpsertPricingPlanActionState> => {
    try {
      const plan = await upsertPricingPlan({
        id: data.id,
        tier: data.tier,
        pricingType: data.pricingType,
        displayName: data.displayName,
        description: data.description,
        monthlyPrice: data.monthlyPrice,
        yearlyPrice: data.yearlyPrice,
        tokenLimit: data.tokenLimit ? parseInt(data.tokenLimit, 10) : null,
        requestLimit: data.requestLimit
          ? parseInt(data.requestLimit, 10)
          : null,
        requestPeriod: data.requestPeriod,
        monthlyCredits: data.monthlyCredits,
        features: data.features,
        highlighted: data.highlighted,
        badge: data.badge,
        sortOrder: data.sortOrder ? parseInt(data.sortOrder, 10) : 0,
        isActive: data.isActive,
      });

      return {
        success: true,
        message: data.id
          ? "Pricing plan updated successfully"
          : "Pricing plan created successfully",
        plan,
      };
    } catch (error) {
      logger.error("Failed to upsert pricing plan:", error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to save pricing plan",
      };
    }
  },
);

export const deletePricingPlanAction = validatedActionWithAdminPermission(
  DeletePricingPlanSchema,
  async (data): Promise<DeletePricingPlanActionState> => {
    try {
      await deletePricingPlan(data.id);
      return {
        success: true,
        message: "Pricing plan deleted successfully",
      };
    } catch (error) {
      logger.error("Failed to delete pricing plan:", error);
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Failed to delete pricing plan",
      };
    }
  },
);
