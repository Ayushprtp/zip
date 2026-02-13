/**
 * Type definitions for Remote Development Integration
 * Covers SSH connections, remote file system, execution context, and safety
 */

// ============================================================================
// SSH Connection Types
// ============================================================================

export interface SSHConnectionConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "key";
  password?: string;
  privateKey?: string;
  passphrase?: string;
  // Advanced configuration
  jumpHost?: JumpHostConfig;
  identityFile?: string;
  preferredShell?: string;
  envVars?: Record<string, string>;
  keepAliveInterval?: number;
  readyTimeout?: number;
}

export interface JumpHostConfig {
  host: string;
  port: number;
  username: string;
  authMethod: "password" | "key";
  password?: string;
  privateKey?: string;
}

export type SSHConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "reconnecting";

export interface SSHSession {
  sessionId: string;
  connectionId: string;
  status: SSHConnectionStatus;
  connectedAt: number;
  lastActivityAt: number;
  host: string;
  username: string;
  port: number;
}

// ============================================================================
// Remote File System Types
// ============================================================================

export interface RemoteFileInfo {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  size: number;
  permissions: string;
  owner: string;
  group: string;
  modifiedAt: string;
  isHidden: boolean;
}

export interface RemoteDirectoryListing {
  path: string;
  entries: RemoteFileInfo[];
  totalSize: number;
  entryCount: number;
}

export interface RemoteFileContent {
  path: string;
  content: string;
  size: number;
  encoding: string;
  isBinary: boolean;
}

export interface RemoteFileWriteResult {
  path: string;
  success: boolean;
  bytesWritten: number;
}

export interface RemoteFileOperation {
  type:
    | "read"
    | "write"
    | "create"
    | "delete"
    | "move"
    | "copy"
    | "mkdir"
    | "chmod";
  sourcePath: string;
  destPath?: string;
  content?: string;
  permissions?: string;
  recursive?: boolean;
}

// ============================================================================
// Remote Execution Types
// ============================================================================

export interface RemoteCommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  cwd: string;
}

export interface RemoteExecOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
  shell?: string;
}

// ============================================================================
// Remote Environment Types
// ============================================================================

export interface RemoteSystemInfo {
  os: string;
  arch: string;
  hostname: string;
  kernel: string;
  uptime: string;
  shell: string;
  homeDir: string;
  nodeVersion?: string;
  pythonVersion?: string;
  gitVersion?: string;
  npmVersion?: string;
  diskUsage?: {
    total: string;
    used: string;
    available: string;
    percentage: string;
  };
}

export interface RemoteGitStatus {
  isRepo: boolean;
  branch?: string;
  ahead?: number;
  behind?: number;
  staged?: string[];
  modified?: string[];
  untracked?: string[];
  hasConflicts?: boolean;
}

// ============================================================================
// Execution Context Types
// ============================================================================

export type ExecutionContext = "sandbox" | "remote";

export interface RemoteDevState {
  // Connection
  connectionStatus: SSHConnectionStatus;
  activeSession: SSHSession | null;
  activeConnection: SSHConnectionConfig | null;

  // Execution context
  executionContext: ExecutionContext;
  preferRemote: boolean;

  // Remote filesystem
  workingDirectory: string;
  lastWorkingDirectory: string | null;
  directoryHistory: string[];
  remoteFiles: RemoteFileInfo[];
  fileTreeExpanded: Record<string, boolean>;

  // System info
  systemInfo: RemoteSystemInfo | null;
  gitStatus: RemoteGitStatus | null;

  // Terminal
  commandHistory: string[];
  terminalOutput: RemoteTerminalEntry[];

  // Health
  lastHeartbeat: number | null;
  connectionError: string | null;
  reconnectAttempts: number;

  // Safety
  pendingConfirmation: SafetyConfirmation | null;
}

export interface RemoteTerminalEntry {
  id: string;
  type: "input" | "output" | "error" | "system" | "warning";
  text: string;
  timestamp: number;
  cwd?: string;
  exitCode?: number;
}

