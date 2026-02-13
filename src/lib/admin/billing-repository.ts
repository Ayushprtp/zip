import "server-only";

import { pgDb as db } from "lib/db/pg/db.pg";
import {
  ModelPricingTable,
  UserCreditsTable,
  SubscriptionTable,
  CreditTransactionTable,
  UsageLogTable,
  PricingPlanTable,
  type ModelPricingEntity,
  type UserCreditsEntity,
  type SubscriptionEntity,
  type PricingPlanEntity,
} from "lib/db/pg/schema-billing.pg";
import { UserTable } from "lib/db/pg/schema.pg";
import { eq, desc, sql, like, or, and, count } from "drizzle-orm";

// ============================================================================
// MODEL PRICING
// ============================================================================

export async function getAllModelPricing(): Promise<ModelPricingEntity[]> {
  return db
    .select()
    .from(ModelPricingTable)
    .orderBy(ModelPricingTable.provider, ModelPricingTable.model);
}

export async function getModelPricingById(
  id: string,
): Promise<ModelPricingEntity | null> {
  const results = await db
    .select()
    .from(ModelPricingTable)
    .where(eq(ModelPricingTable.id, id))
    .limit(1);
  return results[0] || null;
}

export async function getModelPricingByModel(
  provider: string,
  model: string,
): Promise<ModelPricingEntity | null> {
  const results = await db
    .select()
    .from(ModelPricingTable)
    .where(
      and(
        eq(ModelPricingTable.provider, provider),
        eq(ModelPricingTable.model, model),
      ),
    )
    .limit(1);
  return results[0] || null;
}

