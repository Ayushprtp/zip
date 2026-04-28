/**
 * Core Type Definitions for the Agentic System
 * All types used across the agentic system are defined here.
 */

// ─── Status Types ────────────────────────────────────────────────────

export type AgentStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'killed';
export type ToolStatus = 'pending' | 'running' | 'completed' | 'failed';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'killed';
export type TaskType = 'agent' | 'skill' | 'shell' | 'background';
export type MCPConnectionStatus = 'connecting' | 'connected' | 'error' | 'disconnected';

// ─── Tool Types ──────────────────────────────────────────────────────

/** JSON Schema for tool input */
export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
}

/** Context passed to every tool execution. */
export interface ToolUseContext {
  /** The agent executing this tool */
  agentId?: string;
  /** The task this tool belongs to */
  taskId?: string;
  /** The active session ID */
  sessionId?: string;
  /** Working directory in the runtime environment */
  workDir: string;
  /** Parent agent ID (if this is a sub-agent) */
  parentAgentId?: string;
  /** Model to use for LLM calls within tools */
  model?: string;
  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
  /** API key for tools that invoke LLMs */
  apiKey?: string;
  /** API base URL for tools that invoke LLMs */
  apiBaseUrl?: string;
  /** Optional callback for persisting in-memory state across calls */
  persistState?: (key: string, value: unknown) => void;
  /** Optional callback for loading persisted in-memory state */
  loadState?: <T = unknown>(key: string) => T | undefined;
  /** Optional explicit permission policy for this tool execution */
  permissionPolicy?: PermissionPolicyConfig;
  /** Optional browser server endpoint for server/VPS-backed browser automation */
  browserServerUrl?: string;
  /** Optional auth token for browser server endpoint */
  browserServerApiKey?: string;
  /** Optional explicit preview base URLs used for browser scope enforcement */
  previewBaseUrls?: string[];
  /** Optional browser extension bridge session id for user-local browser execution */
  browserExtensionBridgeSessionId?: string;
  /** Optional browser extension display name used in bridge prompts */
  browserExtensionName?: string;
}

/** Result of a tool execution */
export interface ToolResult<T = any> {
  success: boolean;
  data: T;
  error?: string;
}

/** Progress callback for streaming tool output */
export type ToolCallProgress = (progress: {
  toolUseId: string;
  type: string;
  data: Record<string, any>;
}) => void;

/**
 * A fully-defined tool in the agentic system.
 * Tools are generic over their Input and Output types.
 */
export interface Tool<I = any, O = any> {
  /** Unique tool name */
  name: string;
  /** Human-readable display name */
  displayName: string;
  /** Description of what the tool does */
  description: string;
  /** JSON Schema for input validation */
  inputSchema: ToolInputSchema;
  /** Whether this tool only reads (no side effects) */
  isReadOnly: boolean;
  /** Whether multiple instances can run in parallel safely */
  isConcurrencySafe: boolean;
  /** Tool category for grouping */
  category: string;
  /** Keywords for tool search / discovery */
  searchHint?: string;
  /** Aliases for backwards compatibility */
  aliases?: string[];
  /** Execute the tool */
  execute(input: I, context: ToolUseContext, onProgress?: ToolCallProgress): Promise<ToolResult<O>>;
}

// ─── Permission / Policy Types ───────────────────────────────────────

/** Available permission modes for tool execution policy. */
export type PermissionMode = 'default' | 'plan' | 'acceptEdits' | 'dontAsk' | 'bypassPermissions';

/** Rule outcome for a matched permission rule. */
export type PermissionRuleEffect = 'allow' | 'deny' | 'ask';

/**
 * A single permission rule.
 * - toolName supports exact match or '*' wildcard patterns (e.g. "Bash", "mcp__github__*", "*").
 * - inputPattern is an optional regular expression matched against stringified input.
 */
export interface PermissionRule {
  id?: string;
  toolName: string;
  effect: PermissionRuleEffect;
  inputPattern?: string;
  description?: string;
  enabled?: boolean;
}

/** Complete policy configuration used during permission checks. */
export interface PermissionPolicyConfig {
  mode: PermissionMode;
  rules?: PermissionRule[];
}

/** Machine-readable reason for a permission decision. */
export type PermissionReasonCode =
  | 'NO_POLICY_CONFIGURED'
  | 'MODE_BYPASS_PERMISSIONS'
  | 'UNKNOWN_MODE'
  | 'RULE_PARSE_ERROR'
  | 'RULE_MATCH_ALLOW'
  | 'RULE_MATCH_DENY'
  | 'RULE_MATCH_ASK'
  | 'MODE_DEFAULT_READONLY_ALLOW'
  | 'MODE_DEFAULT_MUTATION_ASK'
  | 'MODE_PLAN_READONLY_ALLOW'
  | 'MODE_PLAN_SAFE_MUTATION_ALLOW'
  | 'MODE_PLAN_MUTATION_DENY'
  | 'MODE_ACCEPT_EDITS_ALLOW'
  | 'MODE_ACCEPT_EDITS_ASK'
  | 'MODE_DONT_ASK_ALLOW'
  | 'NO_MATCH_FALLBACK_DENY';

