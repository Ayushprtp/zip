---
description: Cloud Integration Hub — Builder page GitHub + Vercel + AI chat redesign
---

## Implementation Plan

### Phase 1 — Redesigned Chat Input Bar (Cursor-style) ✅
- New `ChatInputBar` with: file attach, image attach, model selector, mic button, send
- "Review Changes" floating button above input
- Glassmorphic bottom bar design
- **`@` Mentions System**: Context-aware mentions for files, folders, terminal, and conversations.
- **Model Selector**: Functional model toggling.

### Phase 2 — GitHub Project Setup Flow ✅
- On `/builder` page first load: prompt to link GitHub
- If already OAuth'd via GitHub signup → auto-connect
- "Create New Project" flow: name, framework, blank repo
- "Import Existing Repo" flow: list repos, select branch
- **New Chat / History**: Support for multiple conversation threads per project.

### Phase 3 — Backend Integration (The "Hard Part") ✅
- `github-app-service.ts`: Backend service for GitHub App operations (CRUD files, branches, commits)
- Server-side auth flow using installation access tokens (no user tokens on client)
- API Routes:
  - `/api/github/app/commit` (POST)
  - `/api/github/app/branches` (GET, POST)
  - `/api/github/app/rollback` (POST)
  - `/api/installations` & `/api/repos` updated to use App auth

### Phase 4 — Vercel Deployment Integration (In Progress)
- [ ] Vercel Project Linking
- [ ] Logic to trigger Vercel deployment from GitHub commit
- [ ] Poll deployment status
- [ ] Show deployment URL in Builder header

## Verification
- GitHub App installed on organization/user
- Verify `GITHUB_APP_PRIVATE_KEY` is set in `.env`
- Test "Commit & Push" flow — should appear as "Flare Builder AI" bot
- Test "Undo" flow — should revert commit on GitHub
