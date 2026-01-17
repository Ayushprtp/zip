# Deployment Service Usage Guide

## Overview
The deployment service enables one-click deployment of AI-generated projects to Netlify or Vercel hosting platforms.

## Quick Start

### 1. Set Up Environment Variables

Create a `.env.local` file in the project root:

```bash
# Netlify API Token
NETLIFY_ACCESS_TOKEN=your_netlify_token_here

# Vercel API Token (optional, if using Vercel)
VERCEL_TOKEN=your_vercel_token_here
```

### 2. Get API Tokens

#### Netlify Token
1. Go to https://app.netlify.com/user/applications
2. Click "New access token"
3. Give it a name (e.g., "AI Builder IDE")
4. Copy the token and add to `.env.local`

#### Vercel Token
1. Go to https://vercel.com/account/tokens
2. Click "Create Token"
3. Give it a name and set expiration
4. Copy the token and add to `.env.local`

### 3. Deploy from BuilderPage

1. Open the AI Builder IDE
2. Create or edit a project
3. Click the "Deploy" button in the header
4. Wait for deployment to complete
5. Copy or open the deployment URL

## Using the DeploymentService Programmatically

### Basic Usage

```typescript
import { deploymentService } from '@/lib/builder/deployment-service';
import type { DeploymentConfig } from 'app-types/builder';

// Define your files
const files = {
  'src/App.tsx': 'export default function App() { return <div>Hello</div>; }',
  'package.json': '{ "name": "my-app", "version": "1.0.0" }',
  // ... more files
};

// Create deployment configuration
const config: DeploymentConfig = {
  platform: 'netlify',
  projectName: 'my-awesome-app',
  buildCommand: 'npm run build',
  outputDirectory: 'dist'
};

// Deploy with status updates
try {
  const result = await deploymentService.deploy(
    files,
    config,
    'vite-react',
    (status) => {
      console.log(`${status.status}: ${status.message} (${status.progress}%)`);
    }
  );
  
  console.log('Deployment successful!');
  console.log('URL:', result.url);
} catch (error) {
  console.error('Deployment failed:', error);
}
```

### With React Component

```typescript
import { useState } from 'react';
import { deploymentService, type DeploymentStatus } from '@/lib/builder/deployment-service';
import { DeploymentProgress } from '@/components/builder/deployment-progress';

function MyComponent() {
  const [deploying, setDeploying] = useState(false);
  const [status, setStatus] = useState<DeploymentStatus | null>(null);
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState<string>();

  const handleDeploy = async () => {
    setDeploying(true);
    
    try {
      const result = await deploymentService.deploy(
        files,
        config,
        template,
        (status) => setStatus(status)
      );
      
      setUrl(result.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <>
      <button onClick={handleDeploy} disabled={deploying}>
        Deploy
      </button>
      
      <DeploymentProgress
        open={deploying}
        onClose={() => setDeploying(false)}
        status={status}
        deploymentUrl={url}
        error={error}
      />
    </>
  );
}
```

## API Endpoints

### POST /api/builder/deploy

Initiates a deployment.

**Request:**
```json
{
  "package": {
    "files": {
      "src/App.tsx": "...",
      "package.json": "..."
    },
    "metadata": {
      "projectName": "my-app",
      "template": "vite-react",
      "timestamp": 1234567890,
      "buildCommand": "npm run build",
      "outputDirectory": "dist"
    }
  },
  "config": {
    "platform": "netlify",
    "projectName": "my-app",
    "buildCommand": "npm run build",
    "outputDirectory": "dist"
  }
}
```

**Response:**
```json
{
  "deploymentId": "abc123",
  "status": "building",
  "message": "Deployment initiated successfully"
}
```

### GET /api/builder/deploy/status

Checks deployment status.

**Query Parameters:**
- `deploymentId` (required): The deployment ID
- `platform` (optional): Platform name (netlify/vercel), defaults to netlify

**Response:**
```json
{
  "status": "ready",
  "url": "https://my-app.netlify.app",
  "logs": ["Build completed", "Deployment successful"],
  "error": null
}
```

## Template-Specific Configuration

### Vite React
```typescript
{
  buildCommand: 'npm run build',
  outputDirectory: 'dist'
}
```

### Next.js
```typescript
{
  buildCommand: 'npm run build',
  outputDirectory: '.next'
}
```

### Node.js
```typescript
{
  buildCommand: 'npm install',
  outputDirectory: '.'
}
```

### Static HTML
```typescript
{
  buildCommand: 'echo "No build needed"',
  outputDirectory: '.'
}
```

## Deployment Status Flow

