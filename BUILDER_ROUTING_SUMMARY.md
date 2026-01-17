# Builder Routing Structure

## Routes

### 1. `/builder` (Main Entry Point)
**File**: `src/app/(chat)/builder/page.tsx`

**Behavior**:
- Checks if user is authenticated
- If user has existing builder threads, redirects to the most recent one: `/builder/[threadId]`
- If no threads exist, shows the BuilderPage component to create a new project

### 2. `/builder/[threadId]` (Individual Project)
**File**: `src/app/(chat)/builder/[threadId]/page.tsx`

**Behavior**:
- Displays the BuilderThreadPage component for a specific thread
- Each project has a unique thread ID (UUID)
- Loads the project's files, messages, and state from the database

## Flow

```
User visits /builder
    ↓
Check authentication
    ↓
Has existing threads?
    ↓ YES                    ↓ NO
Redirect to                Show BuilderPage
/builder/[mostRecentId]    (create new project)
    ↓                          ↓
BuilderThreadPage          User creates project
(existing project)              ↓
                           New thread created
                                ↓
                           Redirect to /builder/[newThreadId]
```

## Database Structure

Each builder project is stored as a thread with:
- **Thread ID**: Unique UUID for the project
- **User ID**: Owner of the project
- **Title**: Project name
- **Template**: Framework (react, nextjs, etc.)
- **Messages**: Chat history
- **Files**: Project files with content
- **Timestamps**: Created/updated dates

## Sidebar Integration

The `app-sidebar-builder-threads.tsx` component displays all user's builder projects in the sidebar, allowing quick navigation between projects by clicking on them to go to `/builder/[threadId]`.

## API Routes

All API routes follow the thread-based structure:
- `GET /api/builder/threads` - List all threads
- `POST /api/builder/threads` - Create new thread
- `GET /api/builder/threads/[threadId]` - Get thread details
- `PATCH /api/builder/threads/[threadId]` - Update thread
- `DELETE /api/builder/threads/[threadId]` - Delete thread
- `POST /api/builder/threads/[threadId]/messages` - Add message
- `POST /api/builder/threads/[threadId]/files` - Save file
- `DELETE /api/builder/threads/[threadId]/files` - Delete file

## Fixed Issues

1. ✅ Added `"use client"` directive to `error-boundary.tsx`
2. ✅ Added `"use client"` directive to `accessibility.tsx`
3. ✅ Fixed import paths in `/builder/page.tsx` (auth and db)
4. ✅ Routing structure already correct: `/builder/[threadId]`

## Summary

The routing is now properly set up with:
- Each project having a unique thread ID in the URL
- Automatic redirect to most recent project
- Database persistence for all project data
- Thread-based API routes for all operations