/** Permission decision returned by policy evaluation. */
export interface PermissionDecision {
  decision: PermissionRuleEffect;
  allowed: boolean;
  reasonCode: PermissionReasonCode;
  reason: string;
  matchedRuleId?: string;
}

// ─── Agent Types ─────────────────────────────────────────────────────

/** Defines a type of agent that can be spawned */
export interface AgentDefinition {
  /** Unique agent type identifier */
  agentType: string;
  /** Human-readable display name */
  displayName: string;
  /** Description of the agent's role */
  description: string;
  /** Emoji icon for UI */
  icon?: string;
  /** When should this agent be used */
  whenToUse: string;
  /** System prompt for the agent */
  systemPrompt: string;
  /** Which tools does this agent have access to */
  allowedTools?: string[];
  /** Maximum number of tool-use turns before the agent stops */
  maxTurns?: number;
}

/** Runtime state of an active agent */
export interface AgentState {
  id: string;
  agentType: string;
  displayName?: string;
  description: string;
  status: AgentStatus;
  startTime: number;
  endTime?: number;
  toolCalls: ToolCall[];
  result?: string;
  error?: string;
  icon?: string;
  totalTokens?: number;
  parentAgentId?: string;
}

/** A single tool call made by an agent */
export interface ToolCall {
  id: string;
  toolName: string;
  input: Record<string, any>;
  status: ToolStatus;
  output?: any;
  error?: string;
  startTime: number;
  endTime?: number;
}

// ─── Worker / Coordinator Types ──────────────────────────────────────

/** Result from a parallel worker agent */
export interface WorkerResult {
  agentId: string;
  agentType: string;
  description: string;
  status: AgentStatus;
  result?: string;
  error?: string;
  durationMs: number;
  totalTokens?: number;
}

/** Coordinator orchestration state */
export interface CoordinatorState {
  isActive: boolean;
  workers: Map<string, string>; // workerId -> status/task description
  completedResults: string[];
}

// ─── Skill Types ─────────────────────────────────────────────────────

/** A skill is a reusable prompt template invokable via / commands */
export interface SkillDefinition {
  /** Unique skill name (used as /name) */
  name: string;
  /** Human-readable description */
  description: string;
  /** When to use this skill */
  whenToUse?: string;
  /** Alternative names */
  aliases?: string[];
  /** Hint shown in the command palette */
  argumentHint?: string;
  /** Tools this skill's agent is allowed to use */
  allowedTools?: string[];
  /** Whether users can invoke this skill directly */
  userInvocable?: boolean;
  /** Override agent type (default: 'coder') */
  agentType?: string;
  /** Emoji icon */
  icon?: string;
  /** Static prompt template (used when getPrompt is not provided) */
  prompt?: string;
  /** Generate the prompt dynamically from user arguments */
  getPrompt?: (args: string) => string;
}

// ─── Task Types ──────────────────────────────────────────────────────

/** State of a tracked background task */
export interface TaskState {
  id: string;
  type: TaskType;
  status: TaskStatus;
  description: string;
  agentId?: string;
  startTime: number;
  endTime?: number;
  output: string[];
  notified: boolean;
  progress?: number;
}

// ─── MCP Types ───────────────────────────────────────────────────────

/** Configuration for connecting to an MCP server */
export interface MCPServerConfig {
  name: string;
  url: string;
  transport?: 'sse' | 'streamable-http';
  apiKey?: string;
  headers?: Record<string, string>;
  autoConnect?: boolean;
}

/** Runtime state of an MCP server connection */
export interface MCPServerState {
  config: MCPServerConfig;
  status: MCPConnectionStatus;
  tools: MCPToolDefinition[];
  resources: MCPResourceDefinition[];
  error?: string;
}

/** Tool exposed by an MCP server */
export interface MCPToolDefinition {
  /** Server name */
  serverName: string;
  /** Fully qualified name (mcp__server__tool) */
  name: string;
  /** Original tool name on the server */
  originalName: string;
  /** Tool description */
  description: string;
  /** Tool input schema */
  inputSchema: ToolInputSchema;
}

/** Resource exposed by an MCP server */
export interface MCPResourceDefinition {
  serverName: string;
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/** Normalized MCP error categories for transport/auth/schema failures */
export type MCPErrorKind = 'transport' | 'auth' | 'schema' | 'upstream' | 'unknown';

/** Stable error codes for MCP API and tool responses */
export type MCPErrorCode =
  | 'MCP_TRANSPORT_ERROR'
  | 'MCP_AUTH_ERROR'
  | 'MCP_SCHEMA_ERROR'
  | 'MCP_UPSTREAM_ERROR'
  | 'MCP_NOT_FOUND'
  | 'MCP_UNKNOWN_ERROR';

/** Standardized MCP error payload */
export interface MCPNormalizedError {
  code: MCPErrorCode;
  kind: MCPErrorKind;
  message: string;
  status?: number;
  retryable?: boolean;
  details?: unknown;
}

/** Standardized MCP operation result */
export interface MCPResult<T> {
  success: boolean;
  data: T | null;
  error?: MCPNormalizedError;
}

/** Resource read result from MCP servers */
export interface MCPResourceReadResult {
  serverName: string;
  uri: string;
  mimeType?: string;
  text?: string;
  contents?: unknown;
}
