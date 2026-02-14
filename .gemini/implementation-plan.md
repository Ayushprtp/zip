# Builder Page Redesign — Implementation Plan

## Overview
Redesign the `/builder` page GitHub setup flow with:
1. **Temporary Workspace** option (replaces "Skip for now") — auto-creates private repo in Flare-SH org, auto-deletes after 16 hours
2. **GitHub App OAuth** popup flow with manual token fallback
3. **Enhanced project creation** — framework + name + visibility in one step
4. **Auto-commit** after AI chat completions
5. **AI agent-style file access** with default GLM 4.7 model
6. **Deploy gate** — require GitHub auth before deploying

## Files to Modify
- `src/components/builder/github-project-setup.tsx` — Core redesign
- `src/components/builder/BuilderPage.tsx` — Handle temp workspace flow
- `src/app/api/github/temp-repo/route.ts` — New API: create temp repo
- `src/app/api/github/temp-repo/cleanup/route.ts` — New API: cleanup expired repos
- `src/lib/builder/temp-workspace-service.ts` — New service for temp repos

## Implementation Steps
1. Create temp workspace service
2. Create temp repo API routes
3. Redesign github-project-setup.tsx
4. Update BuilderPage.tsx for temp workspace handling
