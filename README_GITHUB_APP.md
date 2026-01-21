# 🚀 GitHub App Integration for AI Builder

## Overview

Your AI Builder now supports **GitHub Apps** for secure, professional OAuth-based authentication with fine-grained permissions.

## ✨ What's New

- ✅ **GitHub App OAuth** - Professional OAuth flow (no manual tokens!)
- ✅ **Fine-grained Permissions** - Only request what you need
- ✅ **Installation Management** - Support for organizations
- ✅ **Webhook Support** - Real-time event notifications
- ✅ **Dual Authentication** - Support both GitHub Apps and Personal Tokens

## 🎯 Quick Start (10 Minutes)

### 1. Create GitHub App

Visit: **https://github.com/settings/apps/new**

Fill in:
```
GitHub App name: AI Builder IDE
Homepage URL: http://localhost:3000
Callback URL: http://localhost:3000/api/github/app/callback
Webhook URL: http://localhost:3000/api/github/app/webhook (optional)
```

**Permissions:**
- Repository → Contents: Read and write ✅
- Repository → Metadata: Read-only ✅
- Account → Email addresses: Read-only ✅

**Where can this app be installed?**
- Select: "Any account"

Click **"Create GitHub App"**

### 2. Get Credentials

After creation:
1. Note your **App ID** (at top of page)
2. Note your **Client ID** (in "About" section)
3. Click **"Generate a new client secret"** → Copy it
4. Scroll to **"Private keys"** → Click **"Generate a private key"** → Download `.pem` file

### 3. Configure Environment

Add to `.env`:

```bash
# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_APP_CLIENT_ID=Iv1.abc123def456
GITHUB_APP_CLIENT_SECRET=your_client_secret_here
GITHUB_APP_PRIVATE_KEY_PATH=./github-app-private-key.pem
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# Public Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_GITHUB_APP_NAME=ai-builder-ide
NEXT_PUBLIC_GITHUB_APP_CLIENT_ID=Iv1.abc123def456
```

Save the private key:
```bash
mv ~/Downloads/your-app.*.private-key.pem ./github-app-private-key.pem
echo "github-app-private-key.pem" >> .gitignore
```

### 4. Install Dependencies

```bash
npm install @octokit/app @octokit/rest
```

### 5. Install the App

1. Go to: https://github.com/settings/apps/YOUR_APP_NAME
2. Click **"Install App"** in left sidebar
3. Choose your account
4. Select repositories (All or specific)
5. Click **"Install"**

### 6. Start Building

```bash
npm run dev
```

Open http://localhost:3000/builder and click **"Connect with GitHub App"**!

## 📚 Documentation

- **[Quick Setup (10 min)](./GITHUB_APP_QUICK_SETUP.md)** - Step-by-step setup
- **[Complete Guide](./GITHUB_APP_SETUP_GUIDE.md)** - Full documentation
- **[Implementation Summary](./GITHUB_APP_IMPLEMENTATION_SUMMARY.md)** - Technical details

## 🎨 Features

### GitHub App Benefits

**Security:**
- ✅ OAuth flow (no manual tokens)
- ✅ Fine-grained permissions
- ✅ Revocable access
- ✅ Audit trail

**User Experience:**
- ✅ One-click connection
- ✅ No token creation needed
- ✅ Organization support
- ✅ Installation management

**Technical:**
- ✅ Higher API rate limits
- ✅ Webhook support
- ✅ Better for production
- ✅ Compliance-friendly

### Dual Authentication

Users can choose:

**Option 1: GitHub App (Recommended)**
- Professional OAuth flow
- Fine-grained permissions
- Better for teams

**Option 2: Personal Access Token**
- Quick setup
- Good for personal use
- Backward compatible

## 💻 Usage

### In Your Builder

```tsx
import { GitHubAppConnectionPanel } from "@/components/builder/github-app-connection-panel";

export function BuilderPage() {
  return (
    <div>
      <GitHubAppConnectionPanel />
    </div>
  );
}
```

### Connect with GitHub App

