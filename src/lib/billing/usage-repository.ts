import "server-only";

import { pgDb as db } from "@/lib/db/pg/db.pg";
import {
  UserCreditsTable,
  UsageLogTable,
  CreditTransactionTable,
} from "@/lib/db/pg/schema-billing.pg";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { calculateCost, CostCalculation } from "./billing-service";

/**
 * USAGE REPOSITORY
 *
 * Database operations for billing and usage tracking
 */

// ============================================================================
// USER CREDITS
// ============================================================================

/**
 * Get or create user credits record
 */
export async function getUserCredits(userId: string) {
  const credits = await db
    .select()
    .from(UserCreditsTable)
    .where(eq(UserCreditsTable.userId, userId))
    .limit(1);

  if (credits.length === 0) {
    // Create new credits record with welcome bonus
    const [newCredits] = await db
      .insert(UserCreditsTable)
      .values({
        userId,
        balance: "1000", // Welcome bonus: 1000 credits ($1)
        totalCreditsGranted: "1000",
      })
      .returning();
    return newCredits;
  }

  return credits[0];
}

/**
 * Add credits to user balance
 */
export async function addCredits(
  userId: string,
  amount: number,
  type: "purchase" | "grant" | "refund" | "subscription",
  metadata?: {
    paymentProvider?: string;
    paymentId?: string;
    amountUsd?: number;
    grantedBy?: string;
    description?: string;
  },
) {
  const credits = await getUserCredits(userId);
  const newBalance = parseFloat(credits.balance) + amount;

  // Update balance
  await db
    .update(UserCreditsTable)
    .set({
      balance: newBalance.toString(),
      totalCreditsPurchased:
        type === "purchase"
          ? (parseFloat(credits.totalCreditsPurchased) + amount).toString()
          : credits.totalCreditsPurchased,
      totalCreditsGranted:
        type === "grant"
          ? (parseFloat(credits.totalCreditsGranted) + amount).toString()
          : credits.totalCreditsGranted,
      updatedAt: new Date(),
    })
    .where(eq(UserCreditsTable.userId, userId));

  // Create transaction record
  await db.insert(CreditTransactionTable).values({
    userId,
    type,
    amount: amount.toString(),
    balanceAfter: newBalance.toString(),
    referenceType:
      type === "purchase"
        ? "payment"
        : type === "grant"
          ? "admin_grant"
          : undefined,
    paymentProvider: metadata?.paymentProvider,
    paymentId: metadata?.paymentId,
    amountUsd: metadata?.amountUsd?.toString(),
    grantedBy: metadata?.grantedBy,
    description: metadata?.description,
  });

  return { newBalance, previousBalance: parseFloat(credits.balance) };
}

/**
 * Deduct credits for usage
 */
export async function deductCredits(
  userId: string,
  amount: number,
  usageLogId?: string,
) {
  const credits = await getUserCredits(userId);
  const currentBalance = parseFloat(credits.balance);

  if (currentBalance < amount) {
    throw new Error("Insufficient credits");
  }

  const newBalance = currentBalance - amount;

  // Update balance and usage counters
  await db
    .update(UserCreditsTable)
    .set({
      balance: newBalance.toString(),
      totalCreditsUsed: (
        parseFloat(credits.totalCreditsUsed) + amount
      ).toString(),
      monthlyCreditsUsed: (
        parseFloat(credits.monthlyCreditsUsed) + amount
      ).toString(),
      dailyRequestCount: credits.dailyRequestCount + 1,
      updatedAt: new Date(),
    })
    .where(eq(UserCreditsTable.userId, userId));

  // Create transaction record
  await db.insert(CreditTransactionTable).values({
    userId,
    type: "usage",
    amount: (-amount).toString(),
    balanceAfter: newBalance.toString(),
    referenceType: usageLogId ? "usage_log" : undefined,
    referenceId: usageLogId,
    description: "AI model usage",
  });

  return { newBalance, creditsDeducted: amount };
}

// ============================================================================
// USAGE LOGGING
// ============================================================================

/**
 * Log usage for a request
 */
export async function logUsage(
  userId: string,
  data: {
    threadId?: string;
    messageId?: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    requestType?:
      | "chat"
      | "completion"
      | "embedding"
      | "image"
      | "audio"
      | "tool";
    latencyMs?: number;
    status?: "success" | "error" | "rate_limited" | "quota_exceeded";
    errorMessage?: string;
  },
): Promise<{ usageLog: any; cost: CostCalculation }> {
  const totalTokens = data.inputTokens + data.outputTokens;
  const cost = calculateCost(data.provider, data.model, {
    inputTokens: data.inputTokens,
    outputTokens: data.outputTokens,
    totalTokens,
  });

  const [usageLog] = await db
    .insert(UsageLogTable)
    .values({
      userId,
      threadId: data.threadId,
      messageId: data.messageId,
      provider: data.provider,
      model: data.model,
      inputTokens: data.inputTokens,
      outputTokens: data.outputTokens,
      totalTokens,
      inputCost: cost.inputCost.toString(),
      outputCost: cost.outputCost.toString(),
      totalCost: cost.totalCost.toString(),
      creditsCharged: cost.creditsCharged.toString(),
      requestType: data.requestType || "chat",
      latencyMs: data.latencyMs,
      status: data.status || "success",
      errorMessage: data.errorMessage,
    })
    .returning();

  return { usageLog, cost };
}

// ============================================================================
// USAGE STATISTICS
// ============================================================================

/**
 * Get user's usage stats for a time period
 */
