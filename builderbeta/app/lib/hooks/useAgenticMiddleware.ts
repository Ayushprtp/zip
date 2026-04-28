/**
 * Agentic Middleware — Background Agent Executor
 *
 * Watches LLM streaming output for marker-based invocations
 * and executes them via server-authoritative runtime routes.
 *
 * Flow:
 * 1. Chat.client.tsx streams LLM response
 * 2. This middleware watches for [AGENT_CALL], [TOOL_CALL], [SKILL_COMMAND] markers
 * 3. When detected, it spawns the corresponding agent/tool through runtime APIs
 * 4. Results are fed back into conversation/state via task polling + runtime events
 */

import { useCallback, useEffect, useRef } from 'react';
import { agenticRegistry } from '../agentic/registry';
import { addAgent, pendingQuestionRequests } from '../agentic/stores';
import { AskUserQuestionTool } from '../agentic/tools/ask-user-question.tool';

export interface AgenticRuntimeContext {
  previewBaseUrls?: string[];
  browserServerUrl?: string;
  browserServerApiKey?: string;
  browserExtensionBridgeSessionId?: string;
  browserExtensionName?: string;
}

interface AgenticMiddlewareOptions {
  /** Currently selected model */
  model?: string;
  /** Whether the chat is currently loading/streaming */
  isLoading: boolean;
  /** Messages array from useChat */
  messages: { role: string; content: string }[];
  /** Append a message to the chat */
  append: (message: any) => any;
  /** Optional runtime context for browser + preview-aware tool execution */
  runtimeContext?: AgenticRuntimeContext;
}

interface RuntimeTaskPayload {
  id: string;
  sessionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'killed';
  output?: string[];
  error?: string;
}

interface RuntimeEventPayload {
  id: string;
  type: string;
  sessionId: string;
  taskId?: string;
  timestamp: number;
  data?: Record<string, any>;
}

