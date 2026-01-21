# GitHub & Vercel Integration - Architecture Diagram

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    React Components                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │   GitHub     │  │   Vercel     │  │     Git      │  │   │
│  │  │ Connection   │  │ Connection   │  │   History    │  │   │
│  │  │    Panel     │  │    Panel     │  │   Sidebar    │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  │  ┌──────────────┐  ┌──────────────────────────────────┐ │   │
│  │  │ Deployment   │  │  GitHubVercelIntegration         │ │   │
│  │  │  Dashboard   │  │  (Main Component)                │ │   │
│  │  └──────────────┘  └──────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     React Hooks                          │   │
│  │  ┌──────────────────────┐  ┌──────────────────────┐    │   │
│  │  │ useGitHubIntegration │  │ useVercelIntegration │    │   │
│  │  └──────────────────────┘  └──────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Core Services                         │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │   │
│  │  │ GitHub   │  │ Vercel   │  │   Git    │  │  Sync  │ │   │
│  │  │ Service  │  │ Service  │  │ Service  │  │Service │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Virtual File System (VFS)                   │   │
│  │                  (lightning-fs)                          │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │              IndexedDB Storage                    │   │   │
│  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐ │   │   │
│  │  │  │   Files    │  │    .git    │  │  Metadata  │ │   │   │
│  │  │  └────────────┘  └────────────┘  └────────────┘ │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                   │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (Next.js API)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      API Routes                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │ /api/github/ │  │ /api/vercel/ │  │/api/git-proxy│  │   │
│  │  │    auth      │  │    auth      │  │              │  │   │
│  │  │    repos     │  │   projects   │  │   (CORS)     │  │   │
│  │  │    user      │  │  deployments │  │              │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Token Management                        │   │
│  │              (httpOnly Cookies)                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              ↓                                   │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                      External Services                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐         ┌──────────────────────┐     │
│  │     GitHub API       │         │     Vercel API       │     │
│  │  ┌────────────────┐  │         │  ┌────────────────┐  │     │
│  │  │ Repositories   │  │         │  │   Projects     │  │     │
│  │  │ Commits        │  │         │  │  Deployments   │  │     │
│  │  │ Branches       │  │         │  │  Environment   │  │     │
│  │  │ Users          │  │         │  │   Variables    │  │     │
│  │  └────────────────┘  │         │  └────────────────┘  │     │
│  └──────────────────────┘         └──────────────────────┘     │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                               ↓
┌─────────────────────────────────────────────────────────────────┐
│                         Database                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ builder_threads  │  │ builder_commits  │  │   builder_   │  │
│  │                  │  │                  │  │ deployments  │  │
│  │ - github_repo_*  │  │ - commit_hash    │  │ - vercel_*   │  │
│  │ - vercel_*       │  │ - message        │  │ - url        │  │
│  │ - last_commit    │  │ - author         │  │ - status     │  │
│  └──────────────────┘  └──────────────────┘  └──────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow

### 1. User Edits File

```
User Types in Editor
    ↓
ProjectContext Updates
    ↓
VFS Writes to IndexedDB
    ↓
Git Detects Changes
```

### 2. Auto-Save Flow

```
GitSyncService Timer Triggers
    ↓
Check for Changes (git status)
    ↓
Stage Changes (git add .)
    ↓
Create Commit (git commit)
    ↓
Push to GitHub (git push via proxy)
    ↓
GitHub Webhook Triggers
    ↓
Vercel Detects Change
    ↓
Automatic Deployment
    ↓
Live URL Updated
```

### 3. Manual Sync Flow

```
User Clicks "Sync to GitHub"
    ↓
Collect Current Files
    ↓
Sync to VFS
    ↓
Git Add & Commit
    ↓
Push via CORS Proxy
    ↓
Update Database
    ↓
Show Success Message
```

### 4. Deployment Flow

```
User Clicks "Deploy Now"
    ↓
API Call to Vercel
    ↓
Vercel Creates Deployment
    ↓
Poll Deployment Status
    ↓
Update UI with Progress
    ↓
Deployment Complete
    ↓
Show Live URL
```

### 5. Rollback Flow

```
User Views Commit History
    ↓
Selects Previous Commit
    ↓
Git Checkout (Preview)
    ↓
User Confirms Rollback
    ↓
Git Reset Hard
    ↓
Update VFS
    ↓
Update Project Context
    ↓
Optionally Deploy
```

## 🔐 Security Flow

```
User Provides Token
    ↓
POST /api/github/auth or /api/vercel/auth
    ↓
Store in httpOnly Cookie
    ↓
Cookie Sent with Each Request
    ↓
Backend Validates Token
    ↓
Forward to External API
    ↓
Return Response
```

## 📦 Component Hierarchy

```
GitHubVercelIntegration (Main)
├── Tabs
│   ├── GitHub Tab
│   │   └── GitHubConnectionPanel
│   │       ├── Token Input
│   │       ├── Repository Selector
│   │       └── Create Repository Form
│   │
│   ├── Vercel Tab
│   │   └── VercelConnectionPanel
│   │       ├── Token Input
│   │       └── Project Selector
│   │
│   ├── History Tab
│   │   └── GitHistorySidebar
│   │       ├── Commit List
│   │       ├── Checkout Button
│   │       └── Reset Button
│   │
│   └── Deployments Tab
│       └── DeploymentDashboard
│           ├── Deployment List
│           ├── Status Badges
│           └── Deploy Button
│
└── Initialize & Sync Button
```

