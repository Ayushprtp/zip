import "server-only";

import { USER_PLANS, UserPlan, userPlanInfo } from "@/types/roles";

/**
 * FLARE.SH BILLING SERVICE
 *
 * Handles:
 * - Credit calculations
 * - Usage tracking
 * - Rate limiting
 * - Quota enforcement
 */

// ============================================================================
// PRICING CONFIGURATION
// ============================================================================

/**
 * Default model pricing (per 1M tokens in USD)
 */
export const DEFAULT_MODEL_PRICING: Record<
  string,
  { input: number; output: number }
> = {
  // OpenAI
  "openai/gpt-4o": { input: 2.5, output: 10.0 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "openai/gpt-4-turbo": { input: 10.0, output: 30.0 },
  "openai/gpt-3.5-turbo": { input: 0.5, output: 1.5 },
  "openai/o1": { input: 15.0, output: 60.0 },
  "openai/o1-mini": { input: 3.0, output: 12.0 },

  // Google
  "google/gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "google/gemini-2.0-flash-lite": { input: 0.075, output: 0.3 },
  "google/gemini-1.5-pro": { input: 1.25, output: 5.0 },
  "google/gemini-1.5-flash": { input: 0.075, output: 0.3 },

  // Anthropic
  "anthropic/claude-3.5-sonnet": { input: 3.0, output: 15.0 },
  "anthropic/claude-3-opus": { input: 15.0, output: 75.0 },
  "anthropic/claude-3-haiku": { input: 0.25, output: 1.25 },

  // GLM (custom pricing)
  "glm/glm-4.7": { input: 0.5, output: 2.0 },
  "glm/glm-4.6": { input: 0.3, output: 1.2 },
  "glm/glm-4.5": { input: 0.2, output: 0.8 },

  // xAI
  "xai/grok-2": { input: 2.0, output: 10.0 },

  // Groq (fast inference)
  "groq/llama-4-scout": { input: 0.2, output: 0.8 },
  "groq/qwen3-32b": { input: 0.1, output: 0.4 },

  // Default fallback
  default: { input: 1.0, output: 4.0 },
};

/**
 * Credit conversion rate
 * 1000 credits = $1 USD
 */
export const CREDITS_PER_USD = 1000;

/**
 * Plan-based monthly credit allowances
 */
export const PLAN_CREDITS: Record<UserPlan, number> = {
  free: 1000, // $1 worth
  premium: 20000, // $20 worth
  enterprise: 100000, // $100 worth (or unlimited with flag)
};

/**
 * Plan-based rate limits
 */
export const PLAN_RATE_LIMITS: Record<
  UserPlan,
  {
    requestsPerMinute: number;
    requestsPerDay: number;
    tokensPerMinute: number;
    tokensPerDay: number;
    concurrentRequests: number;
  }
> = {
  free: {
    requestsPerMinute: 5,
    requestsPerDay: 100,
    tokensPerMinute: 10000,
    tokensPerDay: 100000,
    concurrentRequests: 1,
  },
  premium: {
    requestsPerMinute: 30,
    requestsPerDay: 1000,
    tokensPerMinute: 100000,
    tokensPerDay: 2000000,
    concurrentRequests: 5,
  },
  enterprise: {
    requestsPerMinute: 100,
    requestsPerDay: -1, // unlimited
    tokensPerMinute: 500000,
    tokensPerDay: -1, // unlimited
    concurrentRequests: 20,
  },
};

// ============================================================================
// COST CALCULATION
// ============================================================================

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CostCalculation {
  inputCost: number; // USD
  outputCost: number; // USD
  totalCost: number; // USD
  creditsCharged: number;
}

/**
 * Calculate cost for a request based on token usage
 */
export function calculateCost(
  provider: string,
  model: string,
  usage: TokenUsage,
): CostCalculation {
  const modelKey = `${provider}/${model}`;
  const pricing =
    DEFAULT_MODEL_PRICING[modelKey] || DEFAULT_MODEL_PRICING["default"];

  // Calculate USD cost (pricing is per 1M tokens)
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;

  // Convert to credits
  const creditsCharged = totalCost * CREDITS_PER_USD;

  return {
    inputCost,
    outputCost,
    totalCost,
    creditsCharged: Math.ceil(creditsCharged * 10000) / 10000, // Round up to 4 decimals
  };
}

/**
 * Estimate cost before making a request (based on estimated tokens)
 */
export function estimateCost(
  provider: string,
  model: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
): CostCalculation {
  return calculateCost(provider, model, {
    inputTokens: estimatedInputTokens,
    outputTokens: estimatedOutputTokens,
    totalTokens: estimatedInputTokens + estimatedOutputTokens,
  });
}

// ============================================================================
// BALANCE CHECKS
// ============================================================================

export interface BalanceCheck {
  hasBalance: boolean;
  currentBalance: number;
  requiredCredits: number;
  shortfall: number;
}

/**
 * Check if user has sufficient balance for estimated usage
 */
export function checkBalance(
  currentBalance: number,
  estimatedCredits: number,
): BalanceCheck {
  const hasBalance = currentBalance >= estimatedCredits;
  return {
    hasBalance,
    currentBalance,
    requiredCredits: estimatedCredits,
    shortfall: hasBalance ? 0 : estimatedCredits - currentBalance,
  };
}

// ============================================================================
// RATE LIMIT CHECKS
// ============================================================================

export interface RateLimitCheck {
  allowed: boolean;
  limitType?: "rpm" | "rpd" | "tpm" | "tpd" | "concurrent";
  currentCount: number;
  limit: number;
  resetAt?: Date;
}

/**
 * Check if user is within rate limits
 */
export function checkRateLimit(
  plan: UserPlan,
  currentCounts: {
    requestsThisMinute: number;
    requestsToday: number;
    tokensThisMinute: number;
    tokensToday: number;
    concurrentRequests: number;
  },
): RateLimitCheck {
  const limits = PLAN_RATE_LIMITS[plan];

  // Check RPM
  if (currentCounts.requestsThisMinute >= limits.requestsPerMinute) {
    return {
      allowed: false,
      limitType: "rpm",
      currentCount: currentCounts.requestsThisMinute,
      limit: limits.requestsPerMinute,
      resetAt: new Date(Date.now() + 60000), // 1 minute
    };
  }

  // Check RPD (if not unlimited)
  if (
    limits.requestsPerDay > 0 &&
    currentCounts.requestsToday >= limits.requestsPerDay
  ) {
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    return {
      allowed: false,
      limitType: "rpd",
      currentCount: currentCounts.requestsToday,
      limit: limits.requestsPerDay,
      resetAt: midnight,
    };
  }

  // Check TPM
  if (currentCounts.tokensThisMinute >= limits.tokensPerMinute) {
    return {
      allowed: false,
      limitType: "tpm",
      currentCount: currentCounts.tokensThisMinute,
      limit: limits.tokensPerMinute,
      resetAt: new Date(Date.now() + 60000),
    };
  }

  // Check TPD (if not unlimited)
  if (
    limits.tokensPerDay > 0 &&
    currentCounts.tokensToday >= limits.tokensPerDay
  ) {
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    return {
      allowed: false,
      limitType: "tpd",
      currentCount: currentCounts.tokensToday,
      limit: limits.tokensPerDay,
      resetAt: midnight,
    };
  }

  // Check concurrent requests
  if (currentCounts.concurrentRequests >= limits.concurrentRequests) {
    return {
      allowed: false,
      limitType: "concurrent",
      currentCount: currentCounts.concurrentRequests,
      limit: limits.concurrentRequests,
    };
  }

  return {
    allowed: true,
    currentCount: currentCounts.requestsThisMinute,
    limit: limits.requestsPerMinute,
  };
}

// ============================================================================
// QUOTA CHECKS
// ============================================================================

export interface QuotaCheck {
  withinQuota: boolean;
  creditsUsedThisMonth: number;
  monthlyLimit: number;
  percentageUsed: number;
  creditsRemaining: number;
}

/**
 * Check if user is within monthly quota
 */
export function checkMonthlyQuota(
  plan: UserPlan,
  creditsUsedThisMonth: number,
): QuotaCheck {
  const monthlyLimit = PLAN_CREDITS[plan];
  const creditsRemaining = Math.max(0, monthlyLimit - creditsUsedThisMonth);
  const percentageUsed = (creditsUsedThisMonth / monthlyLimit) * 100;

  return {
    withinQuota: creditsUsedThisMonth < monthlyLimit,
    creditsUsedThisMonth,
    monthlyLimit,
    percentageUsed: Math.min(100, percentageUsed),
    creditsRemaining,
  };
}

// ============================================================================
// USAGE SUMMARY HELPERS
// ============================================================================

export interface UsageSummary {
  period: "day" | "week" | "month" | "all_time";
  totalRequests: number;
  totalMessages: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  totalCreditsUsed: number;
  modelBreakdown: Array<{
    provider: string;
    model: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
}

/**
 * Format credits for display
 */
export function formatCredits(credits: number): string {
  if (credits >= 1000000) {
    return `${(credits / 1000000).toFixed(1)}M`;
  }
  if (credits >= 1000) {
    return `${(credits / 1000).toFixed(1)}K`;
  }
  return credits.toFixed(0);
}

/**
 * Format tokens for display
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000000000) {
    return `${(tokens / 1000000000).toFixed(1)}B`;
  }
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

/**
 * Convert credits to USD
 */
export function creditsToUsd(credits: number): number {
  return credits / CREDITS_PER_USD;
}

/**
 * Convert USD to credits
 */
export function usdToCredits(usd: number): number {
  return usd * CREDITS_PER_USD;
}