```tsx
const connectWithGitHubApp = () => {
  const redirectUri = `${window.location.origin}/api/github/app/callback`;
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}`;
  window.location.href = authUrl;
};
```

### Get User Installations

```tsx
const loadInstallations = async () => {
  const res = await fetch("/api/github/app/installations");
  const data = await res.json();
  return data.installations;
};
```

### Load Repositories

```tsx
const loadRepos = async (installationId: string) => {
  const res = await fetch(`/api/github/repos?installation_id=${installationId}`);
  const data = await res.json();
  return data.repos;
};
```

## 🏗️ Architecture

```
User clicks "Connect with GitHub App"
    ↓
Redirect to GitHub OAuth
    ↓
User authorizes app
    ↓
GitHub redirects to callback
    ↓
Exchange code for token
    ↓
Store in httpOnly cookie
    ↓
Load installations
    ↓
Select installation
    ↓
Load repositories
    ↓
Create/Push to repos
```

## 🔐 Security

- **OAuth Flow** - Secure authorization
- **httpOnly Cookies** - XSS protection
- **Webhook Verification** - HMAC signatures
- **Fine-grained Permissions** - Minimal access
- **Revocable Access** - Users control access

## 📦 What Was Built

### New Files (8)

**Services:**
- `src/lib/builder/github-app-service.ts`

**API Routes:**
- `src/app/api/github/app/callback/route.ts`
- `src/app/api/github/app/installations/route.ts`
- `src/app/api/github/app/webhook/route.ts`

**UI Components:**
- `src/components/builder/github-app-connection-panel.tsx`

**Documentation:**
- `GITHUB_APP_SETUP_GUIDE.md`
- `GITHUB_APP_QUICK_SETUP.md`
- `GITHUB_APP_IMPLEMENTATION_SUMMARY.md`
- `README_GITHUB_APP.md` (this file)

## 🔧 Troubleshooting

### "App not configured"
- Check `NEXT_PUBLIC_GITHUB_APP_CLIENT_ID` is set
- Restart dev server

### "Authentication failed"
- Verify Client ID and Secret are correct
- Check callback URL matches exactly

### "Private key error"
- Check file path is correct
- Verify file permissions
- Try inline key method

### Can't see repositories
- Ensure app is installed
- Check app has "Contents" permission
- Verify installation includes repos

## ✅ Checklist

Setup:
- [ ] GitHub App created
- [ ] Credentials saved
- [ ] Environment configured
- [ ] Dependencies installed
- [ ] App installed on account

Testing:
- [ ] OAuth flow works
- [ ] Installations load
- [ ] Repositories load
- [ ] Can create repos
- [ ] Can push code

## 🎯 Benefits

### For Users
- No manual token creation
- Easy OAuth flow
- Better security
- Organization support

### For Developers
- Higher rate limits
- Webhook support
- Better audit trail
- Production-ready

### For Teams
- Organization-wide installation
- Centralized management
- Better permissions
- Compliance-friendly

## 📊 Comparison

| Feature | Personal Token | GitHub App |
|---------|---------------|------------|
| Setup | Manual token | OAuth flow |
| Security | Good | Better |
| Permissions | Broad | Fine-grained |
| Rate Limits | Standard | Higher |
| Organizations | Limited | Full support |
| Webhooks | No | Yes |
| Audit Trail | Basic | Detailed |
| Revocation | Manual | Easy |

## 🚀 Next Steps

1. **Create your GitHub App** (10 minutes)
2. **Configure environment** (2 minutes)
3. **Install the app** (1 minute)
4. **Test OAuth flow** (1 minute)
5. **Start building!** 🎉

## 📞 Support

- [Quick Setup](./GITHUB_APP_QUICK_SETUP.md)
- [Complete Guide](./GITHUB_APP_SETUP_GUIDE.md)
- [GitHub Apps Docs](https://docs.github.com/en/apps)
- [Octokit Docs](https://github.com/octokit/app.js)

## 🎉 Success!

Your AI Builder now has professional GitHub App integration with:
- ✅ Secure OAuth flow
- ✅ Fine-grained permissions
- ✅ Installation management
- ✅ Webhook support
- ✅ Production-ready

Ready to build with professional version control! 🚀