## 🗄️ Database Schema

```
builder_threads
├── id (UUID)
├── user_id (UUID) → users.id
├── title (VARCHAR)
├── template (VARCHAR)
├── github_repo_url (TEXT)
├── github_repo_id (TEXT)
├── github_repo_name (TEXT)
├── vercel_project_id (TEXT)
├── vercel_project_name (TEXT)
├── vercel_deployment_url (TEXT)
├── last_commit_hash (TEXT)
├── last_deployed_at (TIMESTAMP)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

builder_commits
├── id (UUID)
├── thread_id (UUID) → builder_threads.id
├── commit_hash (TEXT)
├── message (TEXT)
├── author (TEXT)
├── timestamp (TIMESTAMP)
└── created_at (TIMESTAMP)

builder_deployments
├── id (UUID)
├── thread_id (UUID) → builder_threads.id
├── vercel_deployment_id (TEXT)
├── url (TEXT)
├── status (VARCHAR)
├── commit_hash (TEXT)
└── created_at (TIMESTAMP)
```

## 🔌 API Endpoints

```
GitHub APIs
├── POST   /api/github/auth          - Store token
├── DELETE /api/github/auth          - Remove token
├── GET    /api/github/user          - Get user info
├── GET    /api/github/repos         - List repositories
└── POST   /api/github/repos         - Create repository

Vercel APIs
├── POST   /api/vercel/auth          - Store token
├── DELETE /api/vercel/auth          - Remove token
├── GET    /api/vercel/auth          - Check status
├── GET    /api/vercel/projects      - List projects
├── POST   /api/vercel/projects      - Create project
├── GET    /api/vercel/deployments   - List deployments
└── POST   /api/vercel/deployments   - Create deployment

Git Proxy
├── GET    /api/git-proxy?url=...    - Proxy GET requests
└── POST   /api/git-proxy?url=...    - Proxy POST requests
```

## 🎯 Service Dependencies

```
GitHubVercelIntegration
├── useGitHubIntegration
│   ├── VirtualFileSystemService
│   ├── GitService
│   └── GitSyncService
│
└── useVercelIntegration
    └── VercelService

GitService
└── VirtualFileSystemService

GitSyncService
├── GitService
└── VirtualFileSystemService

GitHubService
└── @octokit/rest

VercelService
└── fetch (native)
```

## 🚀 Deployment Pipeline

```
Code Change in Browser
    ↓
Auto-Save (60s interval)
    ↓
Git Commit (local)
    ↓
Git Push (via proxy)
    ↓
GitHub Repository Updated
    ↓
Vercel Webhook Triggered
    ↓
Vercel Build Starts
    ↓
Build Process
    ↓
Deployment Created
    ↓
DNS Updated
    ↓
Live URL Active
    ↓
Status Updated in UI
```

## 📊 State Management

```
ProjectContext (React Context)
├── files: Record<string, string>
├── activeFile: string | null
├── template: TemplateType
├── serverStatus: ServerStatus
├── historyStack: Checkpoint[]
├── currentCheckpointIndex: number
├── libraryPreference: LibraryType
├── consoleOutput: ConsoleLog[]
└── mode: LayoutMode

GitHubIntegration State
├── isConnected: boolean
├── user: GitHubUser | null
├── repos: GitHubRepo[]
├── loading: boolean
└── error: string | null

VercelIntegration State
├── isConnected: boolean
├── projects: VercelProject[]
├── deployments: VercelDeployment[]
├── loading: boolean
└── error: string | null
```

## 🎨 UI State Flow

```
Initial State
    ↓
User Connects GitHub
    ↓
Show Connected State
    ↓
Load Repositories
    ↓
User Selects/Creates Repo
    ↓
Enable Sync Button
    ↓
User Connects Vercel
    ↓
Show Connected State
    ↓
Load Projects
    ↓
User Clicks Initialize & Sync
    ↓
Show Loading State
    ↓
Initialize Git
    ↓
Create Vercel Project
    ↓
Link GitHub Repo
    ↓
Initial Commit & Push
    ↓
Trigger Deployment
    ↓
Show Success State
    ↓
Display Live URL
```

## 🔄 Sync Strategies

### Auto-Sync
```
Timer (60s)
    ↓
Check Changes
    ↓
If Changes → Commit
    ↓
If Auto-Push → Push
    ↓
Update Status
```

### Manual Sync
```
User Action
    ↓
Collect Files
    ↓
Sync to VFS
    ↓
Commit with Message
    ↓
Push to GitHub
    ↓
Update Database
```

### Conflict Resolution
```
Pull Detects Conflict
    ↓
Check Strategy
    ↓
├── "theirs" → Accept Remote
├── "ours" → Keep Local
└── "manual" → Show UI
```

## 🎉 Complete System

All components work together to provide a seamless, professional Web IDE experience with full version control and automated deployments!
