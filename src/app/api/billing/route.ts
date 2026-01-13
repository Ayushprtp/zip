import { NextResponse } from "next/server";
import { getSession } from "auth/server";
import {
  getUserCredits,
  getUserUsageStats,
  getRateLimitCounts,
} from "@/lib/billing/usage-repository";
import {
  checkRateLimit,
  checkMonthlyQuota,
  formatCredits,
  formatTokens,
  creditsToUsd,
  PLAN_CREDITS,
  PLAN_RATE_LIMITS,
} from "@/lib/billing/billing-service";
import { UserPlan } from "@/types/roles";

/**
 * GET /api/billing - Get user's billing and usage overview
 */
export async function GET(_request: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const userPlan = ((session.user as any).plan || "free") as UserPlan;

    // Get all billing data in parallel
    const [credits, usageToday, _usageMonth, rateLimitCounts] =
      await Promise.all([
        getUserCredits(userId),
        getUserUsageStats(userId, "day"),
        getUserUsageStats(userId, "month"),
        getRateLimitCounts(userId),
      ]);

    // Calculate quotas
    const monthlyQuota = checkMonthlyQuota(
      userPlan,
      parseFloat(credits.monthlyCreditsUsed),
    );

    const rateLimit = checkRateLimit(userPlan, rateLimitCounts);

    return NextResponse.json({
      // Credits
      balance: parseFloat(credits.balance),
      balanceFormatted: formatCredits(parseFloat(credits.balance)),
      balanceUsd: creditsToUsd(parseFloat(credits.balance)),

      // Plan info
      plan: userPlan,
      planLimits: PLAN_RATE_LIMITS[userPlan],
      monthlyCreditsAllowed: PLAN_CREDITS[userPlan],

      // Monthly usage
      monthlyUsage: {
        creditsUsed: parseFloat(credits.monthlyCreditsUsed),
        creditsUsedFormatted: formatCredits(
          parseFloat(credits.monthlyCreditsUsed),
        ),
        percentageUsed: monthlyQuota.percentageUsed,
        creditsRemaining: monthlyQuota.creditsRemaining,
        withinQuota: monthlyQuota.withinQuota,
      },

      // Today's usage
      todayUsage: {
        requests: usageToday.totalRequests || 0,
        tokens: usageToday.totalTokens || 0,
        tokensFormatted: formatTokens(usageToday.totalTokens || 0),
        cost: usageToday.totalCost || 0,
        credits: usageToday.totalCredits || 0,
      },

      // Rate limits
      rateLimits: {
        allowed: rateLimit.allowed,
        requestsThisMinute: rateLimitCounts.requestsThisMinute,
        requestsToday: rateLimitCounts.requestsToday,
        tokensThisMinute: rateLimitCounts.tokensThisMinute,
        tokensToday: rateLimitCounts.tokensToday,
        limits: PLAN_RATE_LIMITS[userPlan],
      },

      // Lifetime stats
      lifetime: {
        totalCreditsUsed: parseFloat(credits.totalCreditsUsed),
        totalCreditsPurchased: parseFloat(credits.totalCreditsPurchased),
        totalCreditsGranted: parseFloat(credits.totalCreditsGranted),
      },
    });
  } catch (error: any) {
    console.error("[Billing API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get billing data" },
      { status: 500 },
    );
  }
}
