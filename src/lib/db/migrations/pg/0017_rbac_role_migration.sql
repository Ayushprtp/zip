-- Migration: Convert old roles to new RBAC system
-- Old roles: admin, editor, user
-- New roles: super_admin, admin, moderator, user

-- Convert 'editor' role to 'user' (default)
UPDATE "user" SET role = 'user' WHERE role = 'editor';

-- Convert old 'admin' to new 'admin' (same name, different meaning)
-- Note: The first admin should be promoted to super_admin manually

-- Add new columns with defaults
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS account_type VARCHAR DEFAULT 'normal' NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS plan VARCHAR DEFAULT 'free' NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT false NOT NULL;

-- Set the first admin as super_admin and owner
UPDATE "user" 
SET role = 'super_admin', is_owner = true 
WHERE id = (
  SELECT id FROM "user" 
  WHERE role = 'admin' 
  ORDER BY created_at ASC 
  LIMIT 1
);

-- Add constraints
ALTER TABLE "user" ADD CONSTRAINT check_role 
  CHECK (role IN ('super_admin', 'admin', 'moderator', 'user'));
ALTER TABLE "user" ADD CONSTRAINT check_account_type 
  CHECK (account_type IN ('normal', 'partner'));
ALTER TABLE "user" ADD CONSTRAINT check_plan 
  CHECK (plan IN ('free', 'premium', 'enterprise'));
