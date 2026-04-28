/**
 * Agentic Executor Client Hook
 *
 * Runtime bridge between chat UI and the server-authoritative agentic runtime APIs.
 * It handles:
 * 1. Skill command execution (/commit, /test, etc.)
 * 2. Tool execution through /api/tools
 * 3. Agent spawning through /api/agents
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { agenticRegistry } from '../agentic/registry';
import { initializeAgenticSystem } from '../agentic';
import {
  addAgent,
  pendingQuestionRequests,
  type AskUserQuestionRequest,
  type AskUserQuestionResponse,
} from '../agentic/stores';
import { AskUserQuestionTool } from '../agentic/tools/ask-user-question.tool';
import type { AgenticRuntimeContext } from './useAgenticMiddleware';


// Ensure the agentic system is initialized
initializeAgenticSystem();

interface ExecutorResult {
  success: boolean;
  output: string;
  error?: string;
}

interface SubmitQuestionAnswersInput {
  requestId: string;
  answers: AskUserQuestionResponse['answers'];
}

interface AgenticExecutorOptions {
  runtimeContext?: AgenticRuntimeContext;
}

interface RuntimeTaskPayload {
  id: string;
  sessionId: string;
  kind?: string;
  type?: string;
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
  count?: number;
}

interface RuntimeTaskQuestionSubmitPayload {
  success: boolean;
  requestId?: string;
  error?: string;
}

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const EVENT_POLL_INTERVAL_MS = 500;

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
 * Hook: useAgenticExecutor
 *
 * Provides client-side APIs that call server runtime routes for skills, tools, and agents.
 */
