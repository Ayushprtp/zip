import { initializeAgenticSystem } from "~/lib/agentic";
import { executeTool } from "~/lib/agentic/executor";
import { agenticRegistry } from "~/lib/agentic/registry";
import {
  getAgentContinuation,
  hasAgentContinuation,
  resumeAgentWithMessage,
  runAgent,
  type AgentProgressEvent,
} from "~/lib/agentic/agents/runner";
import { agentsStore } from "~/lib/agentic/stores";
import type {
  AgentState,
  PermissionPolicyConfig,
  TaskStatus,
  TaskType,
  ToolResult,
  ToolUseContext,
} from "~/lib/agentic/types";
import {
  appendRuntimeTaskOutput,
  abortRuntimeTask,
  clearRuntimeTaskAbortController,
  createRuntimeSession,
  createRuntimeTask,
  findRunningTaskByAgentId,
  getRuntimeSession,
  getRuntimeTask,
  getRuntimeSessionToolState,
  listRuntimeTasks,
  setRuntimeSessionToolState,
  setRuntimeTaskAbortController,
  type RuntimeTaskState,
} from "./session-state";
import {
  listRuntimeEvents,
  publishRuntimeEvent,
  type RuntimeEvent,
} from "./event-stream";

const DEFAULT_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_WORK_DIR = "/home/project";
const DEFAULT_API_BASE_URL = "https://api.flare-sh.tech/v1";

export interface RuntimeEnvironmentConfig {
  apiKey?: string;
  apiBaseUrl?: string;
  model?: string;
  workDir?: string;
  browserServerUrl?: string;
  browserServerApiKey?: string;
  previewBaseUrls?: string[];
  browserExtensionBridgeSessionId?: string;
  browserExtensionName?: string;
}