export async function getUserUsageStats(
  userId: string,
  period: "day" | "week" | "month" | "all_time",
) {
  let startDate: Date;
  const now = new Date();

  switch (period) {
    case "day":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "week":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "all_time":
      startDate = new Date(0);
      break;
  }

  const logs = await db
    .select({
      totalRequests: sql<number>`COUNT(*)`,
      totalInputTokens: sql<number>`SUM(${UsageLogTable.inputTokens})`,
      totalOutputTokens: sql<number>`SUM(${UsageLogTable.outputTokens})`,
      totalTokens: sql<number>`SUM(${UsageLogTable.totalTokens})`,
      totalCost: sql<number>`SUM(${UsageLogTable.totalCost}::numeric)`,
      totalCredits: sql<number>`SUM(${UsageLogTable.creditsCharged}::numeric)`,
    })
    .from(UsageLogTable)
    .where(
      and(
        eq(UsageLogTable.userId, userId),
        gte(UsageLogTable.createdAt, startDate),
      ),
    );

  // Get model breakdown
  const modelBreakdown = await db
    .select({
      provider: UsageLogTable.provider,
      model: UsageLogTable.model,
      requests: sql<number>`COUNT(*)`,
      tokens: sql<number>`SUM(${UsageLogTable.totalTokens})`,
      cost: sql<number>`SUM(${UsageLogTable.totalCost}::numeric)`,
    })
    .from(UsageLogTable)
    .where(
      and(
        eq(UsageLogTable.userId, userId),
        gte(UsageLogTable.createdAt, startDate),
      ),
    )
    .groupBy(UsageLogTable.provider, UsageLogTable.model)
    .orderBy(desc(sql`SUM(${UsageLogTable.totalTokens})`));

  return {
    period,
    ...logs[0],
    modelBreakdown,
  };
}

/**
 * Get today's rate limit counts
 */
export async function getRateLimitCounts(userId: string) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMinute = new Date(now.getTime() - 60000);

  // Requests today
  const [dailyStats] = await db
    .select({
      requestCount: sql<number>`COUNT(*)`,
      tokenCount: sql<number>`COALESCE(SUM(${UsageLogTable.totalTokens}), 0)`,
    })
    .from(UsageLogTable)
    .where(
      and(
        eq(UsageLogTable.userId, userId),
        gte(UsageLogTable.createdAt, startOfDay),
      ),
    );

  // Requests this minute
  const [minuteStats] = await db
    .select({
      requestCount: sql<number>`COUNT(*)`,
      tokenCount: sql<number>`COALESCE(SUM(${UsageLogTable.totalTokens}), 0)`,
    })
    .from(UsageLogTable)
    .where(
      and(
        eq(UsageLogTable.userId, userId),
        gte(UsageLogTable.createdAt, startOfMinute),
      ),
    );

  return {
    requestsToday: dailyStats?.requestCount || 0,
    tokensToday: dailyStats?.tokenCount || 0,
    requestsThisMinute: minuteStats?.requestCount || 0,
    tokensThisMinute: minuteStats?.tokenCount || 0,
    concurrentRequests: 0, // Would need Redis or similar for accurate tracking
  };
}

/**
 * Get per-model daily usage (input/output tokens and requests)
 */
export async function getModelDailyUsage(
  userId: string,
  provider: string,
  model: string,
) {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMinute = new Date(now.getTime() - 60000);

  const [dailyStats] = await db
    .select({
      requestCount: sql<number>`COUNT(*)`,
      inputTokens: sql<number>`COALESCE(SUM(${UsageLogTable.inputTokens}), 0)`,
      outputTokens: sql<number>`COALESCE(SUM(${UsageLogTable.outputTokens}), 0)`,
    })
    .from(UsageLogTable)
    .where(
      and(
        eq(UsageLogTable.userId, userId),
        eq(UsageLogTable.provider, provider),
        eq(UsageLogTable.model, model),
        gte(UsageLogTable.createdAt, startOfDay),
      ),
    );

  const [minuteStats] = await db
    .select({
      requestCount: sql<number>`COUNT(*)`,
    })
    .from(UsageLogTable)
    .where(
      and(
        eq(UsageLogTable.userId, userId),
        eq(UsageLogTable.provider, provider),
        eq(UsageLogTable.model, model),
        gte(UsageLogTable.createdAt, startOfMinute),
      ),
    );

  return {
    dailyRequests: dailyStats?.requestCount || 0,
    dailyInputTokens: dailyStats?.inputTokens || 0,
    dailyOutputTokens: dailyStats?.outputTokens || 0,
    minuteRequests: minuteStats?.requestCount || 0,
  };
}

/**
 * Get transaction history
 */
export async function getTransactionHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0,
) {
  return db
    .select()
    .from(CreditTransactionTable)
    .where(eq(CreditTransactionTable.userId, userId))
    .orderBy(desc(CreditTransactionTable.createdAt))
    .limit(limit)
    .offset(offset);
}

// ============================================================================
// MONTHLY RESET
// ============================================================================

/**
 * Reset monthly usage counters (run via cron job)
 */
export async function resetMonthlyUsage() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  await db
    .update(UserCreditsTable)
    .set({
      monthlyCreditsUsed: "0",
      monthlyResetAt: startOfMonth,
      updatedAt: new Date(),
    })
    .where(lte(UserCreditsTable.monthlyResetAt, startOfMonth));

  console.log("[Billing] Monthly usage reset completed");
}

/**
 * Reset daily usage counters (run via cron job)
 */
export async function resetDailyUsage() {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  await db
    .update(UserCreditsTable)
    .set({
      dailyRequestCount: 0,
      dailyResetAt: startOfDay,
      updatedAt: new Date(),
    })
    .where(lte(UserCreditsTable.dailyResetAt, startOfDay));

  console.log("[Billing] Daily usage reset completed");
}
