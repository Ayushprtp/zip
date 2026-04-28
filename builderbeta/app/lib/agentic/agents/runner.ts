/**
 * Agent Runner
 * Core agentic loop: LLM → tool calls → execute → feed results → repeat.
 * Inspired by Claude Code's QueryEngine + runAgent pattern.
 *
 * This runs in the browser/Cloudflare Worker context and talks to the
 * Flare API (OpenAI-compatible) for LLM completions.
 */

import type {
  AgentDefinition,
  AgentState,
  Tool,
  ToolCall,
  ToolUseContext,
} from '../types';
import { agenticRegistry } from '../registry';
import { executeTool, generateId } from '../executor';
import { addAgent, agentsStore, updateAgent } from '../stores';
import { getMode } from '~/lib/stores/modes';

// ─── Types ───────────────────────────────────────────────────────────

interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: LLMToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface AgentContinuationSnapshot {
  model: string;
  messages: LLMMessage[];
  turnCount: number;
}

interface AgentContinuationState {
  agentId: string;
  agentDefinition: AgentDefinition;
  model: string;
  messages: LLMMessage[];
  turnCount: number;
  maxTurnsPerRun: number;
  toolContext: ToolUseContext;
  apiKey: string;
  apiBaseUrl: string;
  parentAgentId?: string;
  updatedAt: number;
}

const agentContinuations = new Map<string, AgentContinuationState>();

export type AgentProgressEvent =
  | { type: 'agent:started'; agent: AgentState }
  | { type: 'agent:message'; agentId: string; message: string }
  | { type: 'agent:tool_start'; agentId: string; toolCall: ToolCall }
  | { type: 'agent:tool_complete'; agentId: string; toolCall: ToolCall }
  | { type: 'agent:paused'; agent: AgentState; continuation: AgentContinuationSnapshot }
  | { type: 'agent:complete'; agent: AgentState };

export interface RunAgentOptions {
  agentDefinition: AgentDefinition;
  prompt: string;
  description: string;
  model: string;
  sandboxContext: ToolUseContext;
  apiKey: string;
  apiBaseUrl: string;
  parentAgentId?: string;
  isBackground?: boolean;
  abortSignal?: AbortSignal;
  onProgress?: (event: AgentProgressEvent) => void;
}

export interface ResumeAgentOptions {
  agentId: string;
  message: string;
  abortSignal?: AbortSignal;
  onProgress?: (event: AgentProgressEvent) => void;
}

interface RunLoopOptions {
  agentState: AgentState;
  messages: LLMMessage[];
  turnCount: number;
  maxTurnsPerRun: number;
  model: string;
  apiKey: string;
  apiBaseUrl: string;
  toolDefs: LLMToolDefinition[];
  toolContext: ToolUseContext;
  abortSignal?: AbortSignal;
  onProgress?: (event: AgentProgressEvent) => void;
}

interface RunLoopResult {
  turnCount: number;
  messages: LLMMessage[];
}

interface ModeAwareToolFilterContext {
  isPlanning: boolean;
}

const PLANNING_MODE_DENYLIST: ReadonlySet<string> = new Set([
  'bash',
  'file_write',
  'file_edit',
  'notebook_edit',
  'task_stop',
  'team_delete',
  'cron_delete',
]);

function getModeAwareToolFilterContext(): ModeAwareToolFilterContext {
  return {
    isPlanning: getMode() === 'planning',
  };
}

function filterToolsForMode(tools: Tool[]): Tool[] {
  const context = getModeAwareToolFilterContext();

  if (!context.isPlanning) {
    return tools;
  }

  return tools.filter((tool) => {
    if (tool.name === 'exit_plan_mode' || tool.name === 'enter_plan_mode') {
      return true;
    }

    if (tool.name === 'ask_user_question') {
      return true;
    }

    if (tool.isReadOnly) {
      return true;
    }

    return !PLANNING_MODE_DENYLIST.has(tool.name);
  });
}

function cloneMessages(messages: LLMMessage[]): LLMMessage[] {
  return JSON.parse(JSON.stringify(messages)) as LLMMessage[];
}

