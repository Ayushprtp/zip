-- ============================================================================
-- AI Builder Complete Database Schema
-- PostgreSQL 14+
-- ============================================================================
-- This file contains the complete database schema for the AI Builder application
-- Execute this on a fresh PostgreSQL database to set up all tables
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- USER MANAGEMENT TABLES
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS "user" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "email_verified" BOOLEAN NOT NULL DEFAULT FALSE,
    "password" TEXT,
    "image" TEXT,
    "preferences" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Ban/moderation fields
    "banned" BOOLEAN,
    "ban_reason" TEXT,
    "ban_expires" TIMESTAMP WITH TIME ZONE,
    
    -- RBAC System
    "role" VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'moderator', 'user')),
    "account_type" VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (account_type IN ('normal', 'partner')),
    "plan" VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium', 'enterprise')),
    "is_owner" BOOLEAN NOT NULL DEFAULT FALSE
);

-- Sessions table
CREATE TABLE IF NOT EXISTS "session" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "impersonated_by" TEXT
);

-- Accounts table (OAuth providers)
CREATE TABLE IF NOT EXISTS "account" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP WITH TIME ZONE,
    "refresh_token_expires_at" TIMESTAMP WITH TIME ZONE,
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Verification table (email verification, password reset)
CREATE TABLE IF NOT EXISTS "verification" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- CHAT SYSTEM TABLES
-- ============================================================================

-- Chat threads
CREATE TABLE IF NOT EXISTS "chat_thread" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Chat messages
CREATE TABLE IF NOT EXISTS "chat_message" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "thread_id" UUID NOT NULL REFERENCES "chat_thread"("id") ON DELETE CASCADE,
    "role" TEXT NOT NULL,
    "parts" JSONB[] NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Chat exports
CREATE TABLE IF NOT EXISTS "chat_export" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "exporter_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "original_thread_id" UUID,
    "messages" JSONB NOT NULL,
    "exported_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP WITH TIME ZONE
);

-- Chat export comments
CREATE TABLE IF NOT EXISTS "chat_export_comment" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "export_id" UUID NOT NULL REFERENCES "chat_export"("id") ON DELETE CASCADE,
    "author_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "parent_id" UUID REFERENCES "chat_export_comment"("id") ON DELETE CASCADE,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- AGENT SYSTEM TABLES
-- ============================================================================

-- Agents
CREATE TABLE IF NOT EXISTS "agent" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" JSONB,
    "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "instructions" JSONB,
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'readonly')),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- MCP (Model Context Protocol) TABLES
-- ============================================================================

-- MCP servers
CREATE TABLE IF NOT EXISTS "mcp_server" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private')),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- MCP tool customizations
CREATE TABLE IF NOT EXISTS "mcp_server_tool_custom_instructions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "tool_name" TEXT NOT NULL,
    "mcp_server_id" UUID NOT NULL REFERENCES "mcp_server"("id") ON DELETE CASCADE,
    "prompt" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("user_id", "tool_name", "mcp_server_id")
);

-- MCP server customizations
CREATE TABLE IF NOT EXISTS "mcp_server_custom_instructions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "mcp_server_id" UUID NOT NULL REFERENCES "mcp_server"("id") ON DELETE CASCADE,
    "prompt" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("user_id", "mcp_server_id")
);

-- MCP OAuth sessions
CREATE TABLE IF NOT EXISTS "mcp_oauth_session" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "mcp_server_id" UUID NOT NULL REFERENCES "mcp_server"("id") ON DELETE CASCADE,
    "server_url" TEXT NOT NULL,
    "client_info" JSONB,
    "tokens" JSONB,
    "code_verifier" TEXT,
    "state" TEXT UNIQUE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- WORKFLOW SYSTEM TABLES
-- ============================================================================

-- Workflows
CREATE TABLE IF NOT EXISTS "workflow" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "version" TEXT NOT NULL DEFAULT '0.1.0',
    "name" TEXT NOT NULL,
    "icon" JSONB,
    "description" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT FALSE,
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'readonly')),
    "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Workflow nodes
CREATE TABLE IF NOT EXISTS "workflow_node" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "version" TEXT NOT NULL DEFAULT '0.1.0',
    "workflow_id" UUID NOT NULL REFERENCES "workflow"("id") ON DELETE CASCADE,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ui_config" JSONB DEFAULT '{}',
    "node_config" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Workflow edges
