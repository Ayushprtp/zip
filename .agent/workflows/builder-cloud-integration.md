---
description: Cloud Integration Hub — Builder page GitHub + Vercel + AI chat redesign
---

## Implementation Plan

### Phase 1 — Redesigned Chat Input Bar (Cursor-style) ✅
- New `ChatInputBar` with: file attach, image attach, model selector, mic button, send
- "Review Changes" floating button above input
- Glassmorphic bottom bar design

### Phase 2 — GitHub Project Setup Flow ✅
- On `/builder` page first load: prompt to link GitHub
- If already OAuth'd via GitHub signup → auto-connect
- "Create New Project" flow: name, framework, blank repo
- "Open Existing Repo" flow: list repos → create branch → connect

### Phase 3 — GitHub App Architecture ✅ (Updated)
**All repo operations now go through the Flare-SH GitHub App, not the user's personal token.**

#### Architecture:
```
Client → POST /api/github/app/commit → Server → GitHub App JWT → Installation Token → GitHub API
```

#### Server-side files:
- `src/lib/builder/github-app-service.ts` — Full GitHub App service with commitFiles, createBranch, resetBranch, etc.
- `src/lib/builder/github-app-singleton.ts` — Singleton + auth helpers (getGitHubApp, requireGitHubAuth)

#### API Routes (all use installation access tokens):
- `POST /api/github/app/commit` — Commit files atomically to a branch
- `GET/POST /api/github/app/branches` — List/create branches
- `POST /api/github/app/rollback` — Force-reset branch to a commit SHA
- `GET /api/github/app/installations` — List user's app installations
- `GET/POST /api/github/repos` — List/create repos via installation

#### Client-side:
- `src/lib/builder/git-auto-commit.ts` — Auto-commit hook calls server API (no tokens on client)
- `src/components/builder/checkpoint-history.tsx` — Checkpoint timeline with rollback

#### Auth Flow:
1. User installs Flare-SH GitHub App → OAuth callback stores `github_token` + `github_installation_id` in httpOnly cookies
2. Server reads cookies, generates JWT from app private key → gets installation access token
3. All commits are authored by "Flare Builder AI <ai@flare.sh>"

#### Environment Variables Required:
- `GITHUB_APP_ID`
- `GITHUB_APP_PRIVATE_KEY` (PEM or base64-encoded)
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`

### Phase 4 — Vercel Deploy Integration
- "Ship It" button in header → deploy to user's Vercel account
- Stream deploy status in console

### Phase 5 — Builder AI enhancements
- Command execution in sandbox
- Image attachment support
- GitHub Issues + PR management
