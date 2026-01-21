# GitHub & Vercel Integration Plan - Pro Features

## Overview
Transform the AI Builder into a fully automated Web IDE with GitHub repo management and Vercel deployments, treating the browser as a virtual computer.

## Architecture Components

### 1. Virtual Computer (In-Browser)
**Purpose**: Create a virtual file system and Git engine entirely in the browser

**Technologies**:
- `lightning-fs` - Virtual file system using IndexedDB
- `isomorphic-git` - Full Git implementation in JavaScript
- Browser IndexedDB for persistent storage

**Implementation**:
```
Browser Storage (IndexedDB)
  └── Virtual File System
      ├── /project/src/
      ├── /project/public/
      └── /.git/ (managed by isomorphic-git)
```

### 2. The Bridge (Backend)
**Purpose**: Handle authentication and CORS proxy for GitHub/Vercel APIs

**Components**:
- CORS Proxy for Git operations
- OAuth token management
- API request forwarding

**Endpoints Needed**:
- `/api/git-proxy` - Forward Git push/pull to GitHub
- `/api/github/auth` - OAuth handshake
- `/api/github/repos` - Repo creation/management
- `/api/vercel/deploy` - Deployment management

### 3. The Cloud (GitHub & Vercel)
**Purpose**: Remote storage and hosting

**Services**:
- GitHub: Version control and code storage
- Vercel: Automated deployments triggered by Git pushes

## Implementation Steps

### Step 1: Virtual Hard Drive Setup

**Install Dependencies**:
```bash
npm install lightning-fs isomorphic-git
```

**Create Virtual File System Service**:
- Initialize lightning-fs in browser
- Map builder files to VFS paths
- Sync VFS with ProjectContext
- Persist to IndexedDB

**File**: `src/lib/builder/virtual-fs-service.ts`

### Step 2: In-Browser Git Engine

**Git Operations to Support**:
- `git init` - Initialize repository
- `git add .` - Stage changes
- `git commit -m "message"` - Create commits
- `git push origin main` - Push to GitHub
- `git pull origin main` - Pull updates
- `git log` - View history
- `git checkout [hash]` - Rollback
- `git reset --hard` - Hard reset

**File**: `src/lib/builder/git-service.ts`

### Step 3: CORS Proxy Implementation

**Backend Proxy** (`src/app/api/git-proxy/route.ts`):
```
Browser → Your Proxy → GitHub
        ← Your Proxy ← GitHub
```

**Features**:
- Forward Git HTTP requests
- Add authentication headers
- Handle CORS headers
- Stream large payloads

### Step 4: GitHub OAuth & Repo Creation

**OAuth Flow**:
1. User clicks "Connect GitHub"
2. Redirect to GitHub OAuth
3. Request `repo` scope
4. Store access token securely
5. Use token for all GitHub API calls

**Automated Repo Creation**:
- API: `POST /user/repos`
- Payload: `{ name, description, private: true }`
- Response: Remote URL
- Action: `git remote add origin [URL]`

**Files**:
- `src/lib/builder/github-auth-service.ts`
- `src/lib/builder/github-repo-service.ts`

### Step 5: Save & Preserve Loop

**Auto-Save Flow**:
```
User edits file
  ↓
Save to VFS
  ↓
git add .
  ↓
git commit -m "Auto-save: [timestamp]"
  ↓
git push (through CORS proxy)
  ↓
GitHub receives update
  ↓
Vercel detects change
  ↓
Automatic deployment
```

**Conflict Resolution**:
- Run `git pull` before push
- Detect merge conflicts
- Show UI: "Theirs vs Yours"
- Let user resolve or auto-merge

**File**: `src/lib/builder/git-sync-service.ts`

### Step 6: Vercel Integration

**Setup Flow**:
1. User connects Vercel account (OAuth)
2. Create Vercel project via API
3. Link to GitHub repo
4. Configure build settings
5. Enable auto-deploy on push

**API Calls**:
- `POST /v9/projects` - Create project
- `GET /v6/deployments` - Check status
- `POST /v13/deployments` - Manual deploy
- `PATCH /v9/projects/:id/promote/:deploymentId` - Rollback

**Deployment Status**:
- Poll Vercel API every 5 seconds
- Show build progress
- Display live URL when ready
- Show deployment history

**File**: `src/lib/builder/vercel-service.ts`

### Step 7: Rollback System

**Version History UI**:
- Display `git log` output
- Show commit messages, timestamps, authors
- Preview file changes in each commit
- One-click restore