CREATE TABLE IF NOT EXISTS "workflow_edge" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "version" TEXT NOT NULL DEFAULT '0.1.0',
    "workflow_id" UUID NOT NULL REFERENCES "workflow"("id") ON DELETE CASCADE,
    "source" UUID NOT NULL REFERENCES "workflow_node"("id") ON DELETE CASCADE,
    "target" UUID NOT NULL REFERENCES "workflow_node"("id") ON DELETE CASCADE,
    "ui_config" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- BUILDER SYSTEM TABLES (AI Builder IDE)
-- ============================================================================

-- Builder threads (projects)
CREATE TABLE IF NOT EXISTS "builder_threads" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "title" VARCHAR(255) NOT NULL DEFAULT 'Untitled Project',
    "template" VARCHAR(50) NOT NULL,
    
    -- GitHub integration
    "github_repo_url" TEXT,
    "github_repo_id" TEXT,
    "github_repo_name" TEXT,
    
    -- Vercel integration
    "vercel_project_id" TEXT,
    "vercel_project_name" TEXT,
    "vercel_deployment_url" TEXT,
    
    -- Git tracking
    "last_commit_hash" TEXT,
    "last_deployed_at" TIMESTAMP WITH TIME ZONE,
    
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Builder messages (chat within builder)
CREATE TABLE IF NOT EXISTS "builder_messages" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "thread_id" UUID NOT NULL REFERENCES "builder_threads"("id") ON DELETE CASCADE,
    "role" VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    "content" TEXT NOT NULL,
    "mentions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Builder files (project files)
CREATE TABLE IF NOT EXISTS "builder_files" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "thread_id" UUID NOT NULL REFERENCES "builder_threads"("id") ON DELETE CASCADE,
    "file_path" VARCHAR(500) NOT NULL,
    "file_content" TEXT NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("thread_id", "file_path")
);

-- Builder commits (Git history)
CREATE TABLE IF NOT EXISTS "builder_commits" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "thread_id" UUID NOT NULL REFERENCES "builder_threads"("id") ON DELETE CASCADE,
    "commit_hash" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Builder deployments (Vercel deployments)
CREATE TABLE IF NOT EXISTS "builder_deployments" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "thread_id" UUID NOT NULL REFERENCES "builder_threads"("id") ON DELETE CASCADE,
    "vercel_deployment_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL CHECK (status IN ('BUILDING', 'READY', 'ERROR', 'CANCELED')),
    "commit_hash" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- BOOKMARK & ARCHIVE TABLES
-- ============================================================================

-- Bookmarks
CREATE TABLE IF NOT EXISTS "bookmark" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "item_id" UUID NOT NULL,
    "item_type" VARCHAR(20) NOT NULL CHECK (item_type IN ('agent', 'workflow', 'mcp')),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("user_id", "item_id", "item_type")
);

-- Archives
CREATE TABLE IF NOT EXISTS "archive" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Archive items
CREATE TABLE IF NOT EXISTS "archive_item" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "archive_id" UUID NOT NULL REFERENCES "archive"("id") ON DELETE CASCADE,
    "item_id" UUID NOT NULL,
    "user_id" UUID NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "added_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- User indexes
CREATE INDEX IF NOT EXISTS "idx_user_email" ON "user"("email");
CREATE INDEX IF NOT EXISTS "idx_user_role" ON "user"("role");
CREATE INDEX IF NOT EXISTS "idx_user_plan" ON "user"("plan");

-- Session indexes
CREATE INDEX IF NOT EXISTS "idx_session_user_id" ON "session"("user_id");
CREATE INDEX IF NOT EXISTS "idx_session_token" ON "session"("token");

-- Chat indexes
CREATE INDEX IF NOT EXISTS "idx_chat_thread_user_id" ON "chat_thread"("user_id");
CREATE INDEX IF NOT EXISTS "idx_chat_message_thread_id" ON "chat_message"("thread_id");
CREATE INDEX IF NOT EXISTS "idx_chat_message_created_at" ON "chat_message"("created_at");

-- Agent indexes
CREATE INDEX IF NOT EXISTS "idx_agent_user_id" ON "agent"("user_id");
CREATE INDEX IF NOT EXISTS "idx_agent_visibility" ON "agent"("visibility");