1. **preparing** (10%) - Creating deployment package
2. **uploading** (30%) - Uploading files to platform
3. **building** (60%) - Building the project
4. **deploying** (80%) - Deploying to production
5. **success** (100%) - Deployment complete
6. **error** - Deployment failed

## Error Handling

### Common Errors

**"Netlify access token not configured"**
- Solution: Add `NETLIFY_ACCESS_TOKEN` to `.env.local`

**"Project name is required"**
- Solution: Provide a valid project name in the config

**"Deployment timeout"**
- Solution: Check platform dashboard for build logs
- The deployment may still complete on the platform

**"Failed to create Netlify site"**
- Solution: Check if project name is already taken
- Try a different project name

### Validation Errors

The service validates configuration before deployment:
- Project name must not be empty
- Build command must not be empty
- Output directory must not be empty
- Platform must be 'netlify' or 'vercel'

## Advanced Usage

### Custom Status Callback

```typescript
const result = await deploymentService.deploy(
  files,
  config,
  template,
  (status) => {
    // Custom handling for each status
    switch (status.status) {
      case 'preparing':
        console.log('📦 Preparing...');
        break;
      case 'uploading':
        console.log('⬆️ Uploading...');
        break;
      case 'building':
        console.log('🔨 Building...');
        break;
      case 'deploying':
        console.log('🚀 Deploying...');
        break;
      case 'success':
        console.log('✅ Success!');
        break;
      case 'error':
        console.error('❌ Error:', status.message);
        break;
    }
  }
);
```

### Validate Configuration Before Deployment

```typescript
import { deploymentService } from '@/lib/builder/deployment-service';

try {
  deploymentService.validateConfig(config);
  // Config is valid, proceed with deployment
} catch (error) {
  // Config is invalid, show error to user
  console.error('Invalid configuration:', error.message);
}
```

### Create Deployment Package Without Deploying

```typescript
const package = deploymentService.createDeploymentPackage(
  files,
  config,
  template
);

// Use package for other purposes
console.log('Package size:', JSON.stringify(package).length);
console.log('File count:', Object.keys(package.files).length);
```

## Troubleshooting

### Deployment Stuck at "Building"

1. Check platform dashboard for build logs
2. Verify build command is correct for your template
3. Check if all dependencies are in package.json
4. Ensure output directory matches your build tool

### Deployment URL Not Working

1. Wait a few minutes for DNS propagation
2. Check if deployment actually succeeded on platform
3. Verify the URL in platform dashboard
4. Try accessing via HTTPS

### Files Not Uploading

1. Check file size limits (Netlify: 100MB, Vercel: 100MB)
2. Verify all file paths are relative (no leading /)
3. Check for special characters in file names
4. Ensure files object is properly serialized

## Best Practices

1. **Project Naming:**
   - Use lowercase letters and hyphens
   - Avoid special characters
   - Keep names short and descriptive

2. **File Organization:**
   - Keep file structure clean
   - Remove unnecessary files before deployment
   - Ensure package.json has all dependencies

3. **Build Configuration:**
   - Test build locally before deploying
   - Use appropriate build command for template
   - Verify output directory is correct

4. **Error Handling:**
   - Always wrap deployment in try-catch
   - Show user-friendly error messages
   - Log errors for debugging

5. **Status Updates:**
   - Provide real-time feedback to users
   - Show progress indicators
   - Display final URL prominently

## Security Considerations

1. **API Tokens:**
   - Never commit tokens to version control
   - Use environment variables
   - Rotate tokens regularly
   - Use separate tokens for dev/prod

2. **File Validation:**
   - Validate file contents before deployment
   - Check for malicious code
   - Limit file sizes
   - Sanitize file names

3. **Rate Limiting:**
   - Implement rate limiting for deployments
   - Prevent abuse of deployment API
   - Monitor deployment frequency

## Performance Tips

1. **Minimize File Size:**
   - Remove source maps in production
   - Minify code before deployment
   - Compress assets

2. **Optimize Build:**
   - Use production build commands
   - Enable tree shaking
   - Remove unused dependencies

3. **Reduce Polling:**
   - Increase polling interval for long builds
   - Use webhooks if available
   - Cache deployment status

## Support

For issues or questions:
1. Check platform status pages (Netlify/Vercel)
2. Review platform documentation
3. Check deployment logs in platform dashboard
4. Contact platform support if needed

## Resources

- [Netlify API Documentation](https://docs.netlify.com/api/get-started/)
- [Vercel API Documentation](https://vercel.com/docs/rest-api)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vite Deployment](https://vitejs.dev/guide/static-deploy.html)