export async function upsertModelPricing(data: {
  id?: string;
  provider: string;
  model: string;
  inputPricePerMillion: string;
  outputPricePerMillion: string;
  creditMultiplier?: string;
  isPartnerOnly?: boolean;
  minimumPlan?: "free" | "pro" | "plus" | "enterprise";
  displayName?: string;
  description?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  customRpmLimit?: number;
  customRpdLimit?: number;
  isEnabled?: boolean;
  // Per-tier daily limits
  dailyInputTokensFree?: string;
  dailyInputTokensPro?: string;
  dailyInputTokensPlus?: string;
  dailyInputTokensEnterprise?: string;
  dailyOutputTokensFree?: string;
  dailyOutputTokensPro?: string;
  dailyOutputTokensPlus?: string;
  dailyOutputTokensEnterprise?: string;
  dailyRequestsFree?: number;
  dailyRequestsPro?: number;
  dailyRequestsPlus?: number;
  dailyRequestsEnterprise?: number;
  rpmFree?: number;
  rpmPro?: number;
  rpmPlus?: number;
  rpmEnterprise?: number;
}) {
  const values = {
    provider: data.provider,
    model: data.model,
    inputPricePerMillion: data.inputPricePerMillion,
    outputPricePerMillion: data.outputPricePerMillion,
    creditMultiplier: data.creditMultiplier || "1000",
    isPartnerOnly: data.isPartnerOnly ?? false,
    minimumPlan: data.minimumPlan || "free",
    displayName: data.displayName || null,
    description: data.description || null,
    contextWindow: data.contextWindow || null,
    maxOutputTokens: data.maxOutputTokens || null,
    customRpmLimit: data.customRpmLimit || null,
    customRpdLimit: data.customRpdLimit || null,
    isEnabled: data.isEnabled ?? true,
    // Per-tier daily limits
    dailyInputTokensFree: data.dailyInputTokensFree
      ? parseInt(data.dailyInputTokensFree, 10)
      : null,
    dailyInputTokensPro: data.dailyInputTokensPro
      ? parseInt(data.dailyInputTokensPro, 10)
      : null,
    dailyInputTokensPlus: data.dailyInputTokensPlus
      ? parseInt(data.dailyInputTokensPlus, 10)
      : null,
    dailyInputTokensEnterprise: data.dailyInputTokensEnterprise
      ? parseInt(data.dailyInputTokensEnterprise, 10)
      : null,
    dailyOutputTokensFree: data.dailyOutputTokensFree
      ? parseInt(data.dailyOutputTokensFree, 10)
      : null,
    dailyOutputTokensPro: data.dailyOutputTokensPro
      ? parseInt(data.dailyOutputTokensPro, 10)
      : null,
    dailyOutputTokensPlus: data.dailyOutputTokensPlus
      ? parseInt(data.dailyOutputTokensPlus, 10)
      : null,
    dailyOutputTokensEnterprise: data.dailyOutputTokensEnterprise
      ? parseInt(data.dailyOutputTokensEnterprise, 10)
      : null,
    dailyRequestsFree: data.dailyRequestsFree ?? null,
    dailyRequestsPro: data.dailyRequestsPro ?? null,
    dailyRequestsPlus: data.dailyRequestsPlus ?? null,
    dailyRequestsEnterprise: data.dailyRequestsEnterprise ?? null,
    rpmFree: data.rpmFree ?? null,
    rpmPro: data.rpmPro ?? null,
    rpmPlus: data.rpmPlus ?? null,
    rpmEnterprise: data.rpmEnterprise ?? null,
    updatedAt: new Date(),
  };

  if (data.id) {
    const [updated] = await db
      .update(ModelPricingTable)
      .set(values)
      .where(eq(ModelPricingTable.id, data.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(ModelPricingTable)
    .values(values)
    .returning();
  return created;
}

export async function deleteModelPricing(id: string) {
  await db.delete(ModelPricingTable).where(eq(ModelPricingTable.id, id));
}

// ============================================================================
// USER CREDITS (admin view)
// ============================================================================

export interface AdminUserCredits {
  credits: UserCreditsEntity;
  userName: string | null;
  userEmail: string;
  subscription: SubscriptionEntity | null;
}

export async function getAdminUserCredits(options: {
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ users: AdminUserCredits[]; total: number }> {
  const { search, limit = 20, offset = 0 } = options;

  let whereClause;
  if (search) {
    whereClause = or(
      like(UserTable.email, `%${search}%`),
      like(UserTable.name, `%${search}%`),
    );
  }

  const [countResult] = await db
    .select({ total: count() })
    .from(UserCreditsTable)
    .innerJoin(UserTable, eq(UserCreditsTable.userId, UserTable.id))
    .where(whereClause);

  const rows = await db
    .select({
      credits: UserCreditsTable,
      userName: UserTable.name,
      userEmail: UserTable.email,
    })
    .from(UserCreditsTable)
    .innerJoin(UserTable, eq(UserCreditsTable.userId, UserTable.id))
    .where(whereClause)
    .orderBy(desc(UserCreditsTable.updatedAt))
    .limit(limit)
    .offset(offset);

  // Fetch subscriptions for these users
  const userIds = rows.map((r) => r.credits.userId);
  const subscriptions =
    userIds.length > 0
      ? await db
          .select()
          .from(SubscriptionTable)
          .where(
            sql`${SubscriptionTable.userId} IN (${sql.join(
              userIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          )
      : [];

  const subByUser = new Map(subscriptions.map((s) => [s.userId, s]));

  return {
    users: rows.map((r) => ({
      credits: r.credits,
      userName: r.userName,
      userEmail: r.userEmail,
      subscription: subByUser.get(r.credits.userId) || null,
    })),
    total: countResult?.total ?? 0,
  };
}

export async function getUserCreditsById(userId: string) {
  const results = await db
    .select({
      credits: UserCreditsTable,
      userName: UserTable.name,
      userEmail: UserTable.email,
    })
    .from(UserCreditsTable)
    .innerJoin(UserTable, eq(UserCreditsTable.userId, UserTable.id))
    .where(eq(UserCreditsTable.userId, userId))
    .limit(1);

  if (!results[0]) return null;

  const subs = await db
    .select()
    .from(SubscriptionTable)
    .where(eq(SubscriptionTable.userId, userId))
    .limit(1);

  return {
    credits: results[0].credits,
    userName: results[0].userName,
    userEmail: results[0].userEmail,
    subscription: subs[0] || null,
  };
}

// ============================================================================
// SUBSCRIPTIONS
// ============================================================================

export async function upsertSubscription(data: {
  userId: string;
  plan: "free" | "pro" | "plus" | "enterprise";
  monthlyCredits?: string;
  status?: "active" | "canceled" | "past_due" | "paused" | "trialing";
}) {
  const existing = await db
    .select()
    .from(SubscriptionTable)
    .where(eq(SubscriptionTable.userId, data.userId))
    .limit(1);

  const values = {
    plan: data.plan,
    monthlyCredits: data.monthlyCredits || "0",
    status: data.status || "active",
    updatedAt: new Date(),
  };

  if (existing[0]) {
    const [updated] = await db
      .update(SubscriptionTable)
      .set(values)
      .where(eq(SubscriptionTable.userId, data.userId))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(SubscriptionTable)
    .values({
      userId: data.userId,
      ...values,
    })
    .returning();
  return created;
}

// ============================================================================
// ADMIN CREDIT OPERATIONS
// ============================================================================

export async function adminGrantCredits(data: {
  userId: string;
  amount: number;
  grantedBy: string;
  description?: string;
}) {
  // Get or create credits
  let credits = await db
    .select()
    .from(UserCreditsTable)
    .where(eq(UserCreditsTable.userId, data.userId))
    .limit(1);

  if (!credits[0]) {
    await db.insert(UserCreditsTable).values({
      userId: data.userId,
      balance: "0",
    });
    credits = await db
      .select()
      .from(UserCreditsTable)
      .where(eq(UserCreditsTable.userId, data.userId))
      .limit(1);
  }

  const currentBalance = parseFloat(credits[0].balance);
  const newBalance = currentBalance + data.amount;

  await db
    .update(UserCreditsTable)
    .set({
      balance: newBalance.toString(),
      totalCreditsGranted: (
        parseFloat(credits[0].totalCreditsGranted) + data.amount
      ).toString(),
      updatedAt: new Date(),
    })
    .where(eq(UserCreditsTable.userId, data.userId));

  await db.insert(CreditTransactionTable).values({
    userId: data.userId,
    type: data.amount >= 0 ? "grant" : "adjustment",
    amount: data.amount.toString(),
    balanceAfter: newBalance.toString(),
    referenceType: "admin_grant",
    grantedBy: data.grantedBy,
    description:
      data.description || `Admin ${data.amount >= 0 ? "grant" : "adjustment"}`,
  });

  return { previousBalance: currentBalance, newBalance };
}

export async function adminSetCredits(data: {
  userId: string;
  balance: number;
  totalCreditsUsed?: number;
  totalCreditsGranted?: number;
  monthlyCreditsUsed?: number;
  grantedBy: string;
  description?: string;
}) {
  // Get or create credits
  let credits = await db
    .select()
    .from(UserCreditsTable)
    .where(eq(UserCreditsTable.userId, data.userId))
    .limit(1);

  if (!credits[0]) {
    await db.insert(UserCreditsTable).values({
      userId: data.userId,
      balance: "0",
    });
    credits = await db
      .select()
      .from(UserCreditsTable)
      .where(eq(UserCreditsTable.userId, data.userId))
      .limit(1);
  }

  const previousBalance = parseFloat(credits[0].balance);
  const updateFields: Record<string, any> = {
    balance: data.balance.toString(),
    updatedAt: new Date(),
  };
  if (data.totalCreditsUsed !== undefined) {
    updateFields.totalCreditsUsed = data.totalCreditsUsed.toString();
  }
  if (data.totalCreditsGranted !== undefined) {
    updateFields.totalCreditsGranted = data.totalCreditsGranted.toString();
  }
  if (data.monthlyCreditsUsed !== undefined) {
    updateFields.monthlyCreditsUsed = data.monthlyCreditsUsed.toString();
  }

  await db
    .update(UserCreditsTable)
    .set(updateFields)
    .where(eq(UserCreditsTable.userId, data.userId));

  // Log the adjustment transaction
  const diff = data.balance - previousBalance;
  await db.insert(CreditTransactionTable).values({
    userId: data.userId,
    type: "adjustment",
    amount: diff.toString(),
    balanceAfter: data.balance.toString(),
    referenceType: "admin_grant",
    grantedBy: data.grantedBy,
    description: data.description || `Admin set balance to ${data.balance}`,
  });

  return { previousBalance, newBalance: data.balance };
}

export async function adminSetRequests(data: {
  userId: string;
  dailyRequestCount: number;
  grantedBy: string;
  description?: string;
}) {
  // Get or create credits
  let credits = await db
    .select()
    .from(UserCreditsTable)
    .where(eq(UserCreditsTable.userId, data.userId))
    .limit(1);

  if (!credits[0]) {
    await db.insert(UserCreditsTable).values({
      userId: data.userId,
      balance: "0",
    });
    credits = await db
      .select()
      .from(UserCreditsTable)
      .where(eq(UserCreditsTable.userId, data.userId))
      .limit(1);
  }

  const previousCount = credits[0].dailyRequestCount;

  await db
    .update(UserCreditsTable)
    .set({
      dailyRequestCount: data.dailyRequestCount,
      updatedAt: new Date(),
    })
    .where(eq(UserCreditsTable.userId, data.userId));

  // Log the adjustment transaction
  await db.insert(CreditTransactionTable).values({
    userId: data.userId,
    type: "adjustment",
    amount: "0",
    balanceAfter: credits[0].balance,
    referenceType: "admin_grant",
    grantedBy: data.grantedBy,
    description:
      data.description ||
      `Admin set daily request count from ${previousCount} to ${data.dailyRequestCount}`,
  });

  return { previousCount, newCount: data.dailyRequestCount };
}

// ============================================================================
// STATS
// ============================================================================

export async function getAdminBillingStats() {
  const [creditsStats] = await db
    .select({
      totalUsers: count(),
      totalBalance: sql<string>`COALESCE(SUM(${UserCreditsTable.balance}::numeric), 0)`,
      totalUsed: sql<string>`COALESCE(SUM(${UserCreditsTable.totalCreditsUsed}::numeric), 0)`,
      totalGranted: sql<string>`COALESCE(SUM(${UserCreditsTable.totalCreditsGranted}::numeric), 0)`,
      totalPurchased: sql<string>`COALESCE(SUM(${UserCreditsTable.totalCreditsPurchased}::numeric), 0)`,
    })
    .from(UserCreditsTable);

  const [pricingCount] = await db
    .select({ total: count() })
    .from(ModelPricingTable);

  const [subStats] = await db
    .select({
      total: count(),
      premium: sql<number>`COUNT(*) FILTER (WHERE ${SubscriptionTable.plan} = 'premium')`,
      enterprise: sql<number>`COUNT(*) FILTER (WHERE ${SubscriptionTable.plan} = 'enterprise')`,
    })
    .from(SubscriptionTable);

  const [planCount] = await db
    .select({ total: count() })
    .from(PricingPlanTable);

  const [activePlanCount] = await db
    .select({ total: count() })
    .from(PricingPlanTable)
    .where(eq(PricingPlanTable.isActive, true));

  return {
    credits: creditsStats,
    modelPricingCount: pricingCount?.total ?? 0,
    subscriptions: subStats,
    pricingPlans: {
      total: planCount?.total ?? 0,
      active: activePlanCount?.total ?? 0,
    },
  };
}

// ============================================================================
// PRICING PLANS
// ============================================================================

export async function getAllPricingPlans(): Promise<PricingPlanEntity[]> {
  return db
    .select()
    .from(PricingPlanTable)
    .orderBy(PricingPlanTable.pricingType, PricingPlanTable.sortOrder);
}

export async function getPricingPlansByType(
  pricingType: "token_based" | "request_based" | "unlimited",
): Promise<PricingPlanEntity[]> {
  return db
    .select()
    .from(PricingPlanTable)
    .where(eq(PricingPlanTable.pricingType, pricingType))
    .orderBy(PricingPlanTable.sortOrder);
}

export async function getActivePricingPlans(): Promise<PricingPlanEntity[]> {
  return db
    .select()
    .from(PricingPlanTable)
    .where(eq(PricingPlanTable.isActive, true))
    .orderBy(PricingPlanTable.pricingType, PricingPlanTable.sortOrder);
}

export async function upsertPricingPlan(data: {
  id?: string;
  tier: "free" | "pro" | "plus" | "enterprise";
  pricingType: "token_based" | "request_based" | "unlimited";
  displayName: string;
  description?: string;
  monthlyPrice: string;
  yearlyPrice: string;
  tokenLimit?: number | null;
  requestLimit?: number | null;
  requestPeriod?: "daily" | "monthly";
  monthlyCredits?: string;
  features?: string;
  highlighted?: boolean;
  badge?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  const values = {
    tier: data.tier,
    pricingType: data.pricingType,
    displayName: data.displayName,
    description: data.description || null,
    monthlyPrice: data.monthlyPrice,
    yearlyPrice: data.yearlyPrice,
    tokenLimit: data.tokenLimit ?? null,
    requestLimit: data.requestLimit ?? null,
    requestPeriod: data.requestPeriod || "monthly",
    monthlyCredits: data.monthlyCredits || "0",
    features: data.features || "[]",
    highlighted: data.highlighted ?? false,
    badge: data.badge ?? null,
    sortOrder: data.sortOrder ?? 0,
    isActive: data.isActive ?? true,
    updatedAt: new Date(),
  };

  if (data.id) {
    const [updated] = await db
      .update(PricingPlanTable)
      .set(values)
      .where(eq(PricingPlanTable.id, data.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(PricingPlanTable)
    .values(values)
    .returning();
  return created;
}

export async function deletePricingPlan(id: string) {
  await db.delete(PricingPlanTable).where(eq(PricingPlanTable.id, id));
}