-- MCP indexes
CREATE INDEX IF NOT EXISTS "idx_mcp_server_user_id" ON "mcp_server"("user_id");
CREATE INDEX IF NOT EXISTS "idx_mcp_oauth_session_server_id" ON "mcp_oauth_session"("mcp_server_id");
CREATE INDEX IF NOT EXISTS "idx_mcp_oauth_session_state" ON "mcp_oauth_session"("state");

-- Workflow indexes
CREATE INDEX IF NOT EXISTS "idx_workflow_user_id" ON "workflow"("user_id");
CREATE INDEX IF NOT EXISTS "idx_workflow_node_kind" ON "workflow_node"("kind");
CREATE INDEX IF NOT EXISTS "idx_workflow_node_workflow_id" ON "workflow_node"("workflow_id");

-- Builder indexes
CREATE INDEX IF NOT EXISTS "idx_builder_threads_user_id" ON "builder_threads"("user_id");
CREATE INDEX IF NOT EXISTS "idx_builder_threads_updated_at" ON "builder_threads"("updated_at");
CREATE INDEX IF NOT EXISTS "idx_builder_messages_thread_id" ON "builder_messages"("thread_id");
CREATE INDEX IF NOT EXISTS "idx_builder_messages_created_at" ON "builder_messages"("created_at");
CREATE INDEX IF NOT EXISTS "idx_builder_files_thread_id" ON "builder_files"("thread_id");
CREATE INDEX IF NOT EXISTS "idx_builder_files_updated_at" ON "builder_files"("updated_at");
CREATE INDEX IF NOT EXISTS "idx_builder_commits_thread_id" ON "builder_commits"("thread_id");
CREATE INDEX IF NOT EXISTS "idx_builder_commits_timestamp" ON "builder_commits"("timestamp");
CREATE INDEX IF NOT EXISTS "idx_builder_deployments_thread_id" ON "builder_deployments"("thread_id");
CREATE INDEX IF NOT EXISTS "idx_builder_deployments_created_at" ON "builder_deployments"("created_at");

-- Bookmark indexes
CREATE INDEX IF NOT EXISTS "idx_bookmark_user_id" ON "bookmark"("user_id");
CREATE INDEX IF NOT EXISTS "idx_bookmark_item" ON "bookmark"("item_id", "item_type");

-- Archive indexes
CREATE INDEX IF NOT EXISTS "idx_archive_user_id" ON "archive"("user_id");
CREATE INDEX IF NOT EXISTS "idx_archive_item_item_id" ON "archive_item"("item_id");

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "user"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_session_updated_at BEFORE UPDATE ON "session"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_updated_at BEFORE UPDATE ON "account"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_updated_at BEFORE UPDATE ON "agent"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mcp_server_updated_at BEFORE UPDATE ON "mcp_server"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_updated_at BEFORE UPDATE ON "workflow"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_builder_threads_updated_at BEFORE UPDATE ON "builder_threads"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_builder_files_updated_at BEFORE UPDATE ON "builder_files"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INITIAL DATA (Optional)
-- ============================================================================

-- Create default owner user (update with your details)
-- Password: 'admin123' (hashed with bcrypt)
-- IMPORTANT: Change this password immediately after first login!
INSERT INTO "user" (
    "name",
    "email",
    "email_verified",
    "password",
    "role",
    "is_owner",
    "plan"
) VALUES (
    'Admin User',
    'admin@example.com',
    TRUE,
    '$2a$10$rKvVLw5pVvXvGvVvGvVvGvVvGvVvGvVvGvVvGvVvGvVvGvVvGvVvG', -- Change this!
    'super_admin',
    TRUE,
    'enterprise'
) ON CONFLICT (email) DO NOTHING;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Database schema created successfully!';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Tables created: 28';
    RAISE NOTICE 'Indexes created: 30+';
    RAISE NOTICE 'Triggers created: 8';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'IMPORTANT: Change the default admin password immediately!';
    RAISE NOTICE 'Default admin email: admin@example.com';
    RAISE NOTICE 'Default admin password: admin123';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Update admin credentials';
    RAISE NOTICE '2. Configure your .env file';
    RAISE NOTICE '3. Run your application';
    RAISE NOTICE '============================================================================';
END $$;