export interface RuntimeTaskOutput {
  taskId: string;
  status: TaskStatus | "not_found";
  output: string[];
  totalLines: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface SpawnAgentRequest {
  sessionId?: string;
  agentType: string;
  prompt: string;
  description?: string;
  model?: string;
  runInBackground?: boolean;
  parentAgentId?: string;
  workDir?: string;
  permissionPolicy?: PermissionPolicyConfig;
}

export interface ResumeAgentRequest {
  sessionId?: string;
  agentId: string;
  message: string;
  description?: string;
  runInBackground?: boolean;
  workDir?: string;
  model?: string;
  permissionPolicy?: PermissionPolicyConfig;
}

export interface ExecuteToolRequest {
  sessionId?: string;
  toolName: string;
  input?: Record<string, unknown>;
  description?: string;
  model?: string;
  runInBackground?: boolean;
  workDir?: string;
  parentAgentId?: string;
  permissionPolicy?: PermissionPolicyConfig;
}

export interface RuntimeExecutionResponse<T = unknown> {
  sessionId: string;
  queued: boolean;
  task: RuntimeTaskState;
  data?: T;
  error?: string;
}

export interface RuntimeAbortResult {
  success: boolean;
  task?: RuntimeTaskState;
  error?: string;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[unserializable output]";
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown runtime error";
}

function formatBrowserProgressLine(
  progressType: string,
  data: Record<string, unknown>,
): string | undefined {
  switch (progressType) {
    case "browser_scope_check_start": {
      const phase = typeof data.phase === "string" ? data.phase : "initial";
      const url = typeof data.url === "string" ? data.url : "unknown-url";
      return `Browser scope check (${phase}): ${url}`;
    }

    case "browser_scope_check_complete": {
      const phase = typeof data.phase === "string" ? data.phase : "initial";
      const url =
        typeof data.normalizedUrl === "string"
          ? data.normalizedUrl
          : "unknown-url";
      const allowedBy =
        typeof data.allowedBy === "string" ? data.allowedBy : "unknown";
      return `Browser scope allowed (${phase}): ${url} via ${allowedBy}`;
    }

    case "browser_approval_required": {
      const normalizedUrl =
        typeof data.normalizedUrl === "string"
          ? data.normalizedUrl
          : "unknown-url";
      return `Browser approval required: ${normalizedUrl}`;
    }

    case "browser_approval_resolved": {
      const normalizedUrl =
        typeof data.normalizedUrl === "string"
          ? data.normalizedUrl
          : "unknown-url";
      const decision =
        typeof data.decision === "string" ? data.decision : "unknown";
      return `Browser approval decision: ${decision} (${normalizedUrl})`;
    }

    case "browser_action_start": {
      const action = typeof data.action === "string" ? data.action : "unknown";
      const url =
        typeof data.normalizedUrl === "string"
          ? data.normalizedUrl
          : "unknown-url";
      return `Browser action started: ${action} ${url}`;
    }

    case "browser_server_request_start": {
      const action = typeof data.action === "string" ? data.action : "unknown";
      const endpoint =
        typeof data.endpoint === "string" ? data.endpoint : "unknown-endpoint";
      return `Browser server request: ${action} -> ${endpoint}`;
    }

    case "browser_server_response_received": {
      const action = typeof data.action === "string" ? data.action : "unknown";
      const status = Number.isFinite(data.status) ? Number(data.status) : 0;
      return `Browser server response: ${action} status ${status}`;
    }

    case "browser_request_start": {
      const url = typeof data.url === "string" ? data.url : "unknown-url";
      return `Browser request started: ${url}`;
    }

    case "browser_response_received": {
      const status = Number.isFinite(data.status) ? Number(data.status) : 0;
      const action = typeof data.action === "string" ? data.action : "navigate";
      const finalUrl =
        typeof data.finalUrl === "string" ? data.finalUrl : "unknown-url";
      return `Browser response received (${action}): ${status} ${finalUrl}`;
    }

    case "browser_extract_complete": {
      const action = typeof data.action === "string" ? data.action : "navigate";
      const charCount = Number.isFinite(data.charCount)
        ? Number(data.charCount)
        : 0;
      const truncated = Boolean(data.truncated);
      return `Browser extraction complete (${action}): ${charCount} chars${truncated ? " (truncated)" : ""}`;
    }

    case "browser_action_complete": {
      const action = typeof data.action === "string" ? data.action : "unknown";
      const status = Number.isFinite(data.status) ? Number(data.status) : 0;
      return `Browser action complete: ${action} (status ${status})`;
    }

    case "browser_error": {
      const phase = typeof data.phase === "string" ? data.phase : "unknown";
      const error =
        typeof data.error === "string" ? data.error : "Unknown browser error";
      return `Browser step failed (${phase}): ${error}`;
    }

    default:
      return undefined;
  }
}

function mapToolProgress(
  taskId: string,
  toolName: string,
  progress: {
    toolUseId: string;
    type: string;
    data: Record<string, unknown>;
  },
): void {
  const task = getRuntimeTask(taskId);

  if (!task) {
    return;
  }

  const data = progress.data || {};

  if (toolName === "browser") {
    const line = formatBrowserProgressLine(progress.type, data);

    if (line) {
      appendTaskLine(taskId, line);
    }
  }

  publishRuntimeEvent({
    type: "runtime:tool_progress",
    sessionId: task.sessionId,
    taskId,
    data: {
      toolName,
      progressType: progress.type,
      toolUseId: progress.toolUseId || "",
      progress: data,
    },
  });
}

function resolveSession(sessionId?: string): string {
  const requestedId = sessionId?.trim();
  const existed = requestedId ? Boolean(getRuntimeSession(requestedId)) : false;
  const session = createRuntimeSession(requestedId);

  if (!existed) {
    publishRuntimeEvent({
      type: "runtime:session_created",
      sessionId: session.id,
      data: {
        sessionId: session.id,
        createdAt: session.createdAt,
      },
    });
  }

  return session.id;
}

function createRuntimeToolStateAccess(
  sessionId: string,
): Pick<ToolUseContext, "persistState" | "loadState"> {
  return {
    persistState: (key: string, value: unknown) => {
      const normalizedKey = key.trim();

      if (!normalizedKey) {
        return;
      }

      setRuntimeSessionToolState(sessionId, normalizedKey, value);
    },
    loadState: <T = unknown>(key: string): T | undefined => {
      const normalizedKey = key.trim();

      if (!normalizedKey) {
        return undefined;
      }

      return getRuntimeSessionToolState<T>(sessionId, normalizedKey);
    },
  };
}

function appendTaskLine(taskId: string, line: string): void {
  appendRuntimeTaskOutput(taskId, line);
  const task = getRuntimeTask(taskId);

  if (!task) {
    return;
  }

  publishRuntimeEvent({
    type: "runtime:task_output",
    sessionId: task.sessionId,
    taskId,
    data: {
      line,
      status: task.status,
    },
  });
}

function setTaskStatus(
  taskId: string,
  status: TaskStatus,
  update?: Partial<RuntimeTaskState>,
): RuntimeTaskState | undefined {
  const task = getRuntimeTask(taskId);

  if (!task) {
    return undefined;
  }

  Object.assign(task, update ?? {});
  task.status = status;

  const next = getRuntimeTask(taskId);

  if (next) {
    publishRuntimeEvent({
      type: "runtime:task_updated",
      sessionId: next.sessionId,
      taskId: next.id,
      data: {
        status: next.status,
        error: next.error,
      },
    });
  }

  return next;
}

function updateTask(
  taskId: string,
  update: Partial<RuntimeTaskState>,
): RuntimeTaskState | undefined {
  const task = getRuntimeTask(taskId);

  if (!task) {
    return undefined;
  }

  Object.assign(task, update);

  publishRuntimeEvent({
    type: "runtime:task_updated",
    sessionId: task.sessionId,
    taskId: task.id,
    data: {
      status: task.status,
      error: task.error,
    },
  });

  return task;
}

function resolveApiConfig(
  config?: RuntimeEnvironmentConfig,
): RuntimeEnvironmentConfig {
  const env = typeof process !== "undefined" ? process.env : {};

  const apiKey =
    config?.apiKey ||
    env.OPENAI_API_KEY ||
    env.VITE_OPENAI_API_KEY ||
    env.ANTHROPIC_API_KEY;
  const apiBaseUrl =
    config?.apiBaseUrl || env.OPENAI_API_BASE_URL || DEFAULT_API_BASE_URL;

  const configuredPreviewBaseUrls =
    config?.previewBaseUrls ||
    env.BROWSER_PREVIEW_BASE_URLS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ||
    env.PREVIEW_BASE_URLS?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) ||
    [];

