import { NextResponse } from "next/server";
import { getSession } from "auth/server";
import { getTransactionHistory } from "@/lib/billing/usage-repository";
import { formatCredits } from "@/lib/billing/billing-service";

/**
 * GET /api/billing/transactions - Get credit transaction history
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const transactions = await getTransactionHistory(
      session.user.id,
      limit,
      offset,
    );

    return NextResponse.json({
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: parseFloat(t.amount),
        amountFormatted: formatCredits(Math.abs(parseFloat(t.amount))),
        balanceAfter: parseFloat(t.balanceAfter),
        description: t.description,
        paymentProvider: t.paymentProvider,
        amountUsd: t.amountUsd ? parseFloat(t.amountUsd) : null,
        createdAt: t.createdAt,
      })),
      pagination: {
        limit,
        offset,
        hasMore: transactions.length === limit,
      },
    });
  } catch (error: any) {
    console.error("[Transactions API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get transactions" },
      { status: 500 },
    );
  }
}
