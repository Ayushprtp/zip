-- Add GitHub and Vercel integration columns to builder_threads
ALTER TABLE "builder_threads" ADD COLUMN "github_repo_url" TEXT;
ALTER TABLE "builder_threads" ADD COLUMN "github_repo_id" TEXT;
ALTER TABLE "builder_threads" ADD COLUMN "github_repo_name" TEXT;
ALTER TABLE "builder_threads" ADD COLUMN "vercel_project_id" TEXT;
ALTER TABLE "builder_threads" ADD COLUMN "vercel_project_name" TEXT;
ALTER TABLE "builder_threads" ADD COLUMN "vercel_deployment_url" TEXT;
ALTER TABLE "builder_threads" ADD COLUMN "last_commit_hash" TEXT;
ALTER TABLE "builder_threads" ADD COLUMN "last_deployed_at" TIMESTAMP WITH TIME ZONE;

-- Create builder_commits table
CREATE TABLE IF NOT EXISTS "builder_commits" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "thread_id" UUID NOT NULL REFERENCES "builder_threads"("id") ON DELETE CASCADE,
  "commit_hash" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_builder_commits_thread_id" ON "builder_commits"("thread_id");
CREATE INDEX IF NOT EXISTS "idx_builder_commits_timestamp" ON "builder_commits"("timestamp");

-- Create builder_deployments table
CREATE TABLE IF NOT EXISTS "builder_deployments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "thread_id" UUID NOT NULL REFERENCES "builder_threads"("id") ON DELETE CASCADE,
  "vercel_deployment_id" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "commit_hash" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_builder_deployments_thread_id" ON "builder_deployments"("thread_id");
CREATE INDEX IF NOT EXISTS "idx_builder_deployments_created_at" ON "builder_deployments"("created_at");