  const extensionBridgeSessionId =
    config?.browserExtensionBridgeSessionId?.trim() ||
    env.BROWSER_EXTENSION_BRIDGE_SESSION_ID?.trim() ||
    env.VITE_BROWSER_EXTENSION_BRIDGE_SESSION_ID?.trim() ||
    undefined;

  const extensionName =
    config?.browserExtensionName?.trim() ||
    env.BROWSER_EXTENSION_NAME?.trim() ||
    env.VITE_BROWSER_EXTENSION_NAME?.trim() ||
    undefined;

  return {
    apiKey,
    apiBaseUrl,
    model: config?.model || env.OPENAI_MODEL || DEFAULT_MODEL,
    workDir: config?.workDir || DEFAULT_WORK_DIR,
    browserServerUrl:
      config?.browserServerUrl ||
      env.BROWSER_SERVER_URL ||
      env.VITE_BROWSER_SERVER_URL,
    browserServerApiKey:
      config?.browserServerApiKey ||
      env.BROWSER_SERVER_API_KEY ||
      env.VITE_BROWSER_SERVER_API_KEY,
    previewBaseUrls: configuredPreviewBaseUrls,
    browserExtensionBridgeSessionId: extensionBridgeSessionId,
    browserExtensionName: extensionName,
  };
}

function ensureAgentApiKey(config: RuntimeEnvironmentConfig): string {
  if (!config.apiKey) {
    throw new Error("No API key configured for agent runtime.");
  }

  return config.apiKey;
}

function mapAgentProgress(taskId: string, event: AgentProgressEvent): void {
  const task = getRuntimeTask(taskId);

  if (!task) {
    return;
  }

  switch (event.type) {
    case "agent:started": {
      updateTask(taskId, {
        status: "running",
        agentId: event.agent.id,
        agentType: event.agent.agentType,
      });

      publishRuntimeEvent({
        type: "runtime:agent_started",
        sessionId: task.sessionId,
        taskId,
        data: {
          agent: event.agent,
        },
      });
      break;
    }

    case "agent:message": {
      appendTaskLine(taskId, event.message);

      publishRuntimeEvent({
        type: "runtime:agent_message",
        sessionId: task.sessionId,
        taskId,
        data: event,
      });
      break;
    }

    case "agent:tool_start": {
      appendTaskLine(taskId, `Running tool: ${event.toolCall.toolName}`);

      publishRuntimeEvent({
        type: "runtime:agent_tool_start",
        sessionId: task.sessionId,
        taskId,
        data: event,
      });
      break;
    }

    case "agent:tool_complete": {
      appendTaskLine(
        taskId,
        `Tool finished: ${event.toolCall.toolName} (${event.toolCall.status})`,
      );

      publishRuntimeEvent({
        type: "runtime:agent_tool_complete",
        sessionId: task.sessionId,
        taskId,
        data: event,
      });
      break;
    }

    case "agent:paused": {
      publishRuntimeEvent({
        type: "runtime:agent_paused",
        sessionId: task.sessionId,
        taskId,
        data: event,
      });
      break;
    }

    case "agent:complete": {
      publishRuntimeEvent({
        type: "runtime:agent_complete",
        sessionId: task.sessionId,
        taskId,
        data: event,
      });
      break;
    }
  }
}