interface RuntimeEnvelope<T = any> {
  success: boolean;
  sessionId?: string;
  queued?: boolean;
  task?: RuntimeTaskPayload;
  data?: T;
  error?: string;
  events?: RuntimeEventPayload[];
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const EVENT_POLL_INTERVAL_MS = 500;

/**
 * Extracts agent/tool calls from assistant messages
 */
function extractAgentCalls(content: string): Array<{
  type: 'agent' | 'tool' | 'skill';
  name: string;
  args: Record<string, any>;
}> {
  const calls: Array<{ type: 'agent' | 'tool' | 'skill'; name: string; args: Record<string, any> }> = [];

  // Match [AGENT_CALL] markers
  const agentRegex = /\[AGENT_CALL\]\s*([a-zA-Z_][\w-]*)\s*:\s*(.+?)(?:\n|$)/g;
  let match;
  while ((match = agentRegex.exec(content)) !== null) {
    calls.push({
      type: 'agent',
      name: match[1],
      args: { prompt: match[2].trim() },
    });
  }

  // Match [TOOL_CALL] markers
  const toolRegex = /\[TOOL_CALL\]\s*(\w+)\s*:\s*({.+?})/gs;
  while ((match = toolRegex.exec(content)) !== null) {
    try {
      calls.push({
        type: 'tool',
        name: match[1],
        args: JSON.parse(match[2]),
      });
    } catch {
      // Ignore malformed JSON
    }
  }

  // Match [SKILL_COMMAND] markers
  const skillRegex = /\[SKILL_COMMAND\]\s*Invoke the skill tool with skill_name="(\w+)" and arguments="(.*)"/g;
  while ((match = skillRegex.exec(content)) !== null) {
    calls.push({
      type: 'skill',
      name: match[1],
      args: { arguments: match[2] },
    });
  }

  return calls;
}

function formatTaskOutput(task?: RuntimeTaskPayload): string {
  const lines = task?.output || [];

  if (lines.length > 0) {
    return lines.join('\n').trim();
  }

  if (task?.error) {
    return task.error;
  }

  return '';
}

function sanitizeRuntimeContext(runtimeContext: AgenticRuntimeContext | undefined): AgenticRuntimeContext | undefined {
  if (!runtimeContext) {
    return undefined;
  }

  const previewBaseUrls = Array.isArray(runtimeContext.previewBaseUrls)
    ? runtimeContext.previewBaseUrls
        .map((url) => (typeof url === 'string' ? url.trim() : ''))
        .filter((url): url is string => url.length > 0)
    : undefined;

  const browserServerUrl =
    typeof runtimeContext.browserServerUrl === 'string' && runtimeContext.browserServerUrl.trim().length > 0
      ? runtimeContext.browserServerUrl.trim()
      : undefined;

  const browserServerApiKey =
    typeof runtimeContext.browserServerApiKey === 'string' && runtimeContext.browserServerApiKey.trim().length > 0
      ? runtimeContext.browserServerApiKey.trim()
      : undefined;

  const browserExtensionBridgeSessionId =
    typeof runtimeContext.browserExtensionBridgeSessionId === 'string' &&
    runtimeContext.browserExtensionBridgeSessionId.trim().length > 0
      ? runtimeContext.browserExtensionBridgeSessionId.trim()
      : undefined;

  const browserExtensionName =
    typeof runtimeContext.browserExtensionName === 'string' && runtimeContext.browserExtensionName.trim().length > 0
      ? runtimeContext.browserExtensionName.trim()
      : undefined;

  if (
    !previewBaseUrls?.length &&
    !browserServerUrl &&
    !browserServerApiKey &&
    !browserExtensionBridgeSessionId &&
    !browserExtensionName
  ) {
    return undefined;
  }

  return {
    previewBaseUrls,
    browserServerUrl,
    browserServerApiKey,
    browserExtensionBridgeSessionId,
    browserExtensionName,
  };
}

/**
 * Hook: useAgenticMiddleware
 *
 * Watches chat messages for agentic invocations and executes them
 * in the background via server runtime APIs.
 */
export function useAgenticMiddleware(options: AgenticMiddlewareOptions) {
  const { isLoading, messages, model, append, runtimeContext } = options;
  const processedRef = useRef<Set<string>>(new Set());
  const runningRef = useRef<Map<string, AbortController>>(new Map());
  const runtimeContextRef = useRef<AgenticRuntimeContext | undefined>(sanitizeRuntimeContext(runtimeContext));

  useEffect(() => {
    runtimeContextRef.current = sanitizeRuntimeContext(runtimeContext);
  }, [runtimeContext]);

  useEffect(() => {
    if (!agenticRegistry.getTool(AskUserQuestionTool.name)) {
      agenticRegistry.registerTool(AskUserQuestionTool);
    }
  }, []);

  const pollRuntimeEvents = useCallback(async (
    sessionId: string,
    signal: AbortSignal,
    onEvents?: (events: RuntimeEventPayload[]) => void,
  ): Promise<void> => {
    let afterEventId: string | undefined;

    while (!signal.aborted) {
      try {
        const params = new URLSearchParams({
          action: 'events',
          sessionId,
          limit: '200',
        });

        if (afterEventId) {
          params.set('afterEventId', afterEventId);
        }

        const response = await fetch(`/api/agents?${params.toString()}`, {
          method: 'GET',
          signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to poll runtime events: ${response.status}`);
        }

        const payload = (await response.json()) as RuntimeEnvelope;
        const events = Array.isArray(payload.events) ? payload.events : [];

        if (events.length > 0) {
          afterEventId = events[events.length - 1].id;
          onEvents?.(events);
        }

        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, EVENT_POLL_INTERVAL_MS);

          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timeout);
              resolve();
            },
            { once: true },
          );
        });
      } catch (error) {
        if (signal.aborted) {
          return;
        }

        throw error;
      }
    }
  }, []);

  const waitForTaskCompletion = useCallback(async (
    taskId: string,
    signal: AbortSignal,
  ): Promise<RuntimeTaskPayload> => {
    while (!signal.aborted) {
      const response = await fetch(`/api/tasks?action=get&taskId=${encodeURIComponent(taskId)}`, {
        method: 'GET',
        signal,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || `Failed to fetch task '${taskId}'`);
      }

      const payload = (await response.json()) as { success: boolean; task?: RuntimeTaskPayload; error?: string };

      if (!payload.success || !payload.task) {
        throw new Error(payload.error || `Task '${taskId}' not found`);
      }

      const status = payload.task.status;

      if (status === 'completed' || status === 'failed' || status === 'killed') {
        return payload.task;
      }

      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, EVENT_POLL_INTERVAL_MS);

        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
      });
    }

    throw new Error('Task polling aborted');
  }, []);

  const executeRuntimeAgent = useCallback(async (
    body: Record<string, unknown>,
    abortSignal: AbortSignal,
  ): Promise<RuntimeEnvelope> => {
    const response = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    const payload = (await response.json()) as RuntimeEnvelope;

    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Agent runtime request failed');
    }

    return payload;
  }, []);

  const executeRuntimeTool = useCallback(async (
    body: Record<string, unknown>,
    abortSignal: AbortSignal,
  ): Promise<RuntimeEnvelope> => {
    const response = await fetch('/api/tools', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: abortSignal,
    });

    const payload = (await response.json()) as RuntimeEnvelope;

    if (!response.ok || !payload.success) {
      throw new Error(payload.error || 'Tool runtime request failed');
    }

    return payload;
  }, []);

  const mapRuntimeEvents = useCallback((events: RuntimeEventPayload[]) => {
    for (const event of events) {
      if (event.type === 'runtime:agent_started' || event.type === 'runtime:agent_complete' || event.type === 'runtime:agent_paused') {
        const agent = event.data?.agent;

        if (agent && typeof agent.id === 'string') {
          addAgent(agent);
        }
      }

      if (event.type === 'runtime:tool_progress') {
        const progressType = event.data?.progressType;

        if (progressType === 'browser_approval_required') {
          append({
            id: `${Date.now()}-ask-user-question-pending`,
            role: 'assistant',
            content: 'I need your input before I can continue. Please answer the pending question card in the Agent panel.',
          });
        }
      }
    }
  }, [append]);

  const executeInBackground = useCallback(
    async (
      call: { type: 'agent' | 'tool' | 'skill'; name: string; args: Record<string, any> },
      modelId: string,
    ) => {
      const abortController = new AbortController();
      const callId = `${call.type}-${call.name}-${Date.now()}`;
      runningRef.current.set(callId, abortController);

      try {
        if (call.type === 'agent' || call.type === 'skill') {
          const agentType = call.type === 'skill'
            ? (agenticRegistry.getSkill(call.name)?.agentType || 'coder')
            : call.name;

          const agentDef = agenticRegistry.getAgent(agentType);
          if (!agentDef) {
            console.warn(`[AgenticMiddleware] Agent type '${agentType}' not found`);
            return;
          }

          let prompt = call.args.prompt || '';
          let description = `Background ${call.type}: ${call.name}`;

          if (call.type === 'skill') {
            const skill = agenticRegistry.getSkill(call.name);
            if (skill) {
              prompt = skill.getPrompt
                ? skill.getPrompt(call.args.arguments || '')
                : (skill.prompt || '') + (call.args.arguments ? `\n\n## User Input\n\n${call.args.arguments}` : '');
              description = `Skill: /${call.name}`;
            }
          }

          console.log(`[AgenticMiddleware] Spawning ${call.type}: ${call.name}`);

          const runtimeResult = await executeRuntimeAgent(
            {
              action: 'spawn',
              agentType,
              prompt,
              description,
              model: modelId,
              runInBackground: true,
              runtimeContext: runtimeContextRef.current,
            },
            abortController.signal,
          );

          if (!runtimeResult.task) {
            throw new Error('Runtime did not return a task');
          }

          const eventPollPromise = runtimeResult.sessionId
            ? pollRuntimeEvents(runtimeResult.sessionId, abortController.signal, mapRuntimeEvents)
            : Promise.resolve();

          const task = await waitForTaskCompletion(runtimeResult.task.id, abortController.signal);

          abortController.abort();
          await eventPollPromise.catch(() => undefined);

          if (task.status !== 'completed') {
            append({
              id: `${Date.now()}`,
              role: 'assistant',
              content: `${call.type === 'skill' ? `Skill /${call.name}` : `Agent ${call.name}`} failed: ${task.error || 'unknown error'}`,
            });
          }
        } else if (call.type === 'tool') {
          const tool = agenticRegistry.getTool(call.name);
          if (!tool) {
            console.warn(`[AgenticMiddleware] Tool '${call.name}' not found`);
            return;
          }

          console.log(`[AgenticMiddleware] Executing tool: ${call.name}`);

          const runtimeResult = await executeRuntimeTool(
            {
              action: 'execute',
              toolName: call.name,
              input: call.args,
              model: modelId,
              runInBackground: true,
              runtimeContext: runtimeContextRef.current,
            },
            abortController.signal,
          );

          if (!runtimeResult.task) {
            throw new Error('Runtime did not return a task');
          }

          const eventPollPromise = runtimeResult.sessionId
            ? pollRuntimeEvents(runtimeResult.sessionId, abortController.signal, mapRuntimeEvents)
            : Promise.resolve();

          const task = await waitForTaskCompletion(runtimeResult.task.id, abortController.signal);

          abortController.abort();
          await eventPollPromise.catch(() => undefined);

          if (task.status !== 'completed') {
            append({
              id: `${Date.now()}`,
              role: 'assistant',
              content: `Tool \`${call.name}\` failed: ${task.error || 'unknown error'}`,
            });
          }

          console.log(`[AgenticMiddleware] Tool '${call.name}' result:`, task.status === 'completed');
        }
      } catch (error: any) {
        if (!abortController.signal.aborted) {
          console.error(`[AgenticMiddleware] Error executing ${call.type} '${call.name}':`, error.message);
        }
      } finally {
        runningRef.current.delete(callId);
      }
    },
    [append, executeRuntimeAgent, executeRuntimeTool, mapRuntimeEvents, pollRuntimeEvents, waitForTaskCompletion],
  );


  // Process messages for agent/tool calls when streaming finishes
  useEffect(() => {
    if (isLoading || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'assistant') return;

    const msgKey = `${messages.length}-${lastMessage.content.slice(0, 100)}`;
    if (processedRef.current.has(msgKey)) return;
    processedRef.current.add(msgKey);

    const calls = extractAgentCalls(lastMessage.content);
    if (calls.length === 0) return;

    for (const call of calls) {
      executeInBackground(call, model || DEFAULT_MODEL);
    }
  }, [executeInBackground, isLoading, messages, model]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const [, controller] of runningRef.current) {
        controller.abort();
      }
      runningRef.current.clear();
    };
  }, []);

  return {
    /** Number of currently running background agents */
    activeCount: runningRef.current.size,
    /** Number of currently pending user questions */
    pendingQuestionCount: Object.values(pendingQuestionRequests.get()).filter((request) => request.status === 'pending').length,
    /** Abort all running background agents */
    abortAll: () => {
      for (const [, controller] of runningRef.current) {
        controller.abort();
      }
      runningRef.current.clear();
    },
  };
}
