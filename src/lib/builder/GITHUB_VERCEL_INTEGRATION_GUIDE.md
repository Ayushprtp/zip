# GitHub & Vercel Integration Guide

## Overview

The AI Builder now includes full GitHub and Vercel integration, transforming it into a professional Web IDE with version control and automated deployments.

## Architecture

### Components

1. **Virtual File System** (`virtual-fs-service.ts`)
   - In-browser file system using IndexedDB
   - Persistent storage across sessions
   - Syncs with project files

2. **Git Service** (`git-service.ts`)
   - Full Git implementation in JavaScript
   - Supports init, add, commit, push, pull
   - Branch management and history

3. **GitHub Service** (`github-service.ts`)
   - GitHub API integration
   - Repository management
   - OAuth authentication

4. **Vercel Service** (`vercel-service.ts`)
   - Vercel API integration
   - Project and deployment management
   - Environment variables

5. **Git Sync Service** (`git-sync-service.ts`)
   - Auto-save and sync
   - Conflict resolution
   - Manual sync operations

## Setup

### 1. Environment Variables

Add to your `.env` file:

```bash
# GitHub OAuth (optional, for OAuth flow)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/github/callback

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 2. Database Migration

Run the migration to add GitHub/Vercel columns:

```bash
npm run db:migrate
```

Or manually run:

```sql
-- See drizzle/migrations/0002_github_vercel_integration.sql
```

### 3. GitHub Personal Access Token

Users need to create a GitHub Personal Access Token:

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `user`
4. Copy the token

### 4. Vercel Token

Users need to create a Vercel token:

1. Go to https://vercel.com/account/tokens
2. Create a new token
3. Copy the token

## Usage

### Basic Workflow

```typescript
import { useGitHubIntegration } from "@/lib/builder/use-github-integration";
import { useVercelIntegration } from "@/lib/builder/use-vercel-integration";

function MyComponent() {
  const github = useGitHubIntegration();
  const vercel = useVercelIntegration();

  // 1. Connect GitHub
  await github.connectGitHub(token);

  // 2. Create or select repository
  const repo = await github.createRepo("my-project", "Description", true);

  // 3. Initialize and sync
  await github.initializeRepo(files, repo.clone_url, token);

  // 4. Connect Vercel
  await vercel.connectVercel(vercelToken);

  // 5. Create Vercel project
  const project = await vercel.createProject(
    "my-project",
    { type: "github", repo: repo.full_name },
    { framework: "nextjs" }
  );

  // 6. Deploy
  await vercel.triggerDeployment(project.id);
}
```

### Auto-Save and Sync

```typescript
import { GitSyncService } from "@/lib/builder/git-sync-service";

const syncService = new GitSyncService(git, vfs, {
  autoCommit: true,
  autoPush: false,
  commitInterval: 60000, // 1 minute
  conflictResolution: "manual",
});

// Start auto-sync
await syncService.startAutoSync(token);

// Stop auto-sync
syncService.stopAutoSync();

// Manual sync
await syncService.manualSync(files, "My commit message", token);
```

### Git History and Rollback

```typescript
// Get commit history
const commits = await github.getCommitHistory();

// Checkout a commit (preview)
await github.git.checkout(commitHash);

// Hard reset to a commit
await github.git.resetHard(commitHash);

// Get current status
const status = await github.checkStatus();
```

### Deployment Management

```typescript
// Load deployments
const deployments = await vercel.loadDeployments(projectId);

// Trigger new deployment
const deployment = await vercel.triggerDeployment(projectId);

// Check deployment status
const status = await vercel.getDeployment(deploymentId);