function finalizeAgentTask(
  taskId: string,
  agentState?: AgentState,
  error?: string,
): RuntimeTaskState | undefined {
  const task = getRuntimeTask(taskId);

  if (!task) {
    return undefined;
  }

  if (task.status === "killed") {
    clearRuntimeTaskAbortController(taskId);
    return task;
  }

  if (error) {
    appendTaskLine(taskId, `Error: ${error}`);
    const updated = setTaskStatus(taskId, "failed", {
      error,
      result: agentState,
    });
    clearRuntimeTaskAbortController(taskId);
    return updated;
  }

  if (!agentState) {
    const updated = setTaskStatus(taskId, "failed", {
      error: "Agent finished without state",
    });
    clearRuntimeTaskAbortController(taskId);
    return updated;
  }

  if (agentState.result) {
    appendTaskLine(taskId, agentState.result);
  }

  if (agentState.error) {
    appendTaskLine(taskId, `Error: ${agentState.error}`);
  }

  const status: TaskStatus =
    agentState.status === "completed"
      ? "completed"
      : agentState.status === "killed"
        ? "killed"
        : "failed";

  const updated = setTaskStatus(taskId, status, {
    agentId: agentState.id,
    agentType: agentState.agentType,
    result: agentState,
    error: agentState.error,
  });

  clearRuntimeTaskAbortController(taskId);
  return updated;
}

function finalizeToolTask(
  taskId: string,
  result?: ToolResult<unknown>,
  thrownError?: string,
): RuntimeTaskState | undefined {
  const task = getRuntimeTask(taskId);

  if (!task) {
    return undefined;
  }

  if (task.status === "killed") {
    clearRuntimeTaskAbortController(taskId);
    return task;
  }

  if (thrownError) {
    appendTaskLine(taskId, `Error: ${thrownError}`);
    const updated = setTaskStatus(taskId, "failed", {
      error: thrownError,
    });
    clearRuntimeTaskAbortController(taskId);
    publishRuntimeEvent({
      type: "runtime:tool_failed",
      sessionId: task.sessionId,
      taskId,
      data: {
        toolName: task.toolName,
        error: thrownError,
      },
    });
    return updated;
  }

  if (!result) {
    const updated = setTaskStatus(taskId, "failed", {
      error: "Tool finished without result",
    });
    clearRuntimeTaskAbortController(taskId);
    publishRuntimeEvent({
      type: "runtime:tool_failed",
      sessionId: task.sessionId,
      taskId,
      data: {
        toolName: task.toolName,
        error: "Tool finished without result",
      },
    });
    return updated;
  }

  if (result.success) {
    appendTaskLine(taskId, safeStringify(result.data));

    const updated = setTaskStatus(taskId, "completed", {
      result: result.data,
      error: undefined,
    });

    clearRuntimeTaskAbortController(taskId);

    publishRuntimeEvent({
      type: "runtime:tool_completed",
      sessionId: task.sessionId,
      taskId,
      data: {
        toolName: task.toolName,
        result: result.data,
      },
    });

    return updated;
  }

  const error = result.error || "Tool execution failed";
  appendTaskLine(taskId, `Error: ${error}`);

  const updated = setTaskStatus(taskId, "failed", {
    error,
    result: result.data,
  });

  clearRuntimeTaskAbortController(taskId);

  publishRuntimeEvent({
    type: "runtime:tool_failed",
    sessionId: task.sessionId,
    taskId,
    data: {
      toolName: task.toolName,
      error,
      result: result.data,
    },
  });

  return updated;
}

