/**
 * Coordinator Engine
 * Orchestrates parallel worker agents for complex tasks.
 * Inspired by Claude Code's coordinatorMode.ts.
 */

import type {
  AgentDefinition,
  AgentState,
  CoordinatorState,
  WorkerResult,
  ToolUseContext,
} from '../types';
import { runAgent, type AgentProgressEvent } from './runner';
import { generateId } from '../executor';

export interface CoordinatorOptions {
  /** Model for worker agents */
  model: string;
  /** API key */
  apiKey: string;
  /** API base URL */
  apiBaseUrl: string;
  /** E2B sandbox context */
  sandboxContext: ToolUseContext;
  /** Abort signal */
  abortSignal?: AbortSignal;
  /** Progress callback */
  onProgress?: (event: CoordinatorEvent) => void;
}

export type CoordinatorEvent =
  | { type: 'coordinator:worker_spawned'; workerId: string; description: string }
  | { type: 'coordinator:worker_progress'; workerId: string; event: AgentProgressEvent }
  | { type: 'coordinator:worker_complete'; result: WorkerResult }
  | { type: 'coordinator:all_complete'; results: WorkerResult[] };

/**
 * Spawn multiple worker agents in parallel and collect results.
 */
export async function spawnParallelWorkers(
  workers: Array<{
    agentDefinition: AgentDefinition;
    prompt: string;
    description: string;
  }>,
  options: CoordinatorOptions,
): Promise<WorkerResult[]> {
  const results: WorkerResult[] = [];

  const workerPromises = workers.map(async (worker) => {
    const workerId = generateId();

    options.onProgress?.({
      type: 'coordinator:worker_spawned',
      workerId,
      description: worker.description,
    });

    const agentState = await runAgent({
      agentDefinition: worker.agentDefinition,
      prompt: worker.prompt,
      description: worker.description,
      model: options.model,
      sandboxContext: options.sandboxContext,
      apiKey: options.apiKey,
      apiBaseUrl: options.apiBaseUrl,
      parentAgentId: undefined,
      isBackground: true,
      abortSignal: options.abortSignal,
      onProgress: (event) => {
        options.onProgress?.({
          type: 'coordinator:worker_progress',
          workerId,
          event,
        });
      },
    });

    const result: WorkerResult = {
      agentId: agentState.id,
      agentType: agentState.agentType,
      description: worker.description,
      status: agentState.status,
      result: agentState.result,
      error: agentState.error,
      durationMs: (agentState.endTime ?? Date.now()) - agentState.startTime,
      totalTokens: agentState.totalTokens,
    };

    results.push(result);
    options.onProgress?.({ type: 'coordinator:worker_complete', result });

    return result;
  });

  await Promise.all(workerPromises);

  options.onProgress?.({
    type: 'coordinator:all_complete',
    results,
  });

  return results;
}

/**
 * Create a coordinator state tracker.
 */
export function createCoordinatorState(): CoordinatorState {
  return {
    isActive: false,
    workers: new Map(),
    completedResults: [],
  };
}

/**
 * Format worker results as a task notification (matching Claude Code's format).
 */
export function formatWorkerNotification(result: WorkerResult): string {
  return `<task-notification>
<task-id>${result.agentId}</task-id>
<status>${result.status}</status>
<summary>Agent "${result.description}" ${result.status}${result.error ? `: ${result.error}` : ''}</summary>
${result.result ? `<result>${result.result}</result>` : ''}
<usage>
  <duration_ms>${result.durationMs}</duration_ms>
  ${result.totalTokens ? `<total_tokens>${result.totalTokens}</total_tokens>` : ''}
</usage>
</task-notification>`;
}

/**
 * Generate the coordinator system prompt.
 */
export function getCoordinatorSystemPrompt(): string {
  return `You are an AI coordinator that orchestrates complex tasks across multiple worker agents.

## Your Role

You are a **coordinator**. Your job is to:
- Help the user achieve their goal by breaking complex tasks into subtasks
- Direct workers to research, implement, and verify code changes
- Synthesize results and communicate with the user
- Answer questions directly when possible — don't delegate work you can handle

## Spawning Workers

To spawn worker agents, use the agent tool with subagent_type "worker".

### Concurrency Rules
- **Read-only tasks** (research) — run in parallel freely
- **Write-heavy tasks** (implementation) — one at a time per set of files
- **Verification** can run alongside implementation on different files

### Writing Worker Prompts
Workers start with zero context. Brief them like a smart colleague who just walked into the room:
- Explain what you're trying to accomplish and why
- Include specific file paths and line numbers
- State what "done" looks like
- Never write "based on your findings" — synthesize findings yourself

## Task Workflow

1. **Research** — Workers investigate in parallel
2. **Synthesis** — YOU read findings, understand the problem, craft implementation specs
3. **Implementation** — Workers make targeted changes per spec
4. **Verification** — Workers test changes work

## Worker Results

Worker results arrive as <task-notification> messages. Read the result, synthesize, and respond to the user.`;
}