// ============================================================================
// Safety & Confirmation Types
// ============================================================================

export interface SafetyConfirmation {
  id: string;
  command: string;
  reason: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  timestamp: number;
  details?: string;
}

export const DESTRUCTIVE_PATTERNS: Array<{
  pattern: RegExp;
  riskLevel: SafetyConfirmation["riskLevel"];
  reason: string;
}> = [
  {
    pattern: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+|--recursive\s+)/,
    riskLevel: "critical",
    reason: "Recursive file deletion can cause irreversible data loss",
  },
  {
    pattern: /\brm\s+-[a-zA-Z]*f/,
    riskLevel: "high",
    reason: "Force delete bypasses confirmation prompts",
  },
  {
    pattern: /\brm\b/,
    riskLevel: "medium",
    reason: "File deletion — files cannot be recovered without backups",
  },
  {
    pattern: /\brmdir\b/,
    riskLevel: "medium",
    reason: "Directory removal",
  },
  {
    pattern: /\bgit\s+(push\s+--force|push\s+-f|reset\s+--hard|clean\s+-fd)/,
    riskLevel: "critical",
    reason: "Destructive git operation — may cause permanent history loss",
  },
  {
    pattern: /\bgit\s+(checkout\s+--|reset|stash\s+drop|branch\s+-[dD])/,
    riskLevel: "high",
    reason: "Git operation that may discard uncommitted changes",
  },
  {
    pattern: /\b(npm|yarn|pnpm)\s+(uninstall|remove|prune)\b/,
    riskLevel: "medium",
    reason: "Package removal may break dependencies",
  },
  {
    pattern: /\bchmod\s+[0-7]{3,4}\b/,
    riskLevel: "low",
    reason: "Changing file permissions",
  },
  {
    pattern: /\bchown\b/,
    riskLevel: "medium",
    reason: "Changing file ownership",
  },
  {
    pattern: /\bdd\s+/,
    riskLevel: "critical",
    reason: "Low-level disk operation — risk of data overwrite",
  },
  {
    pattern: /\bmkfs\b|\bfdisk\b|\bparted\b/,
    riskLevel: "critical",
    reason: "Disk formatting/partitioning — EXTREME risk of data loss",
  },
  {
    pattern: />\s*\/dev\/sd|>\s*\/dev\/nvme/,
    riskLevel: "critical",
    reason: "Writing directly to disk device",
  },
  {
    pattern: /\bsudo\b/,
    riskLevel: "medium",
    reason: "Elevated privileges — command runs as root",
  },
  {
    pattern: /\bsystemctl\s+(stop|restart|disable)\b/,
    riskLevel: "high",
    reason: "Service management may affect running applications",
  },
  {
    pattern: /\b(kill|killall|pkill)\b/,
    riskLevel: "medium",
    reason: "Process termination",
  },
  {
    pattern: /\b(reboot|shutdown|halt|poweroff)\b/,
    riskLevel: "critical",
    reason: "System power operation",
  },
];

// ============================================================================
// Project Initialization Types
// ============================================================================

export type RemoteProjectTemplate =
  | "nextjs"
  | "vite-react"
  | "fastapi"
  | "express"
  | "laravel"
  | "django"
  | "flask"
  | "nuxt"
  | "sveltekit"
  | "empty";

export interface RemoteProjectInit {
  template: RemoteProjectTemplate;
  directory: string;
  name: string;
  options?: {
    typescript?: boolean;
    git?: boolean;
    packageManager?: "npm" | "yarn" | "pnpm" | "bun";
    installDeps?: boolean;
  };
}

export const REMOTE_PROJECT_TEMPLATES: Record<
  RemoteProjectTemplate,
  {
    name: string;
    description: string;
    command: string;
    requiredTools: string[];
  }