export function listRegisteredAgents() {
  initializeAgenticSystem();

  return agenticRegistry.getAllAgents().map((agent) => ({
    agentType: agent.agentType,
    displayName: agent.displayName,
    description: agent.description,
    icon: agent.icon,
    whenToUse: agent.whenToUse,
    maxTurns: agent.maxTurns,
    allowedTools: agent.allowedTools,
  }));
}

export function listRegisteredTools() {
  initializeAgenticSystem();

  return agenticRegistry.getAllTools().map((tool) => ({
    name: tool.name,
    displayName: tool.displayName,
    description: tool.description.split("\n")[0],
    category: tool.category,
    isReadOnly: tool.isReadOnly,
    searchHint: tool.searchHint || "",
  }));
}

export function listRuntimeAgentStates(): AgentState[] {
  return Object.values(agentsStore.get()).sort(
    (a, b) => b.startTime - a.startTime,
  );
}

export function getRuntimeAgentState(agentId: string): AgentState | undefined {
  return agentsStore.get()[agentId];
}

export function hasRuntimeAgentContinuation(agentId: string): boolean {
  return hasAgentContinuation(agentId);
}

export function getRuntimeAgentContinuation(agentId: string) {
  return getAgentContinuation(agentId);
}

export async function spawnRuntimeAgent(
  request: SpawnAgentRequest,
  envConfig?: RuntimeEnvironmentConfig,
): Promise<RuntimeExecutionResponse<AgentState>> {
  initializeAgenticSystem();

  const agentType = request.agentType?.trim();
  const prompt = request.prompt?.trim();

  if (!agentType || !prompt) {
    throw new Error("Missing required fields: agentType, prompt");
  }

  const agentDefinition = agenticRegistry.getAgent(agentType);

  if (!agentDefinition) {
    const available = agenticRegistry
      .getAllAgents()
      .map((agent) => agent.agentType)
      .join(", ");
    throw new Error(
      `Unknown agent type: ${agentType}. Available: ${available}`,
    );
  }

  const runtimeConfig = resolveApiConfig({
    ...envConfig,
    model: request.model || envConfig?.model,
    workDir: request.workDir || envConfig?.workDir,
  });
  const apiKey = ensureAgentApiKey(runtimeConfig);

  const sessionId = resolveSession(request.sessionId);
  const task = createRuntimeTask({
    sessionId,
    type: "agent",
    kind: "agent",
    description:
      request.description ||
      `${agentDefinition.displayName}: ${prompt.slice(0, 80)}`,
    agentType,
  });

  const abortController = new AbortController();
  setRuntimeTaskAbortController(task.id, abortController);
  setTaskStatus(task.id, "running");

  publishRuntimeEvent({
    type: "runtime:task_created",
    sessionId,
    taskId: task.id,
    data: task,
  });

  const toolContext: ToolUseContext = {
    sessionId,
    taskId: task.id,
    workDir: runtimeConfig.workDir || DEFAULT_WORK_DIR,
    model: runtimeConfig.model || DEFAULT_MODEL,
    abortSignal: abortController.signal,
    apiKey,
    apiBaseUrl: runtimeConfig.apiBaseUrl,
    ...createRuntimeToolStateAccess(sessionId),
    parentAgentId: request.parentAgentId,
    permissionPolicy: request.permissionPolicy,
    browserServerUrl: runtimeConfig.browserServerUrl,
    browserServerApiKey: runtimeConfig.browserServerApiKey,
    previewBaseUrls: runtimeConfig.previewBaseUrls,
    browserExtensionBridgeSessionId:
      runtimeConfig.browserExtensionBridgeSessionId,
    browserExtensionName: runtimeConfig.browserExtensionName,
  };

  const run = async () => {
    try {
      const agentState = await runAgent({
        agentDefinition,
        prompt,
        description: task.description,
        model: toolContext.model || DEFAULT_MODEL,
        sandboxContext: toolContext,
        apiKey,
        apiBaseUrl: runtimeConfig.apiBaseUrl || DEFAULT_API_BASE_URL,
        parentAgentId: request.parentAgentId,
        isBackground: Boolean(request.runInBackground),
        abortSignal: abortController.signal,
        onProgress: (event) => mapAgentProgress(task.id, event),
      });

      return finalizeAgentTask(task.id, agentState);
    } catch (error) {
      const message = toErrorMessage(error);
      return finalizeAgentTask(task.id, undefined, message);
    }
  };

  if (request.runInBackground) {
    void run();

    return {
      sessionId,
      queued: true,
      task: getRuntimeTask(task.id) ?? task,
    };
  }

  const finalizedTask = await run();
  const currentTask = finalizedTask ?? getRuntimeTask(task.id) ?? task;
  const agent = currentTask.agentId
    ? getRuntimeAgentState(currentTask.agentId)
    : undefined;

  return {
    sessionId,
    queued: false,
    task: currentTask,
    data: agent,
    error: currentTask.error,
  };
}

