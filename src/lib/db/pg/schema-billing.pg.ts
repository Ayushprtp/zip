import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  boolean,
  integer,
  bigint,
  decimal,
  index,
} from "drizzle-orm/pg-core";
import { UserTable } from "./schema.pg";

/**
 * FLARE.SH BILLING & USAGE SYSTEM
 *
 * Tracks:
 * - Token usage per user/model
 * - Message counts
 * - Request counts (RPM/RPD)
 * - Credit balance
 * - Billing history
 */

// ============================================================================
// USER CREDITS & BALANCE
// ============================================================================

export const UserCreditsTable = pgTable(
  "user_credits",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" })
      .unique(),

    // Current balance in credits (1 credit = $0.001 or configurable)
    balance: decimal("balance", { precision: 12, scale: 4 })
      .notNull()
      .default("0"),

    // Lifetime totals
    totalCreditsUsed: decimal("total_credits_used", { precision: 12, scale: 4 })
      .notNull()
      .default("0"),
    totalCreditsPurchased: decimal("total_credits_purchased", {
      precision: 12,
      scale: 4,
    })
      .notNull()
      .default("0"),
    totalCreditsGranted: decimal("total_credits_granted", {
      precision: 12,
      scale: 4,
    })
      .notNull()
      .default("0"), // Free credits

    // Monthly usage tracking
    monthlyCreditsUsed: decimal("monthly_credits_used", {
      precision: 12,
      scale: 4,
    })
      .notNull()
      .default("0"),
    monthlyResetAt: timestamp("monthly_reset_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),

    // Quota tracking
    dailyRequestCount: integer("daily_request_count").notNull().default(0),
    dailyResetAt: timestamp("daily_reset_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),

    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("user_credits_user_idx").on(table.userId)],
);

// ============================================================================
// USAGE TRACKING
// ============================================================================

export const UsageLogTable = pgTable(
  "usage_log",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),

    // Request info
    threadId: uuid("thread_id"),
    messageId: text("message_id"),

    // Model info
    provider: text("provider").notNull(), // openai, google, anthropic, etc.
    model: text("model").notNull(),

    // Token usage
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),

    // Cost calculation
    inputCost: decimal("input_cost", { precision: 12, scale: 6 })
      .notNull()
      .default("0"),
    outputCost: decimal("output_cost", { precision: 12, scale: 6 })
      .notNull()
      .default("0"),
    totalCost: decimal("total_cost", { precision: 12, scale: 6 })
      .notNull()
      .default("0"),
    creditsCharged: decimal("credits_charged", { precision: 12, scale: 4 })
      .notNull()
      .default("0"),

    // Request metadata
    requestType: varchar("request_type", {
      enum: ["chat", "completion", "embedding", "image", "audio", "tool"],
    })
      .notNull()
      .default("chat"),

    // Timing
    latencyMs: integer("latency_ms"),

    // Status
    status: varchar("status", {
      enum: ["success", "error", "rate_limited", "quota_exceeded"],
    })
      .notNull()
      .default("success"),
    errorMessage: text("error_message"),

    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("usage_log_user_idx").on(table.userId),
    index("usage_log_created_idx").on(table.createdAt),
    index("usage_log_model_idx").on(table.provider, table.model),
  ],
);

// ============================================================================
// DAILY/HOURLY AGGREGATED USAGE (for fast stats)
// ============================================================================

export const UsageAggregateTable = pgTable(
  "usage_aggregate",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),

    // Time period
    periodType: varchar("period_type", {
      enum: ["hourly", "daily", "monthly"],
    }).notNull(),
    periodStart: timestamp("period_start").notNull(),

    // Model (optional - null for total aggregates)
    provider: text("provider"),
    model: text("model"),

    // Aggregated counts
    requestCount: integer("request_count").notNull().default(0),
    messageCount: integer("message_count").notNull().default(0),

    // Token totals
    totalInputTokens: bigint("total_input_tokens", { mode: "number" })
      .notNull()
      .default(0),
    totalOutputTokens: bigint("total_output_tokens", { mode: "number" })
      .notNull()
      .default(0),
    totalTokens: bigint("total_tokens", { mode: "number" })
      .notNull()
      .default(0),

    // Cost totals
    totalCost: decimal("total_cost", { precision: 12, scale: 6 })
      .notNull()
      .default("0"),
    totalCreditsUsed: decimal("total_credits_used", { precision: 12, scale: 4 })
      .notNull()
      .default("0"),

    // Error tracking
    errorCount: integer("error_count").notNull().default(0),

    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("usage_aggregate_user_period_idx").on(
      table.userId,
      table.periodType,
      table.periodStart,
    ),
    index("usage_aggregate_period_idx").on(table.periodStart),
  ],
);

