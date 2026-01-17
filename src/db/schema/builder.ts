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
      .$type<"react" | "nextjs" | "vite-react" | "vanilla" | "static">(),
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

// Types
export type BuilderThread = typeof builderThreads.$inferSelect;
export type NewBuilderThread = typeof builderThreads.$inferInsert;
export type BuilderMessage = typeof builderMessages.$inferSelect;
export type NewBuilderMessage = typeof builderMessages.$inferInsert;
export type BuilderFile = typeof builderFiles.$inferSelect;
export type NewBuilderFile = typeof builderFiles.$inferInsert;
