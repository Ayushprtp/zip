import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { UserTable } from "./schema.pg";

/**
 * INVITE TOKEN TABLE
 *
 * All privileged roles (admin, moderator) are invite-only.
 * Rules:
 * - One-time use
 * - Expiry-based
 * - Logged
 * - Only super_admin can create invites
 */
export const InviteTokenTable = pgTable(
  "invite_token",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),

    // The token itself (hashed for security)
    token: text("token").notNull().unique(),

    // What role will be assigned when used
    targetRole: varchar("target_role", {
      enum: ["admin", "moderator"],
    }).notNull(),

    // Optional: Assign partner account type
    assignPartner: boolean("assign_partner").default(false).notNull(),

    // Who created this invite
    createdBy: uuid("created_by")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),

    // Optional: Limit to specific email
    restrictToEmail: text("restrict_to_email"),

    // When the invite expires
    expiresAt: timestamp("expires_at").notNull(),

    // Whether the invite has been used
    usedAt: timestamp("used_at"),
    usedBy: uuid("used_by").references(() => UserTable.id, {
      onDelete: "set null",
    }),

    // Metadata
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),

    // Optional note for the invite
    note: text("note"),
  },
  (table) => [
    index("invite_token_expires_idx").on(table.expiresAt),
    index("invite_token_used_idx").on(table.usedAt),
  ],
);

export type InviteTokenEntity = typeof InviteTokenTable.$inferSelect;
export type NewInviteToken = typeof InviteTokenTable.$inferInsert;

/**
 * AUDIT LOG TABLE
 *
 * All admin actions must be auditable.
 */
export const AuditLogTable = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),

    // Who performed the action
    actorId: uuid("actor_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    actorRole: varchar("actor_role", {
      enum: ["super_admin", "admin", "moderator", "user"],
    }).notNull(),

    // What action was performed
    action: text("action").notNull(), // e.g., "create_invite", "change_role", "ban_user"

    // Target of the action (if applicable)
    targetType: text("target_type"), // e.g., "user", "invite", "model"
    targetId: text("target_id"),

    // Details of the action (JSON)
    details: text("details"), // JSON stringified for flexibility

    // Metadata
    createdAt: timestamp("created_at")
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (table) => [
    index("audit_log_actor_idx").on(table.actorId),
    index("audit_log_action_idx").on(table.action),
    index("audit_log_created_idx").on(table.createdAt),
  ],
);

export type AuditLogEntity = typeof AuditLogTable.$inferSelect;
export type NewAuditLog = typeof AuditLogTable.$inferInsert;