export async function resumeRuntimeAgent(
  request: ResumeAgentRequest,
  envConfig?: RuntimeEnvironmentConfig,
): Promise<RuntimeExecutionResponse<AgentState>> {
  initializeAgenticSystem();

  const agentId = request.agentId?.trim();
  const message = request.message?.trim();

  if (!agentId || !message) {
    throw new Error("Missing required fields: agentId, message");
  }

  if (!hasAgentContinuation(agentId)) {
    throw new Error(`Agent '${agentId}' has no continuation state.`);
  }

  const runtimeConfig = resolveApiConfig({
    ...envConfig,
    model: request.model || envConfig?.model,
    workDir: request.workDir || envConfig?.workDir,
  });
  ensureAgentApiKey(runtimeConfig);

  const sessionId = resolveSession(request.sessionId);
  const task = createRuntimeTask({
    sessionId,
    type: "agent",
    kind: "agent",
    description: request.description || `Resume agent ${agentId}`,
  });

  const abortController = new AbortController();
  setRuntimeTaskAbortController(task.id, abortController);
  setTaskStatus(task.id, "running", { agentId });

  publishRuntimeEvent({
    type: "runtime:task_created",
    sessionId,
    taskId: task.id,
    data: task,
  });

  const run = async () => {
    try {
      const agentState = await resumeAgentWithMessage({
        agentId,
        message,
        abortSignal: abortController.signal,
        onProgress: (event) => mapAgentProgress(task.id, event),
      });

      return finalizeAgentTask(task.id, agentState);
    } catch (error) {
      const message = toErrorMessage(error);
      return finalizeAgentTask(task.id, undefined, message);
    }
  };

  if (request.runInBackground) {
    void run();

    return {
      sessionId,
      queued: true,
      task: getRuntimeTask(task.id) ?? task,
    };
  }

  const finalizedTask = await run();
  const currentTask = finalizedTask ?? getRuntimeTask(task.id) ?? task;
  const agent = currentTask.agentId
    ? getRuntimeAgentState(currentTask.agentId)
    : undefined;

  return {
    sessionId,
    queued: false,
    task: currentTask,
    data: agent,
    error: currentTask.error,
  };
}

export async function executeRuntimeTool(
  request: ExecuteToolRequest,
  envConfig?: RuntimeEnvironmentConfig,
): Promise<RuntimeExecutionResponse<ToolResult<unknown>>> {
  initializeAgenticSystem();

  const toolName = request.toolName?.trim();

  if (!toolName) {
    throw new Error("Missing required field: toolName");
  }

  const tool = agenticRegistry.getTool(toolName);

  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const runtimeConfig = resolveApiConfig({
    ...envConfig,
    model: request.model || envConfig?.model,
    workDir: request.workDir || envConfig?.workDir,
  });

  const sessionId = resolveSession(request.sessionId);
  const type: TaskType = toolName === "bash" ? "shell" : "background";
  const task = createRuntimeTask({
    sessionId,
    type,
    kind: "tool",
    description: request.description || `Tool: ${toolName}`,
    toolName,
  });

  const abortController = new AbortController();
  setRuntimeTaskAbortController(task.id, abortController);
  setTaskStatus(task.id, "running");

  publishRuntimeEvent({
    type: "runtime:task_created",
    sessionId,
    taskId: task.id,
    data: task,
  });

  publishRuntimeEvent({
    type: "runtime:tool_started",
    sessionId,
    taskId: task.id,
    data: {
      toolName,
      input: request.input || {},
    },
  });

  const context: ToolUseContext = {
    sessionId,
    taskId: task.id,
    workDir: runtimeConfig.workDir || DEFAULT_WORK_DIR,
    model: runtimeConfig.model || DEFAULT_MODEL,
    apiKey: runtimeConfig.apiKey,
    apiBaseUrl: runtimeConfig.apiBaseUrl,
    ...createRuntimeToolStateAccess(sessionId),
    parentAgentId: request.parentAgentId,
    abortSignal: abortController.signal,
    permissionPolicy: request.permissionPolicy,
    browserServerUrl: runtimeConfig.browserServerUrl,
    browserServerApiKey: runtimeConfig.browserServerApiKey,
    previewBaseUrls: runtimeConfig.previewBaseUrls,
    browserExtensionBridgeSessionId:
      runtimeConfig.browserExtensionBridgeSessionId,
    browserExtensionName: runtimeConfig.browserExtensionName,
  };

  const execute = async () => {
    try {
      const result = await executeTool(
        toolName,
        request.input || {},
        context,
        (progress) => mapToolProgress(task.id, toolName, progress),
      );
      const finalizedTask = finalizeToolTask(
        task.id,
        result as ToolResult<unknown>,
      );

      return {
        task: finalizedTask ?? getRuntimeTask(task.id) ?? task,
        result: result as ToolResult<unknown>,
      };
    } catch (error) {
      const message = toErrorMessage(error);
      const finalizedTask = finalizeToolTask(task.id, undefined, message);

      return {
        task: finalizedTask ?? getRuntimeTask(task.id) ?? task,
        result: undefined,
        error: message,
      };
    }
  };

  if (request.runInBackground) {
    void execute();

    return {
      sessionId,
      queued: true,
      task: getRuntimeTask(task.id) ?? task,
    };
  }

  const finished = await execute();

  return {
    sessionId,
    queued: false,
    task: finished.task,
    data: finished.result,
    error: finished.error || finished.task.error,
  };
}

