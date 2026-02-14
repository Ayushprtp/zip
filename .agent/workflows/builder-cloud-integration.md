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
- "Create New Project" flow: name, framework, visibility, blank repo
- "Import Existing Repo" flow: list repos, select branch, connect
- **New Chat / History**: Support for multiple conversation threads per project.

### Phase 2b — Temporary Workspace & Auth Enhancements ✅
- **Temporary Workspace** (replaces "Skip for now"):
  - Creates a private repo under Flare-SH (or Ayushprtp) account
  - Auto-deletes after 16 hours via cleanup cron
  - Full features: deployment, source control, checkpoints, history
  - Danger banner with countdown timer in both BuilderPage and BuilderThreadPage
  - Prompt to "Connect GitHub to Keep" for permanent storage
- **GitHub App OAuth Popup**: Opens auth in popup instead of full-page redirect
- **Manual Token Entry**: Option to paste a personal access token instead of OAuth
- **Initial commits by Flare-SH App**: All repo initialization done by the GitHub App bot
- New files:
  - `src/lib/builder/temp-workspace-service.ts` — Creates/manages temp repos
  - `src/app/api/github/temp-repo/route.ts` — API to create temp workspace
  - `src/app/api/github/temp-repo/cleanup/route.ts` — Cron cleanup of expired repos
  - `scripts/get-installation-id.mjs` — Helper to detect the App installation ID

### Phase 3 — Backend Integration ✅
- `github-app-service.ts`: Backend service for GitHub App operations
- Server-side auth flow using installation access tokens
- API Routes for commit, branches, rollback

### Phase 4 — Vercel Deployment Integration ✅
- [x] Vercel token for temp workspace deployments via `VERCEL_TEMP_TOKEN` env var
- [x] Non-temp users: Vercel Connect popup (already existed)
- [x] Deploy route falls back to env token for temporary projects
- [x] `deployment-service.ts` passes `isTemporary` flag through the chain

### Phase 5 — AI Agent Features ✅
- [x] **Default model: GLM 4.7** (`glm-4.1v-9b-thinking`) — configurable via model selector toggle
- [x] **Auto-commit after AI chat completions** — automatically commits changed files after agent mode responses (already implemented in BuilderThreadPage lines 1032-1057)
- [x] **AI direct file modification** — Agent mode parses code blocks and applies file updates directly
- [x] **Deploy gate for temp workspaces** — temp projects use server-side Vercel token; non-temp users see Vercel Connect popup

### Remaining / Future Work
- [ ] AI terminal access (run commands via agent)
- [ ] Vercel OAuth popup flow (instead of just token paste)
- [ ] Set up a cron job for `/api/github/temp-repo/cleanup` route
- [ ] Install GitHub App on `Flare-SH` organization for dedicated temp workspace hosting

## Environment Variables

### GitHub App (Required):
```
GITHUB_APP_ID=<app id>
GITHUB_APP_CLIENT_ID=<client id>
GITHUB_APP_CLIENT_SECRET=<client secret>
GITHUB_APP_PRIVATE_KEY=<private key>
NEXT_PUBLIC_GITHUB_APP_NAME=<app name>
NEXT_PUBLIC_GITHUB_APP_CLIENT_ID=<client id>
```

### Temporary Workspace:
```
FLARE_ORG_INSTALLATION_ID=109978089  # Installation ID for Ayushprtp account
FLARE_TEMP_WORKSPACE_ORG=Ayushprtp    # Account that hosts temp repos
```

### Vercel Deployment:
```
VERCEL_TEMP_TOKEN=<your vercel token>  # Server-side token for temp workspace deployments
```

### Cleanup Security:
```
TEMP_WORKSPACE_CLEANUP_SECRET=<optional secret for cleanup cron>
```

## How to Get the Installation ID
Run: `node scripts/get-installation-id.mjs`
This will list all GitHub App installations and show the correct ID to use.

## Verification
- [x] GitHub App installed on Ayushprtp (ID: 109978089)
- [ ] Set `VERCEL_TEMP_TOKEN` in .env from https://vercel.com/account/tokens
- [ ] Test "Temporary Workspace" creates private repo under Ayushprtp
- [ ] Test "Deploy" on temp workspace uses server-side token
- [ ] Test model defaults to GLM 4.7 on new thread page
- [ ] Test auto-commit after agent chat completion