function snapshotForEvent(state: AgentContinuationState): AgentContinuationSnapshot {
  return {
    model: state.model,
    messages: cloneMessages(state.messages),
    turnCount: state.turnCount,
  };
}

export function hasAgentContinuation(agentId: string): boolean {
  return agentContinuations.has(agentId);
}

export function getAgentContinuation(agentId: string): AgentContinuationSnapshot | undefined {
  const continuation = agentContinuations.get(agentId);
  if (!continuation) {
    return undefined;
  }

  return snapshotForEvent(continuation);
}

export function clearAgentContinuation(agentId: string): void {
  agentContinuations.delete(agentId);
}

// ─── Agent Runner ────────────────────────────────────────────────────

/**
 * Run an agent through its agentic loop:
 * 1. Build system prompt + messages
 * 2. Call LLM
 * 3. If LLM returns tool_calls → execute them → add results → goto 2
 * 4. If LLM returns text only → agent is done (continuation snapshot is kept)
 */
export async function runAgent(options: RunAgentOptions): Promise<AgentState> {
  const {
    agentDefinition,
    prompt,
    description,
    model,
    sandboxContext,
    apiKey,
    apiBaseUrl,
    parentAgentId,
    abortSignal,
    onProgress,
  } = options;

  const agentId = `agent-${generateId()}`;
  const maxTurnsPerRun = agentDefinition.maxTurns ?? 25;

  // Initialize agent state
  const agentState: AgentState = {
    id: agentId,
    agentType: agentDefinition.agentType,
    displayName: agentDefinition.displayName,
    description,
    status: 'running',
    startTime: Date.now(),
    toolCalls: [],
    icon: agentDefinition.icon,
    parentAgentId,
  };

  addAgent(agentState);
  onProgress?.({ type: 'agent:started', agent: { ...agentState } });

  // Build the tool definitions for the LLM
  const toolDefs = buildToolDefinitions(agentDefinition);

  // Build conversation messages
  const messages: LLMMessage[] = [
    { role: 'system', content: agentDefinition.systemPrompt },
    { role: 'user', content: prompt },
  ];

  // Context for tool execution
  const toolContext: ToolUseContext = {
    ...sandboxContext,
    agentId,
    parentAgentId,
    abortSignal,
  };

  let turnCount = 0;

  try {
    const loopResult = await runAgentLoop({
      agentState,
      messages,
      turnCount,
      maxTurnsPerRun,
      model,
      apiKey,
      apiBaseUrl,
      toolDefs,
      toolContext,
      abortSignal,
      onProgress,
    });

    turnCount = loopResult.turnCount;
  } catch (error: any) {
    console.error(`[Agent:${agentId}] Fatal error:`, error);
    agentState.status = 'failed';
    agentState.error = error.message || 'Unknown error';
  }

  finalizeAgentRun({
    agentState,
    agentDefinition,
    model,
    messages,
    turnCount,
    maxTurnsPerRun,
    toolContext,
    apiKey,
    apiBaseUrl,
    parentAgentId,
    onProgress,
  });

  console.log(
    `[Agent:${agentId}] Finished: ${agentState.status} (${turnCount} turns, ${agentState.toolCalls.length} tool calls, ${((agentState.endTime! - agentState.startTime) / 1000).toFixed(1)}s)`,
  );

  return agentState;
}

/**
 * Resume a previously completed agent by appending a new user message
 * to its preserved conversation context.
 */