export function useAgenticExecutor(options?: AgenticExecutorOptions) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastResult, setLastResult] = useState<ExecutorResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runtimeContextRef = useRef<AgenticRuntimeContext | undefined>(sanitizeRuntimeContext(options?.runtimeContext));

  useEffect(() => {
    runtimeContextRef.current = sanitizeRuntimeContext(options?.runtimeContext);
  }, [options?.runtimeContext]);

  useEffect(() => {
    if (!agenticRegistry.getTool(AskUserQuestionTool.name)) {
      agenticRegistry.registerTool(AskUserQuestionTool);
    }
  }, []);

  const mapRuntimeEventsToAgentStore = useCallback((events: RuntimeEventPayload[]) => {
    for (const event of events) {
      if (event.type === 'runtime:agent_started' || event.type === 'runtime:agent_complete' || event.type === 'runtime:agent_paused') {
        const agent = event.data?.agent;

        if (agent && typeof agent.id === 'string') {
          addAgent(agent);
        }
      }
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

  const executeSkill = useCallback(async (
    skillName: string,
    args: string,
    model: string,
  ): Promise<ExecutorResult> => {
    const aliasMap: Record<string, string> = {
      ci: 'commit', save: 'commit',
      t: 'test',
      ship: 'deploy',
      rf: 'refactor',
      fix: 'debug', bug: 'debug',
      cr: 'review',
      i: 'install', setup: 'install',
      new: 'init', create: 'init',
      clean: 'simplify', cleanup: 'simplify',
      check: 'verify',
      watch: 'monitor',
      pr: 'pr-review',
      perf: 'diagnose', slow: 'diagnose',
      upgrade: 'migrate',
    };
    const canonicalName = aliasMap[skillName.toLowerCase()] || skillName.toLowerCase();
    const skill = agenticRegistry.getSkill(canonicalName);

    if (!skill) {
      const available = agenticRegistry.getUserInvocableSkills().map(s => `/${s.name}`).join(', ');
      return {
        success: false,
        output: '',
        error: `Unknown skill "/${skillName}". Available: ${available}`,
      };
    }

    const prompt = skill.getPrompt
      ? skill.getPrompt(args)
      : (skill.prompt || '') + (args ? `\n\n## User Input\n\n${args}` : '');

    const agentType = skill.agentType || 'coder';

    setIsExecuting(true);
    abortRef.current = new AbortController();

    toast.info(`⚡ Running /${canonicalName}...`, { autoClose: 2000 });

    try {
      const runtimeResult = await executeRuntimeAgent(
        {
          action: 'spawn',
          agentType,
          prompt,
          description: `Skill: /${canonicalName}`,
          model: model || DEFAULT_MODEL,
          runInBackground: true,
          runtimeContext: runtimeContextRef.current,
        },
        abortRef.current.signal,
      );

      if (!runtimeResult.task) {
        throw new Error('Runtime did not return a task');
      }

      const eventPollPromise = runtimeResult.sessionId
        ? pollRuntimeEvents(runtimeResult.sessionId, abortRef.current.signal, mapRuntimeEventsToAgentStore)
        : Promise.resolve();

      const task = await waitForTaskCompletion(runtimeResult.task.id, abortRef.current.signal);

      abortRef.current.abort();
      await eventPollPromise.catch(() => undefined);

      const output = formatTaskOutput(task);
      const success = task.status === 'completed';

      const executorResult: ExecutorResult = {
        success,
        output: output || (success ? 'Skill completed.' : ''),
        error: success ? undefined : task.error || 'Skill failed',
      };

      if (success) {
        toast.success(`✅ /${canonicalName} completed`);
      } else {
        toast.error(`❌ /${canonicalName} failed: ${executorResult.error}`);
      }

      setLastResult(executorResult);
      return executorResult;
    } catch (error: any) {
      const executorResult: ExecutorResult = {
        success: false,
        output: '',
        error: error.message,
      };
      toast.error(`❌ /${canonicalName} error: ${error.message}`);
      setLastResult(executorResult);
      return executorResult;
    } finally {
      setIsExecuting(false);
      abortRef.current = null;
    }
  }, [executeRuntimeAgent, mapRuntimeEventsToAgentStore, pollRuntimeEvents, waitForTaskCompletion]);

  const executeToolDirect = useCallback(async (
    toolName: string,
    input: Record<string, any>,
    model?: string,
  ): Promise<ExecutorResult> => {
    const tool = agenticRegistry.getTool(toolName);
    if (!tool) {
      return { success: false, output: '', error: `Unknown tool: ${toolName}` };
    }

    setIsExecuting(true);
    abortRef.current = new AbortController();

    try {
      const runtimeResult = await executeRuntimeTool(
        {
          action: 'execute',
          toolName,
          input,
          model: model || DEFAULT_MODEL,
          runInBackground: true,
          runtimeContext: runtimeContextRef.current,
        },
        abortRef.current.signal,
      );

      if (!runtimeResult.task) {
        throw new Error('Runtime did not return a task');
      }

      const eventPollPromise = runtimeResult.sessionId
        ? pollRuntimeEvents(runtimeResult.sessionId, abortRef.current.signal, mapRuntimeEventsToAgentStore)
        : Promise.resolve();

      const task = await waitForTaskCompletion(runtimeResult.task.id, abortRef.current.signal);

      abortRef.current.abort();
      await eventPollPromise.catch(() => undefined);

      const output = formatTaskOutput(task);
      const success = task.status === 'completed';

      const executorResult: ExecutorResult = {
        success,
        output: output || (success ? 'Tool completed.' : ''),
        error: success ? undefined : task.error || `Tool '${toolName}' failed`,
      };

      setLastResult(executorResult);
      return executorResult;
    } catch (error: any) {
      const executorResult: ExecutorResult = {
        success: false,
        output: '',
        error: error.message,
      };
      setLastResult(executorResult);
      return executorResult;
    } finally {
      setIsExecuting(false);
      abortRef.current = null;
    }
  }, [executeRuntimeTool, mapRuntimeEventsToAgentStore, pollRuntimeEvents, waitForTaskCompletion]);

  const spawnAgent = useCallback(async (
    agentType: string,
    prompt: string,
    model: string,
  ): Promise<ExecutorResult> => {
    const agentDef = agenticRegistry.getAgent(agentType);
    if (!agentDef) {
      return { success: false, output: '', error: `Unknown agent type: ${agentType}` };
    }

    setIsExecuting(true);
    abortRef.current = new AbortController();

    toast.info(`🤖 Spawning ${agentDef.displayName} agent...`, { autoClose: 2000 });

    try {
      const runtimeResult = await executeRuntimeAgent(
        {
          action: 'spawn',
          agentType,
          prompt,
          description: `Agent: ${agentType}`,
          model: model || DEFAULT_MODEL,
          runInBackground: true,
          runtimeContext: runtimeContextRef.current,
        },
        abortRef.current.signal,
      );

      if (!runtimeResult.task) {
        throw new Error('Runtime did not return a task');
      }

      const eventPollPromise = runtimeResult.sessionId
        ? pollRuntimeEvents(runtimeResult.sessionId, abortRef.current.signal, mapRuntimeEventsToAgentStore)
        : Promise.resolve();

      const task = await waitForTaskCompletion(runtimeResult.task.id, abortRef.current.signal);

      abortRef.current.abort();
      await eventPollPromise.catch(() => undefined);

      const output = formatTaskOutput(task);
      const success = task.status === 'completed';

      const executorResult: ExecutorResult = {
        success,
        output: output || (success ? 'Agent completed.' : ''),
        error: success ? undefined : task.error || 'Agent failed',
      };

      setLastResult(executorResult);
      return executorResult;
    } catch (error: any) {
      const executorResult: ExecutorResult = {
        success: false,
        output: '',
        error: error.message,
      };
      setLastResult(executorResult);
      return executorResult;
    } finally {
      setIsExecuting(false);
      abortRef.current = null;
    }
  }, [executeRuntimeAgent, mapRuntimeEventsToAgentStore, pollRuntimeEvents, waitForTaskCompletion]);

  const submitQuestionAnswers = useCallback(async (
    input: SubmitQuestionAnswersInput,
  ): Promise<ExecutorResult> => {
    const request: AskUserQuestionRequest | undefined = pendingQuestionRequests.get()[input.requestId];

    if (!request) {
      const result: ExecutorResult = {
        success: false,
        output: '',
        error: `Question request '${input.requestId}' not found.`,
      };
      setLastResult(result);
      return result;
    }

    const payload = {
      action: 'question_submit',
      requestId: input.requestId,
      answers: input.answers,
    };

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responsePayload = (await response.json().catch(() => ({}))) as RuntimeTaskQuestionSubmitPayload;

      if (!response.ok || !responsePayload.success) {
        const result: ExecutorResult = {
          success: false,
          output: '',
          error: responsePayload.error || 'Failed to submit question answers.',
        };
        setLastResult(result);
        return result;
      }

      const result: ExecutorResult = {
        success: true,
        output: 'Question answers submitted.',
      };
      setLastResult(result);
      return result;
    } catch (error: any) {
      const result: ExecutorResult = {
        success: false,
        output: '',
        error: error?.message || 'Failed to submit question answers.',
      };
      setLastResult(result);
      return result;
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return {
    executeSkill,
    executeToolDirect,
    spawnAgent,
    submitQuestionAnswers,
    abort,
    isExecuting,
    lastResult,
  };
}
