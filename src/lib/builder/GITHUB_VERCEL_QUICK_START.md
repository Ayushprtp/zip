# GitHub & Vercel Integration - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites

1. GitHub account
2. Vercel account
3. GitHub Personal Access Token
4. Vercel API Token

### Step 1: Get Your Tokens

#### GitHub Token
1. Visit https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name it "AI Builder"
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
   - ✅ `user` (Read user profile data)
5. Click "Generate token"
6. **Copy the token** (you won't see it again!)

#### Vercel Token
1. Visit https://vercel.com/account/tokens
2. Click "Create Token"
3. Name it "AI Builder"
4. Click "Create"
5. **Copy the token**

### Step 2: Run Database Migration

```bash
npm run db:migrate
```

Or manually:

```bash
psql -d your_database -f drizzle/migrations/0002_github_vercel_integration.sql
```

### Step 3: Add Environment Variables (Optional)

For OAuth flow, add to `.env`:

```bash
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/github/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Step 4: Start Your App

```bash
npm run dev
```

### Step 5: Use the Integration

#### In Your Builder Component

```tsx
import { GitHubVercelIntegration } from "@/components/builder/github-vercel-integration";

export function BuilderPage() {
  return (
    <div>
      {/* Your existing builder UI */}
      
      {/* Add the integration panel */}
      <GitHubVercelIntegration />
    </div>
  );
}
```

### Step 6: Connect and Deploy

1. **Connect GitHub**
   - Click "GitHub" tab
   - Paste your GitHub token
   - Click "Connect GitHub"

2. **Create Repository**
   - Enter repository name
   - Add description (optional)
   - Click "Create Repository"

3. **Initialize Project**
   - Select your repository
   - Click "Initialize & Sync"
   - Your files are now on GitHub! 🎉

4. **Connect Vercel**
   - Click "Vercel" tab
   - Paste your Vercel token
   - Click "Connect Vercel"

5. **Deploy**
   - Project is automatically created
   - Linked to your GitHub repo
   - Click "Deploy Now"
   - Your site is live! 🚀

## 🎯 Common Use Cases

### Auto-Save to GitHub

```tsx
import { useGitHubIntegration } from "@/lib/builder/use-github-integration";
import { useProject } from "@/lib/builder/project-context";

function AutoSaveButton() {
  const { state } = useProject();
  const { syncToGitHub } = useGitHubIntegration();
  
  const handleSave = async () => {
    await syncToGitHub(
      state.files,
      "Auto-save: " + new Date().toISOString(),
      githubToken
    );
  };
  
  return <Button onClick={handleSave}>Save to GitHub</Button>;
}
```

### View Commit History

```tsx
import { GitHistorySidebar } from "@/components/builder/git-history-sidebar";
import { useGitHubIntegration } from "@/lib/builder/use-github-integration";

function HistoryPanel() {
  const { getCommitHistory, git } = useGitHubIntegration();
  
  return (
    <GitHistorySidebar
      onLoadHistory={getCommitHistory}
      onCheckout={(hash) => git.checkout(hash)}
      onReset={(hash) => git.resetHard(hash)}
    />
  );
}
```

### Trigger Deployment

```tsx
import { useVercelIntegration } from "@/lib/builder/use-vercel-integration";

function DeployButton({ projectId }: { projectId: string }) {
  const { triggerDeployment, loading } = useVercelIntegration();
  
  return (
    <Button 
      onClick={() => triggerDeployment(projectId)}
      disabled={loading}
    >
      {loading ? "Deploying..." : "Deploy Now"}
    </Button>
  );
}
```

### Check Git Status

```tsx
import { useGitHubIntegration } from "@/lib/builder/use-github-integration";

function GitStatus() {
  const { checkStatus } = useGitHubIntegration();
  const [status, setStatus] = useState(null);
  
  useEffect(() => {
    checkStatus().then(setStatus);
  }, []);
  
  return (
    <div>
      {status?.hasChanges && (
        <Badge>Uncommitted changes</Badge>
      )}
      <span>Branch: {status?.currentBranch}</span>
    </div>
  );
}
```

## 🔧 Troubleshooting

### "Not authenticated" error
- Make sure you've connected GitHub/Vercel
- Check that your token is valid
- Verify token has correct scopes

### Git push fails
- Ensure token has `repo` scope
- Check repository exists
- Verify you have write access

### Deployment fails
- Check build command is correct
- Verify framework is set properly
- Review Vercel deployment logs

### CORS errors
- Ensure `/api/git-proxy` is accessible
- Check proxy is forwarding correctly
- Verify authentication headers

## 📚 Learn More

- [Full Integration Guide](./GITHUB_VERCEL_INTEGRATION_GUIDE.md)
- [GitHub API Docs](https://docs.github.com/en/rest)
- [Vercel API Docs](https://vercel.com/docs/rest-api)
- [isomorphic-git Docs](https://isomorphic-git.org/)

## 🎉 You're Ready!

Your AI Builder now has:
- ✅ Version control with Git
- ✅ GitHub repository sync
- ✅ Automated Vercel deployments
- ✅ Commit history and rollback
- ✅ Professional workflow

Happy building! 🚀
