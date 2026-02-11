import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { UserTable } from "@/lib/db/pg/schema.pg";

export const builderThreads = pgTable(
  "builder_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => UserTable.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 })
      .notNull()
      .default("Untitled Project"),
    template: varchar("template", { length: 50 })
      .notNull()
      .$type<
        "react" | "nextjs" | "vite-react" | "vanilla" | "static" | "httpchain"
      >(),
    githubRepoUrl: text("github_repo_url"),
    githubRepoId: text("github_repo_id"),
    githubRepoName: text("github_repo_name"),
    vercelProjectId: text("vercel_project_id"),
    vercelProjectName: text("vercel_project_name"),
    vercelDeploymentUrl: text("vercel_deployment_url"),
    lastCommitHash: text("last_commit_hash"),
    lastDeployedAt: timestamp("last_deployed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_builder_threads_user_id").on(table.userId),
    updatedAtIdx: index("idx_builder_threads_updated_at").on(table.updatedAt),
  }),
);

export const builderMessages = pgTable(
  "builder_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => builderThreads.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 })
      .notNull()
      .$type<"user" | "assistant" | "system">(),
    content: text("content").notNull(),
    mentions: jsonb("mentions").default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    threadIdIdx: index("idx_builder_messages_thread_id").on(table.threadId),
    createdAtIdx: index("idx_builder_messages_created_at").on(table.createdAt),
  }),
);

export const builderFiles = pgTable(
  "builder_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => builderThreads.id, { onDelete: "cascade" }),
    filePath: varchar("file_path", { length: 500 }).notNull(),
    fileContent: text("file_content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    threadIdIdx: index("idx_builder_files_thread_id").on(table.threadId),
    updatedAtIdx: index("idx_builder_files_updated_at").on(table.updatedAt),
    uniqueThreadFile: unique("unique_thread_file").on(
      table.threadId,
      table.filePath,
    ),
  }),
);

export const builderCommits = pgTable(
  "builder_commits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => builderThreads.id, { onDelete: "cascade" }),
    commitHash: text("commit_hash").notNull(),
    message: text("message").notNull(),
    author: text("author").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    threadIdIdx: index("idx_builder_commits_thread_id").on(table.threadId),
    timestampIdx: index("idx_builder_commits_timestamp").on(table.timestamp),
  }),
);

export const builderDeployments = pgTable(
  "builder_deployments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => builderThreads.id, { onDelete: "cascade" }),
    vercelDeploymentId: text("vercel_deployment_id").notNull(),
    url: text("url").notNull(),
    status: varchar("status", { length: 20 })
      .notNull()
      .$type<"BUILDING" | "READY" | "ERROR" | "CANCELED">(),
    commitHash: text("commit_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    threadIdIdx: index("idx_builder_deployments_thread_id").on(table.threadId),
    createdAtIdx: index("idx_builder_deployments_created_at").on(
      table.createdAt,
    ),
  }),
);

// Types
export type BuilderThread = typeof builderThreads.$inferSelect;
export type NewBuilderThread = typeof builderThreads.$inferInsert;
export type BuilderMessage = typeof builderMessages.$inferSelect;
export type NewBuilderMessage = typeof builderMessages.$inferInsert;
export type BuilderFile = typeof builderFiles.$inferSelect;
export type NewBuilderFile = typeof builderFiles.$inferInsert;
export type BuilderCommit = typeof builderCommits.$inferSelect;
export type NewBuilderCommit = typeof builderCommits.$inferInsert;
export type BuilderDeployment = typeof builderDeployments.$inferSelect;
export type NewBuilderDeployment = typeof builderDeployments.$inferInsert;
