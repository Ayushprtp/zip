# GitHub App Setup Guide

## Why Use a GitHub App?

GitHub Apps are more secure and provide better control than personal access tokens:

- ✅ **Fine-grained permissions** - Only request what you need
- ✅ **Organization-wide** - Can be installed across multiple repos
- ✅ **Better rate limits** - Higher API rate limits
- ✅ **Audit trail** - Better tracking of actions
- ✅ **Revocable** - Users can revoke access anytime

## Step 1: Register Your GitHub App

### Go to GitHub App Creation Page

Visit: https://github.com/settings/apps/new

### Fill in the Required Information

#### Basic Information

**GitHub App name:**
```
AI Builder IDE
```

**Homepage URL:**
```
https://your-domain.com
```
(Use your actual domain or `http://localhost:3000` for development)

**Webhook URL:**
```
https://your-domain.com/api/github/webhook
```
(Optional - for receiving push notifications)

**Webhook secret:**
```
Generate a random secret (save this for later)
```

#### Permissions

Select these **Repository permissions**:

- **Contents**: Read and write
  - Allows reading and writing repository files
  
- **Metadata**: Read-only
  - Basic repository information
  
- **Commit statuses**: Read and write (optional)
  - For deployment status updates

- **Pull requests**: Read and write (optional)
  - If you want to create PRs

Select these **Account permissions**:

- **Email addresses**: Read-only
  - To get user email for Git commits

#### Where can this GitHub App be installed?

Choose:
- ✅ **Any account** (recommended for public use)
- OR **Only on this account** (for private/testing)

### Click "Create GitHub App"

## Step 2: Generate Private Key

After creating the app:

1. Scroll down to **Private keys** section
2. Click **Generate a private key**
3. Download the `.pem` file
4. **Save this file securely** - you'll need it for authentication

## Step 3: Note Your App Details

You'll need these values:

- **App ID**: Found at the top of your app settings page
- **Client ID**: Found in the "About" section
- **Client Secret**: Click "Generate a new client secret"
- **Private Key**: The `.pem` file you downloaded

## Step 4: Install the App

1. Go to your app's page
2. Click "Install App" in the left sidebar
3. Choose which account to install it on
4. Select repositories:
   - All repositories
   - OR Only select repositories

## Step 5: Configure Your Application

### Add to `.env` file:

```bash
# GitHub App Configuration
GITHUB_APP_ID=123456
GITHUB_APP_CLIENT_ID=Iv1.abc123def456
GITHUB_APP_CLIENT_SECRET=your_client_secret_here
GITHUB_APP_PRIVATE_KEY_PATH=./github-app-private-key.pem
# OR inline the private key (for production):
# GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"

# Webhook secret (if using webhooks)
GITHUB_WEBHOOK_SECRET=your_webhook_secret_here

# Your app URL
NEXT_PUBLIC_APP_URL=https://your-domain.com
GITHUB_APP_CALLBACK_URL=https://your-domain.com/api/github/callback
```

### Store the Private Key

**Option 1: File (Development)**
```bash
# Save the .pem file in your project root
cp ~/Downloads/your-app.2024-01-21.private-key.pem ./github-app-private-key.pem

# Add to .gitignore
echo "github-app-private-key.pem" >> .gitignore
```

**Option 2: Environment Variable (Production)**
```bash
# Convert to single line
GITHUB_APP_PRIVATE_KEY=$(cat github-app-private-key.pem | tr '\n' '\\n')

# Add to your hosting platform's environment variables
```

## Step 6: OAuth Flow

### User Authorization URL

When users click "Connect GitHub", redirect them to:

```
https://github.com/apps/YOUR_APP_NAME/installations/new
```

Or use the OAuth flow:

```
https://github.com/login/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_CALLBACK_URL
```

### Callback Handling

After user authorizes, GitHub redirects to your callback URL with a `code`:

```
https://your-domain.com/api/github/callback?code=abc123&installation_id=456789
```

Exchange the code for an access token in your API route.

## Step 7: Using the App

### Get Installation Access Token

```typescript
import { App } from "@octokit/app";

const app = new App({
  appId: process.env.GITHUB_APP_ID!,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
});

// Get installation access token
const installationId = 123456; // From user's installation
const { token } = await app.octokit.auth({
  type: "installation",
  installationId,
});

// Use token for API calls
const octokit = new Octokit({ auth: token });
```

## Complete Configuration Example

### For Development:

```env
# .env.local
GITHUB_APP_ID=123456
GITHUB_APP_CLIENT_ID=Iv1.abc123def456
GITHUB_APP_CLIENT_SECRET=abc123def456ghi789
GITHUB_APP_PRIVATE_KEY_PATH=./github-app-private-key.pem
GITHUB_WEBHOOK_SECRET=my_webhook_secret_123
NEXT_PUBLIC_APP_URL=http://localhost:3000
GITHUB_APP_CALLBACK_URL=http://localhost:3000/api/github/callback
```

### For Production (Vercel/Netlify):

```env
GITHUB_APP_ID=123456
GITHUB_APP_CLIENT_ID=Iv1.abc123def456
GITHUB_APP_CLIENT_SECRET=abc123def456ghi789
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=my_webhook_secret_123
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
GITHUB_APP_CALLBACK_URL=https://your-app.vercel.app/api/github/callback
```

## Testing Your Setup

1. **Test App Installation**
   ```bash
   curl https://api.github.com/app \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

2. **Test Installation Access**
   ```bash
   curl https://api.github.com/app/installations \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

3. **Test Repository Access**
   ```bash
   curl https://api.github.com/installation/repositories \
     -H "Authorization: token YOUR_INSTALLATION_TOKEN"
   ```

## Permissions Reference

### What Each Permission Allows:

**Contents (Read & Write)**
- Read repository files
- Create/update/delete files
- Create commits
- Push to branches

**Metadata (Read-only)**
- Repository information
- Branch information
- Collaborator information

**Commit Statuses (Read & Write)**
- Create deployment statuses
- Update commit statuses

**Pull Requests (Read & Write)**
- Create pull requests
- Update pull requests
- Merge pull requests

## Security Best Practices

1. **Never commit private keys** to version control
2. **Use environment variables** for all secrets
3. **Rotate secrets regularly**
4. **Use webhook secrets** to verify webhook payloads
5. **Implement rate limiting** in your API routes
6. **Validate all user input**
7. **Use HTTPS** in production

## Troubleshooting

### "Bad credentials" error
- Check your App ID is correct
- Verify private key is properly formatted
- Ensure installation ID is valid

### "Not Found" error
- Verify app is installed on the repository
- Check repository permissions
- Ensure user has access to the repository

### "Rate limit exceeded"
- GitHub Apps have higher limits than personal tokens
- Implement caching
- Use conditional requests with ETags

## Next Steps

1. Update your API routes to use GitHub App authentication
2. Implement the OAuth callback handler
3. Store installation IDs per user
4. Test the complete flow
5. Deploy to production

## Resources

- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [Octokit App Documentation](https://github.com/octokit/app.js)
- [GitHub API Reference](https://docs.github.com/en/rest)
- [Webhook Events](https://docs.github.com/en/webhooks)

## Support

If you encounter issues:
1. Check GitHub App settings
2. Verify environment variables
3. Review API logs
4. Check GitHub's status page
5. Consult the documentation above