export async function resumeAgentWithMessage(options: ResumeAgentOptions): Promise<AgentState> {
  const { agentId, message, abortSignal, onProgress } = options;
  const trimmedMessage = message.trim();

  if (!trimmedMessage) {
    throw new Error('Message cannot be empty');
  }

  const continuation = agentContinuations.get(agentId);
  if (!continuation) {
    throw new Error(`Agent '${agentId}' has no continuation state`);
  }

  const existingAgent = agentsStore.get()[agentId];

  const agentState: AgentState = existingAgent
    ? {
        ...existingAgent,
        status: 'running',
        endTime: undefined,
        error: undefined,
      }
    : {
        id: agentId,
        agentType: continuation.agentDefinition.agentType,
        displayName: continuation.agentDefinition.displayName,
        description: `Resumed ${continuation.agentDefinition.displayName}`,
        status: 'running',
        startTime: Date.now(),
        toolCalls: [],
        icon: continuation.agentDefinition.icon,
        parentAgentId: continuation.parentAgentId,
      };

  if (existingAgent) {
    updateAgent(agentId, {
      status: 'running',
      endTime: undefined,
      error: undefined,
    });
  } else {
    addAgent(agentState);
  }

  onProgress?.({ type: 'agent:started', agent: { ...agentState } });

  const messages = cloneMessages(continuation.messages);
  messages.push({ role: 'user', content: trimmedMessage });

  const toolDefs = buildToolDefinitions(continuation.agentDefinition);
  let turnCount = continuation.turnCount;

  const toolContext: ToolUseContext = {
    ...continuation.toolContext,
    agentId,
    parentAgentId: continuation.parentAgentId,
    abortSignal,
  };

  try {
    const loopResult = await runAgentLoop({
      agentState,
      messages,
      turnCount,
      maxTurnsPerRun: continuation.maxTurnsPerRun,
      model: continuation.model,
      apiKey: continuation.apiKey,
      apiBaseUrl: continuation.apiBaseUrl,
      toolDefs,
      toolContext,
      abortSignal,
      onProgress,
    });

    turnCount = loopResult.turnCount;
  } catch (error: any) {
    console.error(`[Agent:${agentId}] Fatal error while resuming:`, error);
    agentState.status = 'failed';
    agentState.error = error.message || 'Unknown error';
  }

  finalizeAgentRun({
    agentState,
    agentDefinition: continuation.agentDefinition,
    model: continuation.model,
    messages,
    turnCount,
    maxTurnsPerRun: continuation.maxTurnsPerRun,
    toolContext,
    apiKey: continuation.apiKey,
    apiBaseUrl: continuation.apiBaseUrl,
    parentAgentId: continuation.parentAgentId,
    onProgress,
  });

  console.log(
    `[Agent:${agentId}] Resumed run finished: ${agentState.status} (${turnCount} turns total, ${agentState.toolCalls.length} tool calls)`
  );

  return agentState;
}

