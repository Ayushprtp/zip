# GitHub App Quick Setup - Step by Step

## 🚀 Complete Setup in 10 Minutes

### Step 1: Create Your GitHub App (5 minutes)

1. **Go to GitHub App Creation**
   - Visit: https://github.com/settings/apps/new
   - Or: Settings → Developer settings → GitHub Apps → New GitHub App

2. **Fill in Basic Information**

   ```
   GitHub App name: AI Builder IDE
   Homepage URL: http://localhost:3000 (or your domain)
   Callback URL: http://localhost:3000/api/github/app/callback
   Webhook URL: http://localhost:3000/api/github/app/webhook (optional)
   Webhook secret: (generate a random string, save it)
   ```

3. **Set Permissions**

   **Repository permissions:**
   - Contents: Read and write ✅
   - Metadata: Read-only ✅
   - Commit statuses: Read and write (optional)

   **Account permissions:**
   - Email addresses: Read-only ✅

4. **Where can this app be installed?**
   - Select: "Any account" (for public use)

5. **Click "Create GitHub App"**

### Step 2: Generate Credentials (2 minutes)

1. **After creation, note these values:**
   - App ID: (shown at top of page)
   - Client ID: (in "About" section)

2. **Generate Client Secret:**
   - Click "Generate a new client secret"
   - Copy and save it immediately

3. **Generate Private Key:**
   - Scroll to "Private keys" section
   - Click "Generate a private key"
   - Download the `.pem` file
   - Save it securely

### Step 3: Configure Your App (2 minutes)

1. **Add to `.env` file:**

   ```bash
   # GitHub App Configuration
   GITHUB_APP_ID=123456
   GITHUB_APP_CLIENT_ID=Iv1.abc123def456
   GITHUB_APP_CLIENT_SECRET=your_client_secret_here
   GITHUB_WEBHOOK_SECRET=your_webhook_secret_here
   
   # Private key (choose one method):
   # Method 1: File path (for development)
   GITHUB_APP_PRIVATE_KEY_PATH=./github-app-private-key.pem
   
   # Method 2: Inline (for production)
   # GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
   
   # App URLs
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_GITHUB_APP_NAME=ai-builder-ide
   NEXT_PUBLIC_GITHUB_APP_CLIENT_ID=Iv1.abc123def456
   ```

2. **Save the private key file:**

   ```bash
   # Move downloaded file to project root
   mv ~/Downloads/your-app.*.private-key.pem ./github-app-private-key.pem
   
   # Add to .gitignore
   echo "github-app-private-key.pem" >> .gitignore
   ```

### Step 4: Install Dependencies (1 minute)

```bash
npm install @octokit/app @octokit/rest
```

### Step 5: Install the App (1 minute)

1. **Go to your app's page:**
   - https://github.com/settings/apps/YOUR_APP_NAME

2. **Click "Install App"** in left sidebar

3. **Choose where to install:**
   - Select your account or organization
   - Choose "All repositories" or "Only select repositories"
   - Click "Install"

### Step 6: Test the Integration (1 minute)

1. **Start your app:**
   ```bash
   npm run dev
   ```

2. **Open your builder:**
   ```
   http://localhost:3000/builder
   ```

3. **Click "Connect with GitHub App"**

4. **Authorize the app**

5. **You're connected!** 🎉

## 📋 Quick Reference

### Environment Variables Checklist

```bash
✅ GITHUB_APP_ID
✅ GITHUB_APP_CLIENT_ID
✅ GITHUB_APP_CLIENT_SECRET
✅ GITHUB_APP_PRIVATE_KEY_PATH or GITHUB_APP_PRIVATE_KEY
✅ GITHUB_WEBHOOK_SECRET (if using webhooks)
✅ NEXT_PUBLIC_APP_URL
✅ NEXT_PUBLIC_GITHUB_APP_NAME
✅ NEXT_PUBLIC_GITHUB_APP_CLIENT_ID
```

### Files Checklist

```bash
✅ github-app-private-key.pem (in project root)
✅ .gitignore (includes *.pem)
✅ .env (with all variables)
```

### API Routes Created

```bash
✅ /api/github/app/callback - OAuth callback
✅ /api/github/app/installations - List installations
✅ /api/github/app/webhook - Webhook handler
```

## 🔧 Troubleshooting

### "App not configured" error
- Check `NEXT_PUBLIC_GITHUB_APP_CLIENT_ID` is set
- Verify it's in `.env` file
- Restart your dev server

### "Authentication failed" error
- Verify Client ID and Client Secret are correct
- Check callback URL matches exactly
- Ensure app is installed on your account

### "Private key" error
- Check file path is correct
- Verify file permissions (should be readable)
- Try inline key method instead

### Can't see repositories
- Ensure app is installed
- Check app has "Contents" permission
- Verify installation includes the repositories

## 🎯 Next Steps

1. **Test creating a repository**
2. **Test pushing code**
3. **Set up Vercel integration**
4. **Configure webhooks** (optional)
5. **Deploy to production**

## 📚 Additional Resources

- [Full Setup Guide](./GITHUB_APP_SETUP_GUIDE.md)
- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [Octokit Documentation](https://github.com/octokit/app.js)

## 🎉 Success!

You now have a GitHub App integrated with your AI Builder!

Users can:
- ✅ Connect via OAuth
- ✅ Access their repositories
- ✅ Create new repositories
- ✅ Push code to GitHub
- ✅ Manage multiple installations

All with fine-grained, secure permissions! 🚀
