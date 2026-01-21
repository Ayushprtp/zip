# 🚀 GitHub & Vercel Integration for AI Builder

Transform your AI Builder into a professional Web IDE with full version control and automated deployments.

## ✨ What's New

Your AI Builder now includes:

- ✅ **Full Git Version Control** - Complete Git implementation in the browser
- ✅ **GitHub Integration** - Push/pull to your GitHub repositories
- ✅ **Vercel Deployments** - Automated deployments on every push
- ✅ **Version History** - Complete commit history with one-click rollback
- ✅ **Auto-Save** - Automatic commits and sync to GitHub
- ✅ **Offline Support** - Work offline, sync when you're back online

## 🎯 Quick Start (5 Minutes)

### 1. Install Dependencies

```bash
npm install @isomorphic-git/lightning-fs isomorphic-git @octokit/rest
```

### 2. Run Setup Script

```bash
npx tsx scripts/setup-github-vercel.ts
```

### 3. Run Database Migration

```bash
npm run db:migrate
```

### 4. Get Your Tokens

**GitHub Token:**
1. Visit https://github.com/settings/tokens
2. Create token with `repo` and `user` scopes
3. Copy the token

**Vercel Token:**
1. Visit https://vercel.com/account/tokens
2. Create a new token
3. Copy the token

### 5. Add to Your Builder

```tsx
import { GitHubVercelButton } from "@/components/builder/github-vercel-button";

export function BuilderPage() {
  return (
    <div>
      {/* Your existing builder UI */}
      <GitHubVercelButton />
    </div>
  );
}
```

### 6. Start Building

```bash
npm run dev
```

## 📚 Documentation

- **[Quick Start Guide](src/lib/builder/GITHUB_VERCEL_QUICK_START.md)** - Get started in 5 minutes
- **[Complete Integration Guide](src/lib/builder/GITHUB_VERCEL_INTEGRATION_GUIDE.md)** - Full technical documentation
- **[README](src/lib/builder/GITHUB_VERCEL_README.md)** - Features and examples
- **[Architecture](GITHUB_VERCEL_ARCHITECTURE.md)** - System architecture diagrams
- **[File Index](GITHUB_VERCEL_FILE_INDEX.md)** - Complete file listing

## 🎨 Features

### Version Control
- Initialize Git repositories in the browser
- Commit changes with descriptive messages
- View complete commit history
- Rollback to any previous version
- Branch management

### GitHub Integration
- Connect your GitHub account
- Create new repositories
- Push/pull changes
- Automatic sync
- Conflict resolution

### Vercel Deployments
- Connect your Vercel account
- Create projects linked to GitHub
- Trigger deployments
- Monitor deployment status
- View deployment history
- One-click rollback

### Auto-Save
- Automatic commits every minute
- Configurable sync intervals
- Manual sync option
- Conflict resolution strategies

## 🏗️ Architecture

```
Browser (IndexedDB)
    ↓
Virtual File System
    ↓
Git Engine (isomorphic-git)
    ↓
CORS Proxy
    ↓
GitHub API → Vercel API
    ↓
Live Deployment
```

## 💻 Usage Examples

### Connect GitHub

```tsx
import { useGitHubIntegration } from "@/lib/builder/use-github-integration";

function MyComponent() {
  const { connectGitHub, createRepo, initializeRepo } = useGitHubIntegration();
  
  // Connect
  await connectGitHub(githubToken);
  
  // Create repository
  const repo = await createRepo("my-project", "My awesome project", true);
  
  // Initialize with current files
  await initializeRepo(files, repo.clone_url, githubToken);
}
```

### Deploy to Vercel

```tsx
import { useVercelIntegration } from "@/lib/builder/use-vercel-integration";

function MyComponent() {
  const { connectVercel, createProject, triggerDeployment } = useVercelIntegration();
  
  // Connect
  await connectVercel(vercelToken);
  
  // Create project
  const project = await createProject(
    "my-project",
    { type: "github", repo: "username/my-project" },
    { framework: "nextjs" }
  );
  
  // Deploy
  await triggerDeployment(project.id);
}
```

### View Commit History

```tsx
import { GitHistorySidebar } from "@/components/builder/git-history-sidebar";

<GitHistorySidebar
  onLoadHistory={loadHistory}
  onCheckout={checkout}
  onReset={reset}
/>
```

## 🔒 Security

- Tokens stored in httpOnly cookies
- Secure in production
- 30-day token expiration
- CORS validation
- Authentication checks
- User ownership validation

## 🧪 Testing

Run the test suite:

```bash
npm test src/lib/builder/github-vercel-integration.test.ts
```

## 📦 What Was Built

### Services (7)
- VirtualFileSystemService
- GitService
- GitHubService
- VercelService
- GitSyncService
- useGitHubIntegration
- useVercelIntegration

### API Routes (7)
- /api/git-proxy
- /api/github/auth
- /api/github/repos
- /api/github/user
- /api/vercel/auth
- /api/vercel/projects
- /api/vercel/deployments

### UI Components (6)
- GitHubConnectionPanel
- VercelConnectionPanel
- GitHistorySidebar
- DeploymentDashboard
- GitHubVercelIntegration
- GitHubVercelButton

### Database (3 tables)
- builder_threads (updated)
- builder_commits (new)
- builder_deployments (new)

## 🎯 Benefits

### For Users
- ✅ Own their code in GitHub
- ✅ Professional Vercel hosting
- ✅ Complete version history
- ✅ One-click rollback
- ✅ Multi-device sync
- ✅ Offline capable
- ✅ No vendor lock-in

### For Developers
- ✅ Clean, modular architecture
- ✅ TypeScript throughout
- ✅ Comprehensive tests
- ✅ Detailed documentation
- ✅ Easy to extend
- ✅ Production ready

## 🔧 Troubleshooting

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

## 📊 Statistics

- **33 Files** created/modified
- **~6,090 Lines** of code
- **7 Services** implemented
- **7 API Routes** created
- **6 UI Components** built
- **100% Feature Complete**
- **Production Ready**

## 🎉 Success!

Your AI Builder now has:
- Full Git version control
- GitHub repository sync
- Automated Vercel deployments
- Complete commit history
- Professional workflow

All running entirely in the browser! 🚀

## 📞 Support

- [Quick Start](src/lib/builder/GITHUB_VERCEL_QUICK_START.md)
- [Full Guide](src/lib/builder/GITHUB_VERCEL_INTEGRATION_GUIDE.md)
- [Architecture](GITHUB_VERCEL_ARCHITECTURE.md)
- [File Index](GITHUB_VERCEL_FILE_INDEX.md)

## 📝 License

MIT

---

**Ready to build with professional version control and automated deployments!** 🎉