async function runAgentLoop(options: RunLoopOptions): Promise<RunLoopResult> {
  const {
    agentState,
    messages,
    turnCount: initialTurnCount,
    maxTurnsPerRun,
    model,
    apiKey,
    apiBaseUrl,
    toolDefs,
    toolContext,
    abortSignal,
    onProgress,
  } = options;

  let turnCount = initialTurnCount;
  const maxTurnsForThisRun = initialTurnCount + maxTurnsPerRun;

  while (turnCount < maxTurnsForThisRun) {
    // Check for abort
    if (abortSignal?.aborted) {
      agentState.status = 'killed';
      agentState.error = 'Agent was aborted';
      break;
    }

    turnCount++;
    console.log(`[Agent:${agentState.id}] Turn ${turnCount}/${maxTurnsForThisRun}`);

    // Call the LLM
    const llmResponse = await callLLM({
      messages,
      model,
      apiKey,
      apiBaseUrl,
      tools: toolDefs,
      abortSignal,
    });

    // Handle text response (agent is done for this run)
    if (llmResponse.content && !llmResponse.tool_calls?.length) {
      agentState.result = llmResponse.content;
      agentState.status = 'completed';

      messages.push({
        role: 'assistant',
        content: llmResponse.content,
      });

      onProgress?.({
        type: 'agent:message',
        agentId: agentState.id,
        message: llmResponse.content,
      });

      break;
    }

    // Add assistant message to conversation
    messages.push({
      role: 'assistant',
      content: llmResponse.content || undefined,
      tool_calls: llmResponse.tool_calls,
    });

    // If there's text content alongside tool calls, report it
    if (llmResponse.content) {
      onProgress?.({
        type: 'agent:message',
        agentId: agentState.id,
        message: llmResponse.content,
      });
    }

    // Execute tool calls
    if (llmResponse.tool_calls?.length) {
      for (const toolCall of llmResponse.tool_calls) {
        if (abortSignal?.aborted) break;

        const toolName = toolCall.function.name;
        let toolArgs: Record<string, any>;

        try {
          toolArgs = JSON.parse(toolCall.function.arguments);
        } catch {
          toolArgs = { raw: toolCall.function.arguments };
        }

        // Track the tool call
        const tc: ToolCall = {
          id: toolCall.id,
          toolName,
          input: toolArgs,
          status: 'running',
          startTime: Date.now(),
        };

        agentState.toolCalls.push(tc);
        onProgress?.({ type: 'agent:tool_start', agentId: agentState.id, toolCall: tc });

        // Execute the tool
        let toolResult: string;

        try {
          const result = await executeTool(toolName, toolArgs, toolContext);
          const typedResult = result as { success?: boolean; data?: unknown; error?: string };

          if (typedResult && typeof typedResult === 'object' && typedResult.success === false) {
            const errorMessage = typedResult.error || `Tool '${toolName}' returned success=false`;
            toolResult = `Error: ${errorMessage}`;
            tc.status = 'failed';
            tc.error = errorMessage;
            tc.output = typedResult.data;
          } else {
            toolResult = typeof result === 'string'
              ? result
              : JSON.stringify(typedResult?.data ?? result, null, 2);
            tc.status = 'completed';
            tc.output = typedResult?.data ?? result;
          }
        } catch (error: any) {
          toolResult = `Error: ${error.message}`;
          tc.status = 'failed';
          tc.error = error.message;
        }

        tc.endTime = Date.now();
        onProgress?.({ type: 'agent:tool_complete', agentId: agentState.id, toolCall: tc });

        // Add tool result to conversation
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: truncateResult(toolResult, 50_000),
        });
      }
    }

    // If no tool calls and no content, agent is stuck → end
    if (!llmResponse.tool_calls?.length && !llmResponse.content) {
      agentState.result = 'Agent completed (no further actions)';
      agentState.status = 'completed';
      break;
    }

    // Update the store with current state
    updateAgent(agentState.id, { toolCalls: [...agentState.toolCalls], status: agentState.status });
  }

  // Max turns exceeded for this run
  if (turnCount >= maxTurnsForThisRun && agentState.status === 'running') {
    agentState.status = 'completed';
    agentState.result = `Agent reached maximum turns for this run (${maxTurnsPerRun}). Last progress: ${
      agentState.toolCalls[agentState.toolCalls.length - 1]?.toolName || 'none'
    }`;
  }

  return { turnCount, messages };
}

interface FinalizeAgentRunOptions {
  agentState: AgentState;
  agentDefinition: AgentDefinition;
  model: string;
  messages: LLMMessage[];
  turnCount: number;
  maxTurnsPerRun: number;
  toolContext: ToolUseContext;
  apiKey: string;
  apiBaseUrl: string;
  parentAgentId?: string;
  onProgress?: (event: AgentProgressEvent) => void;
}

function finalizeAgentRun(options: FinalizeAgentRunOptions): void {
  const {
    agentState,
    agentDefinition,
    model,
    messages,
    turnCount,
    maxTurnsPerRun,
    toolContext,
    apiKey,
    apiBaseUrl,
    parentAgentId,
    onProgress,
  } = options;

  agentState.endTime = Date.now();
  updateAgent(agentState.id, {
    status: agentState.status,
    endTime: agentState.endTime,
    result: agentState.result,
    error: agentState.error,
    toolCalls: [...agentState.toolCalls],
  });

  // Preserve continuation state for follow-up send_message calls
  if (agentState.status === 'completed') {
    const continuationState: AgentContinuationState = {
      agentId: agentState.id,
      agentDefinition,
      model,
      messages: cloneMessages(messages),
      turnCount,
      maxTurnsPerRun,
      toolContext: {
        ...toolContext,
        abortSignal: undefined,
      },
      apiKey,
      apiBaseUrl,
      parentAgentId,
      updatedAt: Date.now(),
    };

    agentContinuations.set(agentState.id, continuationState);

    onProgress?.({
      type: 'agent:paused',
      agent: { ...agentState, status: 'paused' },
      continuation: snapshotForEvent(continuationState),
    });
  } else if (agentState.status === 'killed') {
    // Killed agents should not be resumable
    agentContinuations.delete(agentState.id);
  }

  onProgress?.({ type: 'agent:complete', agent: { ...agentState } });
}