// ============================================================================
// CREDIT TRANSACTIONS
// ============================================================================

export const CreditTransactionTable = pgTable(
  "credit_transaction",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),

    // Transaction type
    type: varchar("type", {
      enum: [
        "purchase",
        "usage",
        "refund",
        "grant",
        "adjustment",
        "subscription",
      ],
    }).notNull(),

    // Amount (positive = credit added, negative = credit used)
    amount: decimal("amount", { precision: 12, scale: 4 }).notNull(),

    // Balance after transaction
    balanceAfter: decimal("balance_after", {
      precision: 12,
      scale: 4,
    }).notNull(),

    // Reference to what caused this transaction
    referenceType: varchar("reference_type", {
      enum: ["usage_log", "payment", "admin_grant", "subscription", "refund"],
    }),
    referenceId: text("reference_id"),

    // Description
    description: text("description"),

    // For purchases - payment info
    paymentProvider: text("payment_provider"), // stripe, paypal, etc.
    paymentId: text("payment_id"),
    amountUsd: decimal("amount_usd", { precision: 10, scale: 2 }), // Actual USD paid

    // Admin actions
    grantedBy: uuid("granted_by").references(() => UserTable.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("credit_transaction_user_idx").on(table.userId),
    index("credit_transaction_type_idx").on(table.type),
    index("credit_transaction_created_idx").on(table.createdAt),
  ],
);

// ============================================================================
// MODEL PRICING
// ============================================================================

export const ModelPricingTable = pgTable(
  "model_pricing",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),

    // Model identification
    provider: text("provider").notNull(),
    model: text("model").notNull(),

    // Pricing per 1M tokens (in USD)
    inputPricePerMillion: decimal("input_price_per_million", {
      precision: 10,
      scale: 4,
    }).notNull(),
    outputPricePerMillion: decimal("output_price_per_million", {
      precision: 10,
      scale: 4,
    }).notNull(),

    // Credit multiplier (how many credits per $1 of cost)
    creditMultiplier: decimal("credit_multiplier", { precision: 10, scale: 4 })
      .notNull()
      .default("1000"), // 1000 credits = $1

    // Access restrictions
    isPartnerOnly: boolean("is_partner_only").notNull().default(false),
    minimumPlan: varchar("minimum_plan", {
      enum: ["free", "premium", "enterprise"],
    })
      .notNull()
      .default("free"),

    // Model metadata
    displayName: text("display_name"),
    description: text("description"),
    contextWindow: integer("context_window"),
    maxOutputTokens: integer("max_output_tokens"),

    // Rate limits (can override plan defaults)
    customRpmLimit: integer("custom_rpm_limit"),
    customRpdLimit: integer("custom_rpd_limit"),

    // Status
    isEnabled: boolean("is_enabled").notNull().default(true),

    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("model_pricing_provider_model_idx").on(table.provider, table.model),
  ],
);

// ============================================================================
// SUBSCRIPTION PLANS (for recurring billing)
// ============================================================================

export const SubscriptionTable = pgTable(
  "subscription",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" })
      .unique(),

    // Plan info
    plan: varchar("plan", {
      enum: ["free", "premium", "enterprise"],
    })
      .notNull()
      .default("free"),

    // Billing cycle
    billingCycle: varchar("billing_cycle", {
      enum: ["monthly", "yearly"],
    }),

    // Monthly credit allowance (included in plan)
    monthlyCredits: decimal("monthly_credits", { precision: 12, scale: 4 })
      .notNull()
      .default("0"),

    // Subscription status
    status: varchar("status", {
      enum: ["active", "canceled", "past_due", "paused", "trialing"],
    })
      .notNull()
      .default("active"),

    // External subscription info (Stripe, etc.)
    externalProvider: text("external_provider"),
    externalId: text("external_id"),

    // Dates
    currentPeriodStart: timestamp("current_period_start"),
    currentPeriodEnd: timestamp("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at"),

    // Trial info
    trialStart: timestamp("trial_start"),
    trialEnd: timestamp("trial_end"),

    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: timestamp("updated_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("subscription_user_idx").on(table.userId),
    index("subscription_status_idx").on(table.status),
  ],
);

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type UserCreditsEntity = typeof UserCreditsTable.$inferSelect;
export type UsageLogEntity = typeof UsageLogTable.$inferSelect;
export type UsageAggregateEntity = typeof UsageAggregateTable.$inferSelect;
export type CreditTransactionEntity =
  typeof CreditTransactionTable.$inferSelect;
export type ModelPricingEntity = typeof ModelPricingTable.$inferSelect;
export type SubscriptionEntity = typeof SubscriptionTable.$inferSelect;
