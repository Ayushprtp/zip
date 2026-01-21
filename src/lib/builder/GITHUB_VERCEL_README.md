# GitHub & Vercel Integration

Transform your AI Builder into a professional Web IDE with full version control and automated deployments.

## 🌟 Features

- ✅ **In-Browser Git** - Full Git implementation using isomorphic-git
- ✅ **GitHub Integration** - Push/pull to GitHub repositories
- ✅ **Vercel Deployments** - Automated deployments on push
- ✅ **Version History** - Complete commit history and rollback
- ✅ **Auto-Save** - Automatic commits and sync
- ✅ **Conflict Resolution** - Handle merge conflicts gracefully
- ✅ **Branch Management** - Create and switch branches
- ✅ **Deployment Dashboard** - Monitor deployment status
- ✅ **Offline Support** - Work offline, sync when online

## 📦 Installation

Dependencies are already installed:

```json
{
  "@isomorphic-git/lightning-fs": "^4.6.0",
  "isomorphic-git": "^1.25.0",
  "@octokit/rest": "^20.0.2"
}
```

## 🚀 Quick Start

### 1. Run Migration

```bash
npm run db:migrate
```

### 2. Get Tokens

- **GitHub**: https://github.com/settings/tokens (scope: `repo`, `user`)
- **Vercel**: https://vercel.com/account/tokens

### 3. Add to Your Builder

```tsx
import { GitHubVercelButton } from "@/components/builder/github-vercel-button";

<GitHubVercelButton />
```

### 4. Connect and Deploy

1. Click "Pro Features" button
2. Connect GitHub with your token
3. Create or select repository
4. Connect Vercel with your token
5. Click "Initialize & Sync"
6. Your project is live! 🎉

## 📚 Documentation

- [Quick Start Guide](./GITHUB_VERCEL_QUICK_START.md) - Get started in 5 minutes
- [Integration Guide](./GITHUB_VERCEL_INTEGRATION_GUIDE.md) - Complete documentation
- [Implementation Summary](../../../GITHUB_VERCEL_INTEGRATION_COMPLETE.md) - What was built

## 🏗️ Architecture

```
Browser (IndexedDB)
  ↓
Virtual File System
  ↓
Git Engine (isomorphic-git)
  ↓
CORS Proxy (/api/git-proxy)
  ↓
GitHub API
  ↓
Vercel API
  ↓
Live Deployment
```

## 🔧 Services

### VirtualFileSystemService
Manages in-browser file system using IndexedDB.

```typescript
const vfs = new VirtualFileSystemService();
await vfs.initialize();
await vfs.writeFile("/index.js", "console.log('hello')");
const content = await vfs.readFile("/index.js");
```

### GitService
Full Git operations in the browser.

```typescript
const git = new GitService(vfs);
await git.init({ name: "User", email: "user@example.com" });
await git.add(".");
await git.commit("Initial commit");
await git.push("origin", "main", token);
```

### GitHubService
GitHub API integration.

```typescript
const github = new GitHubService(token);
const repo = await github.createRepo({ name: "my-project" });
const repos = await github.listRepos();
```

### VercelService
Vercel API integration.

```typescript
const vercel = new VercelService(token);
const project = await vercel.createProject({ name: "my-project" });
const deployment = await vercel.createDeployment(project.id);
```

### GitSyncService
Auto-save and sync management.

```typescript
const sync = new GitSyncService(git, vfs, {
  autoCommit: true,
  autoPush: false,
  commitInterval: 60000,
  conflictResolution: "manual",
});
await sync.startAutoSync(token);
```

## 🎨 Components

### GitHubConnectionPanel
GitHub authentication and repository management.

```tsx
<GitHubConnectionPanel />
```

### VercelConnectionPanel
Vercel authentication and project management.

```tsx
<VercelConnectionPanel />
```

### GitHistorySidebar
View commit history and rollback.

```tsx
<GitHistorySidebar
  onLoadHistory={loadHistory}
  onCheckout={checkout}
  onReset={reset}
/>
```

### DeploymentDashboard
Monitor and manage deployments.

```tsx
<DeploymentDashboard
  projectId={projectId}
  onLoadDeployments={loadDeployments}
  onTriggerDeployment={triggerDeployment}
/>
```

### GitHubVercelIntegration
Complete integration UI.

```tsx
<GitHubVercelIntegration />
```

### GitHubVercelButton
Quick access button.

```tsx
<GitHubVercelButton />
```

## 🪝 Hooks

### useGitHubIntegration

```typescript
const {
  isConnected,
  user,
  repos,
  loading,
  error,
  connectGitHub,
  disconnectGitHub,
  createRepo,
  initializeRepo,
  syncToGitHub,
  getCommitHistory,
  checkStatus,
} = useGitHubIntegration();
```

### useVercelIntegration

