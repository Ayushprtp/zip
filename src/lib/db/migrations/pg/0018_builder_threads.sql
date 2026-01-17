-- Builder Threads System Migration
-- This adds support for persistent builder projects with chat history and file storage

-- Builder threads table (projects)
CREATE TABLE IF NOT EXISTS builder_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL DEFAULT 'Untitled Project',
  template VARCHAR(50) NOT NULL CHECK (template IN ('react', 'nextjs', 'vite-react', 'vanilla', 'static')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT fk_builder_thread_user FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

-- Builder messages table (chat history)
CREATE TABLE IF NOT EXISTS builder_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  mentions JSONB DEFAULT '[]'::jsonb NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT fk_builder_message_thread FOREIGN KEY (thread_id) REFERENCES builder_threads(id) ON DELETE CASCADE
);

-- Builder files table (file snapshots per thread)
CREATE TABLE IF NOT EXISTS builder_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT fk_builder_file_thread FOREIGN KEY (thread_id) REFERENCES builder_threads(id) ON DELETE CASCADE,
  CONSTRAINT unique_thread_file UNIQUE(thread_id, file_path)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_builder_threads_user_id ON builder_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_builder_threads_updated_at ON builder_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_builder_messages_thread_id ON builder_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_builder_messages_created_at ON builder_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_builder_files_thread_id ON builder_files(thread_id);
CREATE INDEX IF NOT EXISTS idx_builder_files_updated_at ON builder_files(updated_at DESC);

-- Update trigger for builder_threads
CREATE OR REPLACE FUNCTION update_builder_thread_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_builder_thread_timestamp
BEFORE UPDATE ON builder_threads
FOR EACH ROW
EXECUTE FUNCTION update_builder_thread_timestamp();

-- Update trigger for builder_files
CREATE OR REPLACE FUNCTION update_builder_file_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_builder_file_timestamp
BEFORE UPDATE ON builder_files
FOR EACH ROW
EXECUTE FUNCTION update_builder_file_timestamp();
