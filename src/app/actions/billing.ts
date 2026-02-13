"use server";

import { z } from "zod";
import { validatedActionWithUser } from "lib/action-utils";
import { pgDb as db } from "lib/db/pg/db.pg";
import { UserTable } from "lib/db/pg/schema.pg";
import {
  SubscriptionTable,
  UserCreditsTable,
  CreditTransactionTable,
} from "lib/db/pg/schema-billing.pg";
import { eq } from "drizzle-orm";
import { TIER_HIERARCHY, userPlanInfo, type UserPlan } from "app-types/roles";
import logger from "lib/logger";
import type { ActionState } from "lib/action-utils";

// ============================================================================
// SCHEMAS
// ============================================================================

const ChangePlanSchema = z.object({
  plan: z.enum(["free", "pro", "plus", "enterprise"]),
});

// ============================================================================
// TYPES
// ============================================================================

export type ChangePlanActionState = ActionState & {
  plan?: string;
  previousPlan?: string;
  direction?: "upgrade" | "downgrade" | "same";
};

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * User-facing action to change their own plan.
 * Updates user.plan, subscription, and grants monthly credits.
 */
export const changePlanAction = validatedActionWithUser(
  ChangePlanSchema,
  async (data, _formData, user): Promise<ChangePlanActionState> => {
    const newPlan = data.plan as UserPlan;

    try {
      // 1. Get current user plan from DB
      const [currentUser] = await db
        .select({ plan: UserTable.plan })
        .from(UserTable)
        .where(eq(UserTable.id, user.id))
        .limit(1);

      if (!currentUser) {
        return { success: false, message: "User not found" };
      }

      const currentPlan = (currentUser.plan || "free") as UserPlan;

      // 2. Check if same plan
      if (currentPlan === newPlan) {
        return {
          success: false,
          message: "You are already on this plan",
          plan: newPlan,
          direction: "same",
        };
      }

      // 3. Determine direction
      const direction =
        TIER_HIERARCHY[newPlan] > TIER_HIERARCHY[currentPlan]
          ? "upgrade"
          : "downgrade";

      // 4. Get plan info for credits
      const planInfo = userPlanInfo[newPlan];
      const monthlyCredits = planInfo.limits.creditsPerMonth;

      // 5. Update user.plan in user table
      await db
        .update(UserTable)
        .set({ plan: newPlan })
        .where(eq(UserTable.id, user.id));

      // 6. Upsert subscription
      const existingSub = await db
        .select()
        .from(SubscriptionTable)
        .where(eq(SubscriptionTable.userId, user.id))
        .limit(1);

      if (existingSub[0]) {
        await db
          .update(SubscriptionTable)
          .set({
            plan: newPlan,
            monthlyCredits: monthlyCredits.toString(),
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(SubscriptionTable.userId, user.id));
      } else {
        await db.insert(SubscriptionTable).values({
          userId: user.id,
          plan: newPlan,
          monthlyCredits: monthlyCredits.toString(),
          status: "active",
        });
      }

      // 7. Initialize or update user credits
      const existingCredits = await db
        .select()
        .from(UserCreditsTable)
        .where(eq(UserCreditsTable.userId, user.id))
        .limit(1);

      if (existingCredits[0]) {
        // If upgrading, grant the difference in credits
        if (direction === "upgrade") {
          const currentBalance = parseFloat(existingCredits[0].balance);
          const bonusCredits = monthlyCredits > 0 ? monthlyCredits : 0;
          const newBalance = currentBalance + bonusCredits;

          await db
            .update(UserCreditsTable)
            .set({
              balance: newBalance.toString(),
              totalCreditsGranted: (
                parseFloat(existingCredits[0].totalCreditsGranted) +
                bonusCredits
              ).toString(),
              updatedAt: new Date(),
            })
            .where(eq(UserCreditsTable.userId, user.id));

          // Log transaction
          if (bonusCredits > 0) {
            await db.insert(CreditTransactionTable).values({
              userId: user.id,
              type: "grant",
              amount: bonusCredits.toString(),
              balanceAfter: newBalance.toString(),
              referenceType: "subscription",
              description: `Plan ${direction}: ${currentPlan} → ${newPlan} (+${bonusCredits} credits)`,
            });
          }
        }
      } else {
        // Create credits entry with monthly allocation
        const initialCredits = monthlyCredits > 0 ? monthlyCredits : 0;
        await db.insert(UserCreditsTable).values({
          userId: user.id,
          balance: initialCredits.toString(),
          totalCreditsGranted: initialCredits.toString(),
        });

        if (initialCredits > 0) {
          await db.insert(CreditTransactionTable).values({
            userId: user.id,
            type: "grant",
            amount: initialCredits.toString(),
            balanceAfter: initialCredits.toString(),
            referenceType: "subscription",
            description: `Plan activated: ${newPlan} (+${initialCredits} credits)`,
          });
        }
      }

      logger.info(
        `User ${user.id} changed plan: ${currentPlan} → ${newPlan} (${direction})`,
      );

      return {
        success: true,
        message: `Successfully ${direction === "upgrade" ? "upgraded" : "downgraded"} to ${planInfo.label} plan`,
        plan: newPlan,
        previousPlan: currentPlan,
        direction,
      };
    } catch (error) {
      logger.error("Plan change failed:", error);
      return {
        success: false,
        message: "Failed to change plan. Please try again.",
      };
    }
  },
);
