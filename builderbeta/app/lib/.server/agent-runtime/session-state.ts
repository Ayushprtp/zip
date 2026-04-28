import type { TaskStatus, TaskType } from '~/lib/agentic/types';
import { generateId } from '~/lib/agentic/executor';

export type RuntimeTaskKind = 'agent' | 'tool';

export interface RuntimeSessionState {
  id: string;
  createdAt: number;
  updatedAt: number;
  taskIds: string[];
}

export interface RuntimeTaskState {
  id: string;
  sessionId: string;
  type: TaskType;
  kind: RuntimeTaskKind;
  status: TaskStatus;
  description: string;
  startTime: number;
  endTime?: number;
  output: string[];
  notified: boolean;
  progress?: number;
  agentId?: string;
  agentType?: string;
  toolName?: string;
  result?: unknown;
  error?: string;
}

interface CreateRuntimeTaskInput {
  sessionId: string;
  type: TaskType;
  kind: RuntimeTaskKind;
  description: string;
  agentType?: string;
  toolName?: string;
}

const runtimeSessions = new Map<string, RuntimeSessionState>();
const runtimeTasks = new Map<string, RuntimeTaskState>();
const runtimeTaskAbortControllers = new Map<string, AbortController>();
const runtimeSessionToolState = new Map<string, Map<string, unknown>>();

const MAX_TASK_OUTPUT_LINES = 2_000;

function now() {
  return Date.now();
}

function isTerminal(status: TaskStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'killed';
}

function sortByRecent(tasks: RuntimeTaskState[]): RuntimeTaskState[] {
  return tasks.sort((a, b) => {
    const aTime = a.endTime ?? a.startTime;
    const bTime = b.endTime ?? b.startTime;
    return bTime - aTime;
  });
}

export function createRuntimeSession(sessionId?: string): RuntimeSessionState {
  const requestedId = sessionId?.trim();

  if (requestedId && runtimeSessions.has(requestedId)) {
    const existing = runtimeSessions.get(requestedId)!;
    existing.updatedAt = now();
    return existing;
  }

  const id = requestedId || `session-${generateId()}`;
  const created: RuntimeSessionState = {
    id,
    createdAt: now(),
    updatedAt: now(),
    taskIds: [],
  };

  runtimeSessions.set(id, created);

  if (!runtimeSessionToolState.has(id)) {
    runtimeSessionToolState.set(id, new Map());
  }

  return created;
}

export function getRuntimeSession(sessionId: string): RuntimeSessionState | undefined {
  return runtimeSessions.get(sessionId);
}

export function listRuntimeSessions(): RuntimeSessionState[] {
  return [...runtimeSessions.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function touchRuntimeSession(sessionId: string): void {
  const session = runtimeSessions.get(sessionId);

  if (session) {
    session.updatedAt = now();
  }
}

export function setRuntimeSessionToolState(sessionId: string, key: string, value: unknown): void {
  const session = createRuntimeSession(sessionId);
  let state = runtimeSessionToolState.get(session.id);

  if (!state) {
    state = new Map<string, unknown>();
    runtimeSessionToolState.set(session.id, state);
  }

  if (value === undefined) {
    state.delete(key);
  } else {
    state.set(key, value);
  }

  touchRuntimeSession(session.id);
}

export function getRuntimeSessionToolState<T = unknown>(sessionId: string, key: string): T | undefined {
  const state = runtimeSessionToolState.get(sessionId);

  if (!state) {
    return undefined;
  }

  return state.get(key) as T | undefined;
}

export function createRuntimeTask(input: CreateRuntimeTaskInput): RuntimeTaskState {
  const session = createRuntimeSession(input.sessionId);

  const task: RuntimeTaskState = {
    id: `task-${generateId()}`,
    sessionId: session.id,
    type: input.type,
    kind: input.kind,
    status: 'pending',
    description: input.description,
    startTime: now(),
    output: [],
    notified: false,
    agentType: input.agentType,
    toolName: input.toolName,
  };

  runtimeTasks.set(task.id, task);
  session.taskIds.unshift(task.id);
  touchRuntimeSession(session.id);

  return task;
}

export function updateRuntimeTask(taskId: string, update: Partial<RuntimeTaskState>): RuntimeTaskState | undefined {
  const task = runtimeTasks.get(taskId);

  if (!task) {
    return undefined;
  }

  Object.assign(task, update);

  if (update.status && isTerminal(update.status)) {
    task.endTime = task.endTime ?? now();
  }

  touchRuntimeSession(task.sessionId);
  return task;
}

export function appendRuntimeTaskOutput(taskId: string, line: string): RuntimeTaskState | undefined {
  const task = runtimeTasks.get(taskId);

  if (!task) {
    return undefined;
  }

  if (line.trim().length > 0) {
    task.output.push(line);

    if (task.output.length > MAX_TASK_OUTPUT_LINES) {
      task.output = task.output.slice(task.output.length - MAX_TASK_OUTPUT_LINES);
    }
  }

  touchRuntimeSession(task.sessionId);
  return task;
}

export function getRuntimeTask(taskId: string): RuntimeTaskState | undefined {
  return runtimeTasks.get(taskId);
}

export function listRuntimeTasks(input?: {
  sessionId?: string;
  status?: TaskStatus;
  kind?: RuntimeTaskKind;
}): RuntimeTaskState[] {
  let tasks = [...runtimeTasks.values()];

  if (input?.sessionId) {
    tasks = tasks.filter((task) => task.sessionId === input.sessionId);
  }

  if (input?.status) {
    tasks = tasks.filter((task) => task.status === input.status);
  }

  if (input?.kind) {
    tasks = tasks.filter((task) => task.kind === input.kind);
  }

  return sortByRecent(tasks);
}

export function setRuntimeTaskAbortController(taskId: string, controller: AbortController): void {
  runtimeTaskAbortControllers.set(taskId, controller);
}

export function getRuntimeTaskAbortController(taskId: string): AbortController | undefined {
  return runtimeTaskAbortControllers.get(taskId);
}

export function clearRuntimeTaskAbortController(taskId: string): void {
  runtimeTaskAbortControllers.delete(taskId);
}

export function abortRuntimeTask(taskId: string, reason = 'Task aborted by user'): RuntimeTaskState | undefined {
  const task = runtimeTasks.get(taskId);

  if (!task) {
    return undefined;
  }

  const controller = runtimeTaskAbortControllers.get(taskId);
  if (controller) {
    controller.abort(reason);
    runtimeTaskAbortControllers.delete(taskId);
  }

  task.status = 'killed';
  task.error = reason;
  task.endTime = now();
  touchRuntimeSession(task.sessionId);

  return task;
}

export function findRunningTaskByAgentId(agentId: string): RuntimeTaskState | undefined {
  return [...runtimeTasks.values()]
    .filter((task) => task.agentId === agentId && (task.status === 'running' || task.status === 'pending'))
    .sort((a, b) => b.startTime - a.startTime)[0];
}
