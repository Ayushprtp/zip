import { NextResponse } from "next/server";
import { getSession } from "auth/server";
import { getUserUsageStats } from "@/lib/billing/usage-repository";
import { formatTokens, formatCredits } from "@/lib/billing/billing-service";

/**
 * GET /api/billing/usage - Get detailed usage statistics
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "month") as
      | "day"
      | "week"
      | "month"
      | "all_time";

    const stats = await getUserUsageStats(session.user.id, period);

    return NextResponse.json({
      period,
      summary: {
        totalRequests: stats.totalRequests || 0,
        totalInputTokens: stats.totalInputTokens || 0,
        totalOutputTokens: stats.totalOutputTokens || 0,
        totalTokens: stats.totalTokens || 0,
        totalTokensFormatted: formatTokens(stats.totalTokens || 0),
        totalCostUsd: stats.totalCost || 0,
        totalCreditsUsed: stats.totalCredits || 0,
        totalCreditsFormatted: formatCredits(stats.totalCredits || 0),
      },
      modelBreakdown: stats.modelBreakdown.map((m: any) => ({
        provider: m.provider,
        model: m.model,
        requests: m.requests,
        tokens: m.tokens,
        tokensFormatted: formatTokens(m.tokens),
        costUsd: m.cost,
      })),
    });
  } catch (error: any) {
    console.error("[Usage API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get usage data" },
      { status: 500 },
    );
  }
}
