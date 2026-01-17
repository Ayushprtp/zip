# Builder Thread-Based System Implementation Plan

## Overview
Transform the AI Builder into a thread-based system similar to the main chat, with persistent history and file preservation.

## Phase 1: Header Integration ✅ (COMPLETED)
- [x] Created `BuilderHeader.tsx` component
- [x] Reuses same header style as main chat
- [x] Includes all icons except voice chat
- [x] Shows project name with dropdown
- [x] Includes temporary chat button
- [x] Includes all builder actions (QR, Mobile/Desktop, Download, Deploy)

## Phase 2: Database Schema (TODO)

### New Tables Needed:

```sql
-- Builder threads table
CREATE TABLE builder_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL DEFAULT 'Untitled Project',
  template VARCHAR(50) NOT NULL, -- 'react', 'nextjs', 'vite-react', 'vanilla', 'static'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Builder messages table
CREATE TABLE builder_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES builder_threads(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_thread FOREIGN KEY (thread_id) REFERENCES builder_threads(id)
);

-- Builder files table (stores file snapshots per thread)
CREATE TABLE builder_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID NOT NULL REFERENCES builder_threads(id) ON DELETE CASCADE,
  file_path VARCHAR(500) NOT NULL,
  file_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT fk_thread FOREIGN KEY (thread_id) REFERENCES builder_threads(id),
  UNIQUE(thread_id, file_path)
);

-- Indexes for performance
CREATE INDEX idx_builder_threads_user_id ON builder_threads(user_id);
CREATE INDEX idx_builder_messages_thread_id ON builder_messages(thread_id);
CREATE INDEX idx_builder_files_thread_id ON builder_files(thread_id);
```

## Phase 3: API Routes (TODO)

### Required API Endpoints:

```typescript
// GET /api/builder/threads - List all builder threads for user
// POST /api/builder/threads - Create new builder thread
// GET /api/builder/threads/[threadId] - Get thread details with messages and files
// PATCH /api/builder/threads/[threadId] - Update thread (title, template)
// DELETE /api/builder/threads/[threadId] - Delete thread

// POST /api/builder/threads/[threadId]/messages - Add message to thread
// GET /api/builder/threads/[threadId]/messages - Get all messages

// POST /api/builder/threads/[threadId]/files - Save/update file
// GET /api/builder/threads/[threadId]/files - Get all files
// DELETE /api/builder/threads/[threadId]/files/[fileId] - Delete file
```

## Phase 4: Routing Structure (TODO)

### Update Routes:

```
/builder - New builder (redirects to /builder/[newThreadId])
/builder/[threadId] - Specific builder thread
```

### Page Structure:

```typescript
// src/app/(chat)/builder/page.tsx
// Redirects to new thread

// src/app/(chat)/builder/[threadId]/page.tsx
// Main builder page with thread context
```

## Phase 5: State Management (TODO)

### Builder Store (Zustand):

```typescript
interface BuilderStore {
  threads: BuilderThread[];
  currentThreadId: string | null;
  currentThread: BuilderThread | null;
  messages: BuilderMessage[];
  files: Record<string, string>;
  template: Template;
  
  // Actions
  loadThreads: () => Promise<void>;
  createThread: (template: Template) => Promise<string>;
  loadThread: (threadId: string) => Promise<void>;
  updateThreadTitle: (threadId: string, title: string) => Promise<void>;
  addMessage: (threadId: string, message: BuilderMessage) => Promise<void>;
  saveFile: (threadId: string, path: string, content: string) => Promise<void>;
  deleteFile: (threadId: string, path: string) => Promise<void>;
}
```

## Phase 6: Sidebar Integration (TODO)

### Add Builder Threads to Sidebar:

Similar to `AppSidebarThreads`, create `AppSidebarBuilderThreads`:

```typescript
// src/components/layouts/app-sidebar-builder-threads.tsx
export function AppSidebarBuilderThreads() {
  const { threads, currentThreadId } = useBuilderStore();
  
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Builder Projects</SidebarGroupLabel>
      <SidebarGroupContent>
        {threads.map(thread => (
          <SidebarMenuItem key={thread.id}>
            <Link href={`/builder/${thread.id}`}>
              {thread.title}
            </Link>
          </SidebarMenuItem>
        ))}
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
```

## Phase 7: File Persistence Logic (TODO)

### Auto-save Files:

```typescript
// Debounced file save on every change
const debouncedSaveFile = useMemo(
  () => debounce((path: string, content: string) => {
    if (currentThreadId) {
      saveFile(currentThreadId, path, content);
    }
  }, 1000),
  [currentThreadId]
);

// In Sandpack file change handler
const handleFileChange = (path: string, content: string) => {
  debouncedSaveFile(path, content);
};
```

## Phase 8: Thread History UI (TODO)

### Thread Dropdown Component:

Similar to `ThreadDropdown` for chat, create `BuilderThreadDropdown`:

```typescript
// Shows:
// - Current project name
// - Rename option
// - Delete option
// - Duplicate option
// - Export option
```

## Phase 9: Migration Path (TODO)

### Steps to Implement:

1. **Database Migration**:
   - Run SQL migrations to create tables
   - Add indexes

2. **API Implementation**:
   - Create all API routes
   - Add authentication checks
   - Add error handling

3. **Store Implementation**:
   - Create Zustand store
   - Add persistence logic
   - Add optimistic updates

4. **UI Updates**:
   - Replace current BuilderPage with thread-aware version
   - Add BuilderHeader
   - Add thread dropdown
   - Add sidebar integration

5. **Testing**:
   - Test thread creation
   - Test file persistence
   - Test message history
   - Test thread switching

## Phase 10: Quick Implementation (IMMEDIATE)

For a faster implementation without full database integration:

### Use LocalStorage for Now:

```typescript
// src/lib/builder/local-storage-threads.ts
export const localThreads = {
  getThreads: () => {
    const threads = localStorage.getItem('builder_threads');
    return threads ? JSON.parse(threads) : [];
  },
  
  saveThread: (thread: BuilderThread) => {
    const threads = localThreads.getThreads();
    const index = threads.findIndex(t => t.id === thread.id);
    if (index >= 0) {
      threads[index] = thread;
    } else {
      threads.push(thread);
    }
    localStorage.setItem('builder_threads', JSON.stringify(threads));
  },
  
  getThread: (threadId: string) => {
    const threads = localThreads.getThreads();
    return threads.find(t => t.id === threadId);
  },
  
  deleteThread: (threadId: string) => {
    const threads = localThreads.getThreads();
    const filtered = threads.filter(t => t.id !== threadId);
    localStorage.setItem('builder_threads', JSON.stringify(filtered));
  }
};
```

## Summary

This is a comprehensive feature that requires:
- Database schema changes
- API route creation
- State management
- UI updates
- Routing changes

**Estimated Time**: 2-3 days for full implementation

**Quick Win**: Use localStorage approach for immediate functionality (4-6 hours)

Would you like me to:
1. Implement the localStorage version first (quick)?
2. Start with database schema and API routes (proper)?
3. Focus on specific parts first?
