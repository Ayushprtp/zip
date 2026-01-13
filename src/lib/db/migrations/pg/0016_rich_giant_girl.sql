CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_role" varchar NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"details" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "invite_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"target_role" varchar NOT NULL,
	"assign_partner" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"restrict_to_email" text,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"used_by" uuid,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"note" text,
	CONSTRAINT "invite_token_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "credit_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar NOT NULL,
	"amount" numeric(12, 4) NOT NULL,
	"balance_after" numeric(12, 4) NOT NULL,
	"reference_type" varchar,
	"reference_id" text,
	"description" text,
	"payment_provider" text,
	"payment_id" text,
	"amount_usd" numeric(10, 2),
	"granted_by" uuid,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_price_per_million" numeric(10, 4) NOT NULL,
	"output_price_per_million" numeric(10, 4) NOT NULL,
	"credit_multiplier" numeric(10, 4) DEFAULT '1000' NOT NULL,
	"is_partner_only" boolean DEFAULT false NOT NULL,
	"minimum_plan" varchar DEFAULT 'free' NOT NULL,
	"display_name" text,
	"description" text,
	"context_window" integer,
	"max_output_tokens" integer,
	"custom_rpm_limit" integer,
	"custom_rpd_limit" integer,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" varchar DEFAULT 'free' NOT NULL,
	"billing_cycle" varchar,
	"monthly_credits" numeric(12, 4) DEFAULT '0' NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"external_provider" text,
	"external_id" text,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "subscription_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "usage_aggregate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period_type" varchar NOT NULL,
	"period_start" timestamp NOT NULL,
	"provider" text,
	"model" text,
	"request_count" integer DEFAULT 0 NOT NULL,
	"message_count" integer DEFAULT 0 NOT NULL,
	"total_input_tokens" bigint DEFAULT 0 NOT NULL,
	"total_output_tokens" bigint DEFAULT 0 NOT NULL,
	"total_tokens" bigint DEFAULT 0 NOT NULL,
	"total_cost" numeric(12, 6) DEFAULT '0' NOT NULL,
	"total_credits_used" numeric(12, 4) DEFAULT '0' NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"thread_id" uuid,
	"message_id" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"input_cost" numeric(12, 6) DEFAULT '0' NOT NULL,
	"output_cost" numeric(12, 6) DEFAULT '0' NOT NULL,
	"total_cost" numeric(12, 6) DEFAULT '0' NOT NULL,
	"credits_charged" numeric(12, 4) DEFAULT '0' NOT NULL,
	"request_type" varchar DEFAULT 'chat' NOT NULL,
	"latency_ms" integer,
	"status" varchar DEFAULT 'success' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"balance" numeric(12, 4) DEFAULT '0' NOT NULL,
	"total_credits_used" numeric(12, 4) DEFAULT '0' NOT NULL,
	"total_credits_purchased" numeric(12, 4) DEFAULT '0' NOT NULL,
	"total_credits_granted" numeric(12, 4) DEFAULT '0' NOT NULL,
	"monthly_credits_used" numeric(12, 4) DEFAULT '0' NOT NULL,
	"monthly_reset_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"daily_request_count" integer DEFAULT 0 NOT NULL,
	"daily_reset_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "user_credits_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_token" ADD CONSTRAINT "invite_token_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_token" ADD CONSTRAINT "invite_token_used_by_user_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_aggregate" ADD CONSTRAINT "usage_aggregate_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_log" ADD CONSTRAINT "usage_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credits" ADD CONSTRAINT "user_credits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_idx" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "invite_token_expires_idx" ON "invite_token" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "invite_token_used_idx" ON "invite_token" USING btree ("used_at");--> statement-breakpoint
CREATE INDEX "credit_transaction_user_idx" ON "credit_transaction" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_transaction_type_idx" ON "credit_transaction" USING btree ("type");--> statement-breakpoint
CREATE INDEX "credit_transaction_created_idx" ON "credit_transaction" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "model_pricing_provider_model_idx" ON "model_pricing" USING btree ("provider","model");--> statement-breakpoint
CREATE INDEX "subscription_user_idx" ON "subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscription_status_idx" ON "subscription" USING btree ("status");--> statement-breakpoint
CREATE INDEX "usage_aggregate_user_period_idx" ON "usage_aggregate" USING btree ("user_id","period_type","period_start");--> statement-breakpoint
CREATE INDEX "usage_aggregate_period_idx" ON "usage_aggregate" USING btree ("period_start");--> statement-breakpoint
CREATE INDEX "usage_log_user_idx" ON "usage_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "usage_log_created_idx" ON "usage_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "usage_log_model_idx" ON "usage_log" USING btree ("provider","model");--> statement-breakpoint
CREATE INDEX "user_credits_user_idx" ON "user_credits" USING btree ("user_id");