> = {
  nextjs: {
    name: "Next.js",
    description: "Full-stack React framework with App Router",
    command:
      "npx create-next-app@latest {name} --ts --tailwind --eslint --app --src-dir --import-alias '@/*' --no-turbopack",
    requiredTools: ["node", "npm"],
  },
  "vite-react": {
    name: "Vite + React",
    description: "Fast React development with Vite bundler",
    command: "npm create vite@latest {name} -- --template react-ts",
    requiredTools: ["node", "npm"],
  },
  fastapi: {
    name: "FastAPI",
    description: "Modern Python API framework",
    command:
      'mkdir -p {name} && cd {name} && python3 -m venv venv && source venv/bin/activate && pip install fastapi uvicorn && echo \'from fastapi import FastAPI\\napp = FastAPI()\\n\\n@app.get("/")\\ndef read_root():\\n    return {{"Hello": "World"}}\' > main.py',
    requiredTools: ["python3"],
  },
  express: {
    name: "Express.js",
    description: "Minimal Node.js web framework",
    command:
      'mkdir -p {name} && cd {name} && npm init -y && npm install express && echo \'const express = require("express");\\nconst app = express();\\napp.get("/", (req, res) => res.send("Hello World!"));\\napp.listen(3000, () => console.log("Server running on port 3000"));\' > index.js',
    requiredTools: ["node", "npm"],
  },
  laravel: {
    name: "Laravel",
    description: "PHP web application framework",
    command: "composer create-project laravel/laravel {name}",
    requiredTools: ["php", "composer"],
  },
  django: {
    name: "Django",
    description: "Python web framework for rapid development",
    command:
      "mkdir -p {name} && cd {name} && python3 -m venv venv && source venv/bin/activate && pip install django && django-admin startproject config .",
    requiredTools: ["python3"],
  },
  flask: {
    name: "Flask",
    description: "Lightweight Python WSGI web framework",
    command:
      'mkdir -p {name} && cd {name} && python3 -m venv venv && source venv/bin/activate && pip install flask && echo \'from flask import Flask\\napp = Flask(__name__)\\n\\n@app.route("/")\\ndef hello():\\n    return "Hello, World!"\' > app.py',
    requiredTools: ["python3"],
  },
  nuxt: {
    name: "Nuxt.js",
    description: "Vue.js meta-framework",
    command: "npx nuxi@latest init {name}",
    requiredTools: ["node", "npm"],
  },
  sveltekit: {
    name: "SvelteKit",
    description: "Full-stack Svelte framework",
    command: "npm create svelte@latest {name}",
    requiredTools: ["node", "npm"],
  },
  empty: {
    name: "Empty Project",
    description: "Just a directory with git init",
    command: "mkdir -p {name} && cd {name} && git init",
    requiredTools: [],
  },
};

// ============================================================================
// API Types
// ============================================================================

export type SSHApiAction =
  | "connect"
  | "disconnect"
  | "exec"
  | "test"
  | "heartbeat"
  | "list-files"
  | "read-file"
  | "write-file"
  | "delete-file"
  | "mkdir"
  | "move-file"
  | "copy-file"
  | "system-info"
  | "git-status"
  | "upload-file"
  | "init-project";

export interface SSHApiRequest {
  action: SSHApiAction;
  sessionId?: string;
  // Connection params
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  jumpHost?: JumpHostConfig;
  keepAliveInterval?: number;
  readyTimeout?: number;
  preferredShell?: string;
  envVars?: Record<string, string>;
  // Exec params
  command?: string;
  cwd?: string;
  timeout?: number;
  // File params
  path?: string;
  content?: string;
  destPath?: string;
  recursive?: boolean;
  permissions?: string;
  encoding?: string;
  // Project init params
  template?: RemoteProjectTemplate;
  projectName?: string;
}

export interface SSHApiResponse {
  success?: boolean;
  error?: string;
  sessionId?: string;
  connected?: boolean;
  // Exec results
  output?: string;
  stderr?: string;
  exitCode?: number;
  cwd?: string;
  // File results
  files?: RemoteFileInfo[];
  file?: RemoteFileContent;
  bytesWritten?: number;
  // System info
  systemInfo?: RemoteSystemInfo;
  gitStatus?: RemoteGitStatus;
  // General
  message?: string;
  data?: any;
}