```typescript
const {
  isConnected,
  projects,
  deployments,
  loading,
  error,
  connectVercel,
  disconnectVercel,
  createProject,
  loadDeployments,
  triggerDeployment,
} = useVercelIntegration();
```

## 🔌 API Routes

### GitHub
- `POST /api/github/auth` - Store token
- `DELETE /api/github/auth` - Remove token
- `GET /api/github/user` - Get user
- `GET /api/github/repos` - List repos
- `POST /api/github/repos` - Create repo

### Vercel
- `POST /api/vercel/auth` - Store token
- `DELETE /api/vercel/auth` - Remove token
- `GET /api/vercel/auth` - Check status
- `GET /api/vercel/projects` - List projects
- `POST /api/vercel/projects` - Create project
- `GET /api/vercel/deployments` - List deployments
- `POST /api/vercel/deployments` - Create deployment

### Git Proxy
- `GET /api/git-proxy?url=...` - Proxy GET
- `POST /api/git-proxy?url=...` - Proxy POST

## 💾 Database Schema

### builder_threads (updated)
```sql
github_repo_url TEXT
github_repo_id TEXT
github_repo_name TEXT
vercel_project_id TEXT
vercel_project_name TEXT
vercel_deployment_url TEXT
last_commit_hash TEXT
last_deployed_at TIMESTAMP
```

### builder_commits (new)
```sql
id UUID PRIMARY KEY
thread_id UUID REFERENCES builder_threads
commit_hash TEXT
message TEXT
author TEXT
timestamp TIMESTAMP
created_at TIMESTAMP
```

### builder_deployments (new)
```sql
id UUID PRIMARY KEY
thread_id UUID REFERENCES builder_threads
vercel_deployment_id TEXT
url TEXT
status VARCHAR(20)
commit_hash TEXT
created_at TIMESTAMP
```

## 🔒 Security

- Tokens stored in httpOnly cookies
- Secure in production
- 30-day expiration
- CORS proxy validation
- Rate limiting ready
- User ownership checks

## 🧪 Testing

Run tests:

```bash
npm test src/lib/builder/github-vercel-integration.test.ts
```

## 🐛 Troubleshooting

### Git Push Fails
- Verify token has `repo` scope
- Check repository exists
- Ensure write access

### Vercel Deployment Fails
- Check build command
- Verify framework setting
- Review deployment logs

### CORS Errors
- Ensure proxy is running
- Check CORS headers
- Verify authentication

## 📖 Examples

### Complete Workflow

```typescript
// 1. Setup
const github = useGitHubIntegration();
const vercel = useVercelIntegration();
const { state } = useProject();

// 2. Connect GitHub
await github.connectGitHub(githubToken);

// 3. Create repo
const repo = await github.createRepo("my-app", "My awesome app", true);

// 4. Initialize
await github.initializeRepo(state.files, repo.clone_url, githubToken);

// 5. Connect Vercel
await vercel.connectVercel(vercelToken);

// 6. Create project
const project = await vercel.createProject(
  "my-app",
  { type: "github", repo: repo.full_name },
  { framework: "nextjs" }
);

// 7. Deploy
await vercel.triggerDeployment(project.id);

// 8. Monitor
const deployments = await vercel.loadDeployments(project.id);
```

### Auto-Save

```typescript
const sync = new GitSyncService(git, vfs, {
  autoCommit: true,
  autoPush: true,
  commitInterval: 60000, // 1 minute
  conflictResolution: "ours",
});

await sync.startAutoSync(token);
```

### Rollback

```typescript
// Get history
const commits = await github.getCommitHistory();

// Preview commit
await github.git.checkout(commits[5].oid);

// Confirm rollback
await github.git.resetHard(commits[5].oid);
```

## 🎯 Best Practices

1. **Commit Often** - Small, focused commits
2. **Descriptive Messages** - Clear commit messages
3. **Test Before Deploy** - Verify locally first
4. **Monitor Deployments** - Watch build logs
5. **Keep History** - Don't force push
6. **Use Branches** - Feature branches for development
7. **Review Changes** - Check diffs before commit
8. **Backup Important Work** - Multiple remotes

## 🚀 Performance

- Virtual FS uses IndexedDB for persistence
- Git operations are async and non-blocking
- CORS proxy caches responses
- Deployments are queued and processed
- Auto-sync is debounced

## 🌐 Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile: ✅ Works with limitations

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! Please read the integration guide first.

## 📞 Support

- [Documentation](./GITHUB_VERCEL_INTEGRATION_GUIDE.md)
- [Quick Start](./GITHUB_VERCEL_QUICK_START.md)
- [GitHub Issues](https://github.com/your-repo/issues)

## 🎉 Success!

You now have a professional Web IDE with:
- ✅ Full Git version control
- ✅ GitHub repository sync
- ✅ Automated Vercel deployments
- ✅ Complete commit history
- ✅ Professional workflow

Happy building! 🚀
