import { NextResponse } from "next/server";
import { requireAdmin } from "lib/auth/rbac-guards";
import { getUserCreditsById } from "lib/admin/billing-repository";

/**
 * GET /api/admin/users/[id]/credits - Get user credits (admin only, for real-time polling)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const result = await getUserCreditsById(id);
    if (!result) {
      return NextResponse.json(
        {
          credits: null,
          subscription: null,
        },
        { status: 200 },
      );
    }

    return NextResponse.json({
      credits: {
        balance: result.credits.balance,
        totalCreditsUsed: result.credits.totalCreditsUsed,
        totalCreditsGranted: result.credits.totalCreditsGranted,
        totalCreditsPurchased: result.credits.totalCreditsPurchased,
        monthlyCreditsUsed: result.credits.monthlyCreditsUsed,
        dailyRequestCount: result.credits.dailyRequestCount,
        dailyResetAt: result.credits.dailyResetAt,
      },
      subscription: result.subscription,
    });
  } catch (error: any) {
    if (error?.message?.includes("permission")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500 },
    );
  }
}