// ─── LLM Interface ───────────────────────────────────────────────────

interface LLMCallOptions {
  messages: LLMMessage[];
  model: string;
  apiKey: string;
  apiBaseUrl: string;
  tools?: LLMToolDefinition[];
  abortSignal?: AbortSignal;
}

interface LLMToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

interface LLMResponse {
  content?: string;
  tool_calls?: LLMToolCall[];
}

/**
 * Call the LLM (OpenAI-compatible API) and return the response.
 * Uses non-streaming mode for agent tool-use loops.
 */
async function callLLM(options: LLMCallOptions): Promise<LLMResponse> {
  const { messages, model, apiKey, apiBaseUrl, tools, abortSignal } = options;

  const body: Record<string, any> = {
    model,
    messages: messages.map(m => {
      const msg: Record<string, any> = { role: m.role };

      if (m.content !== undefined) msg.content = m.content;
      if (m.tool_calls) msg.tool_calls = m.tool_calls;
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      if (m.name) msg.name = m.name;

      return msg;
    }),
    max_tokens: 16384,
    temperature: 0.1,
  };

  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  let response: Response;
  let retries = 3;
  let lastError: Error | undefined;

  while (retries > 0) {
    try {
      response = await fetch(`${apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': 'Flare/1.0 (Agent Runner)',
        },
        body: JSON.stringify(body),
        signal: abortSignal,
      });

      if (response!.ok) break;

      const errorText = await response!.text();
      console.error(`[AgentRunner] LLM API error (${response!.status}): ${errorText}`);

      if (response!.status === 401 || response!.status === 403) {
        throw new Error(`Authentication failed (${response!.status}). Check your API key.`);
      }

      if (response!.status === 429) {
        // Rate limited — wait longer
        const waitMs = Math.min(2000 * (4 - retries), 8000);
        console.warn(`[AgentRunner] Rate limited, waiting ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
        retries--;
        continue;
      }

      throw new Error(`LLM API error: ${response!.status} - ${errorText.substring(0, 500)}`);
    } catch (err: any) {
      lastError = err;
      retries--;

      if (err.name === 'AbortError') throw err;

      if (retries > 0) {
        console.warn(`[AgentRunner] LLM call failed, retrying (${retries} left): ${err.message}`);
        await new Promise(r => setTimeout(r, 1000 * (3 - retries)));
      }
    }
  }

  if (!response! || !response!.ok) {
    throw lastError || new Error('Failed to call LLM after multiple attempts');
  }

  const data = await response!.json() as any;
  const choice = data.choices?.[0];

  if (!choice) {
    throw new Error('LLM returned no choices');
  }

  return {
    content: choice.message?.content || undefined,
    tool_calls: choice.message?.tool_calls || undefined,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Build OpenAI-compatible tool definitions from the registry,
 * filtered by the agent's allowed tools.
 */
function buildToolDefinitions(agentDef: AgentDefinition): LLMToolDefinition[] {
  const allTools = agenticRegistry.getAllTools();

  // Filter to agent's allowed tools (if specified)
  const filteredTools = agentDef.allowedTools
    ? allTools.filter(t =>
        agentDef.allowedTools!.includes(t.name) ||
        t.aliases?.some(a => agentDef.allowedTools!.includes(a))
      )
    : allTools;

  // Exclude skill by default. Allow agent only for agent types that explicitly opt in
  // via allowedTools (e.g., swarm coordinators).
  const safeTools = filteredTools.filter((tool) => {
    if (tool.name === 'skill') {
      return false;
    }

    if (tool.name === 'agent') {
      return Boolean(agentDef.allowedTools?.includes('agent'));
    }

    return true;
  });
  const modeAwareTools = filterToolsForMode(safeTools);

  return modeAwareTools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

/**
 * Truncate tool output to prevent context window overflow.
 */
function truncateResult(result: string, maxChars: number): string {
  if (result.length <= maxChars) return result;

  const half = Math.floor(maxChars / 2) - 50;
  return (
    result.substring(0, half) +
    `\n\n... [${result.length - maxChars} characters truncated] ...\n\n` +
    result.substring(result.length - half)
  );
}
