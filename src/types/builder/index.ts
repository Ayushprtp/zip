/**
 * Core type definitions for the AI Builder IDE
 */

// ============================================================================
// Virtual File System Types
// ============================================================================

export interface VirtualFile {
  path: string;
  content: string;
  language: string;
  lastModified: number;
  size: number;
}

export interface VirtualDirectory {
  path: string;
  children: string[];
  parent: string | null;
}

export interface VirtualFileSystem {
  files: Map<string, VirtualFile>;
  directories: Map<string, VirtualDirectory>;
}

// ============================================================================
// Template Types
// ============================================================================

export type TemplateType =
  | "react"
  | "vite-react"
  | "nextjs"
  | "vanilla"
  | "node"
  | "static"
  | "httpchain";

export interface TemplateConfig {
  entry: string;
  dependencies: Record<string, string>;
  devDependencies?: Record<string, string>;
  structure?: string[];
  runtime?: "node" | "static";
}

// ============================================================================
// Server Status Types
// ============================================================================

export type ServerStatus = "stopped" | "booting" | "running" | "error";

export interface ServerState {
  status: ServerStatus;
  port?: number;
  url?: string;
  startTime?: number;
  error?: RuntimeError;
}

// ============================================================================
// Checkpoint Types
// ============================================================================

export interface Checkpoint {
  id: string;
  timestamp: number;
  label: string;
  files: Record<string, string>;
  description?: string;
}

// ============================================================================
// Project State Types
// ============================================================================

export interface ProjectState {
  files: Record<string, string>;
  activeFile: string | null;
  template: TemplateType;
  serverStatus: ServerStatus;
  historyStack: Checkpoint[];
  currentCheckpointIndex: number;
  libraryPreference: LibraryType;
  consoleOutput: ConsoleLog[];
  mode: LayoutMode;
}

export interface ProjectActions {
  updateFile: (path: string, content: string) => void;
  createFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  createCheckpoint: (label: string) => void;
  restoreCheckpoint: (checkpointId: string) => void;
  setLibraryPreference: (library: LibraryType) => void;
  updateServerStatus: (status: ServerStatus) => void;
  setMode: (mode: LayoutMode) => void;
}

// ============================================================================
// Library Configuration Types
// ============================================================================

export type LibraryType = "shadcn" | "daisyui" | "material-ui" | "tailwind";

export interface FileTemplate {
  path: string;
  template: string;
}

export interface LibraryConfig {
  name: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  fileStructure: FileTemplate[];
  systemPromptAddition: string;
}

// ============================================================================
// Error Types
// ============================================================================

export interface RuntimeError {
  type: "fatal" | "warning" | "info";
  message: string;
  stack?: string;
  file?: string;
  line?: number;
  column?: number;
}

export interface FileSystemError {
  type: "FILE_NOT_FOUND" | "INVALID_PATH" | "PERMISSION_DENIED" | "UNKNOWN";
  path: string;
  message: string;
}

export interface APIError {
  status: number;
  message: string;
  request: () => Promise<any>;
}

export interface StateError {
  type: string;
  message: string;
  state?: any;
}

// ============================================================================
// Console Types
// ============================================================================

export interface ConsoleLog {
  id: string;
  level: "log" | "info" | "warn" | "error";
  message: string;
  timestamp: number;
  args?: any[];
}

// ============================================================================
// Chat Types
// ============================================================================

export interface ContextMention {
  type: "files" | "terminal" | "docs";
  data: any;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  mentions: ContextMention[];
  timestamp: number;
  metadata?: {
    model?: string;
    tokens?: number;
    duration?: number;
  };
}

export interface ChatThread {
  id: string;
  messages: ChatMessage[];
  projectId: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Diff Types
// ============================================================================

export interface DiffLine {
  type: "add" | "delete" | "context";
  content: string;
  lineNumber: number;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface FileDiff {
  path: string;
  type: "added" | "modified" | "deleted";
  oldContent?: string;
  newContent?: string;
  hunks: DiffHunk[];
}

// ============================================================================
// Deployment Types
// ============================================================================

export interface DeploymentConfig {
  platform: "netlify" | "vercel";
  projectName: string;
  buildCommand: string;
  outputDirectory: string;
}

export interface DeploymentResult {
  url: string;
  status: string;
  logs: string[];
}

// ============================================================================
// Editor Types
// ============================================================================

export interface EditorConfig {
  language: string;
  theme: "vs-dark" | "vs-light";
  options: {
    minimap: { enabled: boolean };
    fontSize: number;
    tabSize: number;
    automaticLayout: boolean;
    formatOnPaste: boolean;
    formatOnType: boolean;
  };
}

// ============================================================================
// Mode Types
// ============================================================================

export type LayoutMode = "chat" | "builder";

// ============================================================================
// Remote Development Types (re-exported)
// ============================================================================

export type {
  SSHConnectionConfig,
  SSHConnectionStatus,
  SSHSession,
  RemoteFileInfo,
  RemoteFileContent,
  RemoteCommandResult,
  RemoteSystemInfo,
  RemoteGitStatus,
  ExecutionContext,
  RemoteDevState,
  RemoteTerminalEntry,
  SafetyConfirmation,
  SSHApiAction,
  SSHApiRequest,
  SSHApiResponse,
} from "./remote";

export { DESTRUCTIVE_PATTERNS, REMOTE_PROJECT_TEMPLATES } from "./remote";