**Rollback Types**:

1. **Soft Rollback** (Preview):
   - `git checkout [hash] .`
   - Files change in VFS
   - User can test
   - Can commit or discard

2. **Hard Reset** (Permanent):
   - `git reset --hard [hash]`
   - Erases future history
   - Requires confirmation

3. **Vercel Rollback** (Instant):
   - Promote previous deployment
   - No code changes needed
   - Instant live update

**File**: `src/lib/builder/rollback-service.ts`

## UI Components Needed

### 1. GitHub Connection Panel
- OAuth login button
- Connected account display
- Repo selector/creator
- Sync status indicator

### 2. Git History Sidebar
- Commit timeline
- Diff viewer
- Rollback buttons
- Branch switcher

### 3. Deployment Dashboard
- Build status
- Live URL
- Deployment history
- Rollback controls
- Environment variables

### 4. Conflict Resolution Modal
- Side-by-side diff
- "Keep Theirs" / "Keep Mine" / "Merge" buttons
- Manual edit option

## Database Schema Updates

```sql
-- Add to builder_threads table
ALTER TABLE builder_threads ADD COLUMN github_repo_url TEXT;
ALTER TABLE builder_threads ADD COLUMN github_repo_id TEXT;
ALTER TABLE builder_threads ADD COLUMN vercel_project_id TEXT;
ALTER TABLE builder_threads ADD COLUMN vercel_deployment_url TEXT;
ALTER TABLE builder_threads ADD COLUMN last_commit_hash TEXT;
ALTER TABLE builder_threads ADD COLUMN last_deployed_at TIMESTAMP;

-- New table for Git commits
CREATE TABLE builder_commits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES builder_threads(id) ON DELETE CASCADE,
  commit_hash TEXT NOT NULL,
  message TEXT NOT NULL,
  author TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- New table for deployments
CREATE TABLE builder_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES builder_threads(id) ON DELETE CASCADE,
  vercel_deployment_id TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL, -- building, ready, error
  commit_hash TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Security Considerations

1. **Token Storage**:
   - Store OAuth tokens encrypted
   - Use httpOnly cookies for sensitive data
   - Implement token refresh

2. **CORS Proxy**:
   - Validate user authentication
   - Rate limit requests
   - Log all proxy requests
   - Whitelist allowed domains

3. **Repo Access**:
   - Only allow access to user's own repos
   - Validate repo ownership
   - Implement permission checks

## Implementation Priority

### Phase 1: Foundation (Week 1-2)
- [ ] Virtual File System setup
- [ ] Basic Git operations (init, add, commit)
- [ ] CORS proxy implementation
- [ ] GitHub OAuth integration

### Phase 2: Core Features (Week 3-4)
- [ ] Automated repo creation
- [ ] Push/Pull functionality
- [ ] Conflict resolution UI
- [ ] Git history viewer

### Phase 3: Deployment (Week 5-6)
- [ ] Vercel OAuth integration
- [ ] Project creation and linking
- [ ] Auto-deploy on push
- [ ] Deployment status tracking

### Phase 4: Advanced Features (Week 7-8)
- [ ] Rollback system
- [ ] Branch management
- [ ] Deployment history
- [ ] Environment variables UI

## Testing Strategy

1. **Unit Tests**:
   - Virtual FS operations
   - Git command execution
   - API proxy forwarding

2. **Integration Tests**:
   - Full push/pull cycle
   - Conflict resolution
   - Deployment pipeline

3. **E2E Tests**:
   - Complete user flow
   - OAuth handshakes
   - Multi-device sync

## Benefits of This Architecture

✅ **User Owns Data**: All code stored in user's GitHub
✅ **Professional Hosting**: Enterprise-grade Vercel deployments
✅ **Full Version Control**: Complete Git history and rollbacks
✅ **Multi-Device Sync**: Work from anywhere
✅ **Automatic Deployments**: Push to deploy workflow
✅ **No Vendor Lock-in**: Standard Git repos, portable
✅ **Offline Capable**: Work offline, sync when online

## Next Steps

1. Install required npm packages
2. Create virtual FS service
3. Implement isomorphic-git wrapper
4. Build CORS proxy endpoint
5. Add GitHub OAuth flow
6. Create repo management UI
7. Implement Vercel integration
8. Build rollback system
9. Add comprehensive testing
10. Deploy and monitor

This architecture transforms the AI Builder into a professional-grade IDE that rivals VS Code + GitHub + Vercel, all running in the browser!