// Rollback (promote previous deployment)
await vercel.promoteDeployment(projectId, previousDeploymentId);
```

## API Routes

### GitHub

- `POST /api/github/auth` - Store GitHub token
- `DELETE /api/github/auth` - Remove GitHub token
- `GET /api/github/user` - Get authenticated user
- `GET /api/github/repos` - List repositories
- `POST /api/github/repos` - Create repository

### Vercel

- `POST /api/vercel/auth` - Store Vercel token
- `DELETE /api/vercel/auth` - Remove Vercel token
- `GET /api/vercel/auth` - Check token status
- `GET /api/vercel/projects` - List projects
- `POST /api/vercel/projects` - Create project
- `GET /api/vercel/deployments` - List deployments
- `POST /api/vercel/deployments` - Create deployment

### Git Proxy

- `GET /api/git-proxy?url=...` - Proxy Git requests
- `POST /api/git-proxy?url=...` - Proxy Git requests

## UI Components

### GitHubConnectionPanel

```tsx
import { GitHubConnectionPanel } from "@/components/builder/github-connection-panel";

<GitHubConnectionPanel />
```

### VercelConnectionPanel

```tsx
import { VercelConnectionPanel } from "@/components/builder/vercel-connection-panel";

<VercelConnectionPanel />
```

### GitHistorySidebar

```tsx
import { GitHistorySidebar } from "@/components/builder/git-history-sidebar";

<GitHistorySidebar
  onLoadHistory={loadHistory}
  onCheckout={checkout}
  onReset={reset}
/>
```

### DeploymentDashboard

```tsx
import { DeploymentDashboard } from "@/components/builder/deployment-dashboard";

<DeploymentDashboard
  projectId={projectId}
  onLoadDeployments={loadDeployments}
  onTriggerDeployment={triggerDeployment}
/>
```

### Full Integration

```tsx
import { GitHubVercelIntegration } from "@/components/builder/github-vercel-integration";

<GitHubVercelIntegration />
```

## Database Schema

### builder_threads

New columns:
- `github_repo_url` - GitHub repository URL
- `github_repo_id` - GitHub repository ID
- `github_repo_name` - Repository name
- `vercel_project_id` - Vercel project ID
- `vercel_project_name` - Vercel project name
- `vercel_deployment_url` - Latest deployment URL
- `last_commit_hash` - Latest commit hash
- `last_deployed_at` - Last deployment timestamp

### builder_commits

- `id` - UUID
- `thread_id` - Reference to builder_threads
- `commit_hash` - Git commit hash
- `message` - Commit message
- `author` - Commit author
- `timestamp` - Commit timestamp
- `created_at` - Record creation time

### builder_deployments

- `id` - UUID
- `thread_id` - Reference to builder_threads
- `vercel_deployment_id` - Vercel deployment ID
- `url` - Deployment URL
- `status` - Deployment status
- `commit_hash` - Associated commit
- `created_at` - Record creation time

## Security Considerations

1. **Token Storage**
   - Tokens stored in httpOnly cookies
   - Encrypted in production
   - Auto-expire after 30 days

2. **CORS Proxy**
   - Validates authentication
   - Rate limiting recommended
   - Logs all requests

3. **Repository Access**
   - Only user's own repositories
   - Validates ownership
   - Permission checks

## Troubleshooting

### Git Push Fails

- Check token has `repo` scope
- Verify repository exists
- Check network connectivity

### Vercel Deployment Fails

- Verify build command is correct
- Check environment variables
- Review deployment logs

### Merge Conflicts

- Use conflict resolution strategy
- Manual resolution available
- Can reset to previous state

## Best Practices

1. **Commit Messages**
   - Use descriptive messages
   - Follow conventional commits
   - Include context

2. **Branch Strategy**
   - Use main branch for production
   - Create feature branches
   - Merge via pull requests

3. **Deployment**
   - Test locally first
   - Review build logs
   - Monitor deployment status

4. **Rollback**
   - Keep deployment history
   - Test rollback process
   - Document rollback reasons

## Future Enhancements

- [ ] Pull request creation
- [ ] Branch protection rules
- [ ] Deployment previews
- [ ] Environment variable management
- [ ] Webhook integration
- [ ] CI/CD pipeline
- [ ] Multi-environment support
- [ ] Deployment analytics

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review API documentation
3. Check GitHub/Vercel status pages
4. Contact support
