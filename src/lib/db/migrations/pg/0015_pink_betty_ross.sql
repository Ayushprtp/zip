ALTER TABLE "user" ALTER COLUMN "role" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "account_type" varchar DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "plan" varchar DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_owner" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Data migration: Convert old roles to new RBAC system
-- 'editor' -> 'user'
UPDATE "user" SET role = 'user' WHERE role = 'editor';--> statement-breakpoint
-- Set first admin as super_admin and owner
UPDATE "user" SET role = 'super_admin', is_owner = true 
WHERE id = (SELECT id FROM "user" WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1) 
AND role = 'admin';