export function listRuntimeTasksSnapshot(input?: {
  sessionId?: string;
  status?: TaskStatus;
}): RuntimeTaskState[] {
  return listRuntimeTasks({
    sessionId: input?.sessionId,
    status: input?.status,
  });
}

export function getRuntimeTaskSnapshot(
  taskId: string,
): RuntimeTaskState | undefined {
  return getRuntimeTask(taskId);
}

export function getRuntimeTaskOutput(
  taskId: string,
  offset = 0,
  limit = 200,
): RuntimeTaskOutput {
  const task = getRuntimeTask(taskId);

  if (!task) {
    return {
      taskId,
      status: "not_found",
      output: [],
      totalLines: 0,
      offset: 0,
      limit: 0,
      hasMore: false,
    };
  }

  const safeOffset = Math.max(0, Math.floor(offset));
  const safeLimit = Math.min(2_000, Math.max(1, Math.floor(limit)));
  const output = task.output.slice(safeOffset, safeOffset + safeLimit);
  const totalLines = task.output.length;
  const hasMore = safeOffset + output.length < totalLines;

  return {
    taskId,
    status: task.status,
    output,
    totalLines,
    offset: safeOffset,
    limit: safeLimit,
    hasMore,
  };
}

export function abortRuntimeExecution(input: {
  taskId?: string;
  agentId?: string;
}): RuntimeAbortResult {
  const taskId = input.taskId?.trim();

  if (taskId) {
    const task = abortRuntimeTask(taskId);

    if (!task) {
      return {
        success: false,
        error: `Task '${taskId}' not found`,
      };
    }

    publishRuntimeEvent({
      type: "runtime:task_updated",
      sessionId: task.sessionId,
      taskId: task.id,
      data: {
        status: task.status,
        error: task.error,
      },
    });

    return {
      success: true,
      task,
    };
  }

  const agentId = input.agentId?.trim();

  if (agentId) {
    const runningTask = findRunningTaskByAgentId(agentId);

    if (!runningTask) {
      return {
        success: false,
        error: `No running task found for agent '${agentId}'`,
      };
    }

    const task = abortRuntimeTask(runningTask.id);

    if (!task) {
      return {
        success: false,
        error: `Task '${runningTask.id}' not found`,
      };
    }

    publishRuntimeEvent({
      type: "runtime:task_updated",
      sessionId: task.sessionId,
      taskId: task.id,
      data: {
        status: task.status,
        error: task.error,
      },
    });

    return {
      success: true,
      task,
    };
  }

  return {
    success: false,
    error: "Provide taskId or agentId to abort execution",
  };
}

export function listRuntimeEventsSnapshot(input: {
  sessionId: string;
  afterEventId?: string;
  limit?: number;
}): RuntimeEvent[] {
  return listRuntimeEvents(input.sessionId, {
    afterEventId: input.afterEventId,
    limit: input.limit,
  });
}
