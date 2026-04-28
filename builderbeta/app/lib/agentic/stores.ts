/**
 * Agentic Stores (Nanostores)
 * Frontend state management for the agentic system.
 */

import { atom, map } from 'nanostores';
import type {
  AgentState,
  TaskState,
  MCPServerState,
  AgentDefinition,
  SkillDefinition,
  CoordinatorState,
} from './types';

export interface AskUserQuestionItem {
  id: string;
  prompt: string;
  options?: string[];
}

export interface AskUserQuestionRequest {
  id: string;
  taskId?: string;
  source: 'tool' | 'middleware' | 'executor';
  title?: string;
  instructions?: string;
  questions: AskUserQuestionItem[];
  createdAt: number;
  status: 'pending' | 'answered' | 'failed' | 'cancelled';
  response?: AskUserQuestionResponse;
  error?: string;
}

export interface AskUserQuestionResponse {
  answers: Array<{
    questionId: string;
    selectedOption?: string;
    freeText?: string;
  }>;
  submittedAt: number;
}

interface PendingQuestionWaiter {
  resolve: (value: AskUserQuestionResponse) => void;
  reject: (error: Error) => void;
}

// ─── Agent Store ─────────────────────────────────────────────────────

/** All active and recent agents */
export const agentsStore = map<Record<string, AgentState>>({});

/** Currently selected agent (for detail view) */
export const selectedAgentId = atom<string | null>(null);

export function addAgent(agent: AgentState) {
  agentsStore.setKey(agent.id, agent);
}

export function updateAgent(agentId: string, update: Partial<AgentState>) {
  const current = agentsStore.get()[agentId];
  if (current) {
    agentsStore.setKey(agentId, { ...current, ...update });
  }
}

export function getRunningAgents(): AgentState[] {
  return Object.values(agentsStore.get()).filter(a => a.status === 'running');
}

// ─── Task Store ──────────────────────────────────────────────────────

/** All active and recent tasks */
export const tasksStore = map<Record<string, TaskState>>({});

export function addTask(task: TaskState) {
  tasksStore.setKey(task.id, task);
}

export function updateTask(taskId: string, update: Partial<TaskState>) {
  const current = tasksStore.get()[taskId];
  if (current) {
    tasksStore.setKey(taskId, { ...current, ...update });
  }
}

export function getRunningTasks(): TaskState[] {
  return Object.values(tasksStore.get()).filter(t => t.status === 'running');
}

// ─── MCP Store ───────────────────────────────────────────────────────

/** Connected MCP servers */
export const mcpServersStore = map<Record<string, MCPServerState>>({});

export function setMCPServer(state: MCPServerState) {
  mcpServersStore.setKey(state.config.name, state);
}

export function removeMCPServer(name: string) {
  const current = { ...mcpServersStore.get() };
  delete current[name];
  mcpServersStore.set(current);
}

// ─── Registry Stores ────────────────────────────────────────────────

/** Available agent definitions */
export const agentDefinitionsStore = atom<AgentDefinition[]>([]);

/** Available skill definitions */
export const skillDefinitionsStore = atom<SkillDefinition[]>([]);

// ─── Coordinator Store ──────────────────────────────────────────────

/** Coordinator mode state */
export const coordinatorStore = atom<CoordinatorState>({
  isActive: false,
  workers: new Map(),
  completedResults: [],
});

export function setCoordinatorMode(active: boolean) {
  const current = coordinatorStore.get();
  coordinatorStore.set({ ...current, isActive: active });
}

// ─── UI State ────────────────────────────────────────────────────────

/** Whether the agent panel is visible */
export const showAgentPanel = atom<boolean>(false);

/** Whether coordinator mode is enabled */
export const isCoordinatorMode = atom<boolean>(false);

/** Active tool calls being displayed */
export const activeToolCalls = map<Record<string, {
  toolName: string;
  input: Record<string, unknown>;
  status: 'running' | 'completed' | 'failed';
  startTime: number;
  output?: unknown;
}>>({});

export function addActiveToolCall(id: string, toolName: string, input: Record<string, unknown>) {
  activeToolCalls.setKey(id, { toolName, input, status: 'running', startTime: Date.now() });
}

export function completeActiveToolCall(id: string, output: unknown, success: boolean) {
  const call = activeToolCalls.get()[id];
  if (call) {
    activeToolCalls.setKey(id, {
      ...call,
      status: success ? 'completed' : 'failed',
      output,
    });

    // Auto-remove completed calls after 10 seconds
    setTimeout(() => {
      const current = { ...activeToolCalls.get() };
      delete current[id];
      activeToolCalls.set(current);
    }, 10_000);
  }
}

// ─── Ask User Question / Approval State ─────────────────────────────

/** Pending and completed ask_user_question requests */
export const pendingQuestionRequests = map<Record<string, AskUserQuestionRequest>>({});

/** Latest answered response keyed by request id */
export const questionResponses = map<Record<string, AskUserQuestionResponse>>({});

/** Number of mounted UI consumers capable of presenting question prompts */
export const questionUiConsumerCount = atom<number>(0);

const pendingQuestionWaiters = new Map<string, PendingQuestionWaiter>();

export function registerQuestionUiConsumer(): () => void {
  questionUiConsumerCount.set(questionUiConsumerCount.get() + 1);

  return () => {
    questionUiConsumerCount.set(Math.max(0, questionUiConsumerCount.get() - 1));
  };
}

export function hasQuestionUiConsumer(): boolean {
  return questionUiConsumerCount.get() > 0;
}

export function addPendingQuestionRequest(request: AskUserQuestionRequest) {
  pendingQuestionRequests.setKey(request.id, request);
}

export function updatePendingQuestionRequest(requestId: string, update: Partial<AskUserQuestionRequest>) {
  const current = pendingQuestionRequests.get()[requestId];

  if (!current) {
    return;
  }

  pendingQuestionRequests.setKey(requestId, { ...current, ...update });
}

export function clearPendingQuestionRequest(requestId: string) {
  const current = { ...pendingQuestionRequests.get() };
  delete current[requestId];
  pendingQuestionRequests.set(current);

  pendingQuestionWaiters.delete(requestId);
}

export function getPendingQuestionRequest(requestId: string): AskUserQuestionRequest | undefined {
  return pendingQuestionRequests.get()[requestId];
}

export function getPendingQuestionRequestsList(): AskUserQuestionRequest[] {
  return Object.values(pendingQuestionRequests.get()).sort((a, b) => b.createdAt - a.createdAt);
}

export function hasPendingQuestionRequests(): boolean {
  return Object.values(pendingQuestionRequests.get()).some((request) => request.status === 'pending');
}

export function registerPendingQuestionWaiter(
  requestId: string,
  waiter: PendingQuestionWaiter,
): () => void {
  pendingQuestionWaiters.set(requestId, waiter);

  return () => {
    const current = pendingQuestionWaiters.get(requestId);

    if (current === waiter) {
      pendingQuestionWaiters.delete(requestId);
    }
  };
}

export function resolvePendingQuestion(
  requestId: string,
  response: AskUserQuestionResponse,
): boolean {
  const request = pendingQuestionRequests.get()[requestId];

  if (!request) {
    return false;
  }

  const nextRequest: AskUserQuestionRequest = {
    ...request,
    status: 'answered',
    response,
    error: undefined,
  };

  pendingQuestionRequests.setKey(requestId, nextRequest);
  questionResponses.setKey(requestId, response);

  const waiter = pendingQuestionWaiters.get(requestId);
  if (waiter) {
    pendingQuestionWaiters.delete(requestId);
    waiter.resolve(response);
  }

  return true;
}

export function submitPendingQuestionAnswers(
  requestId: string,
  response: AskUserQuestionResponse,
): { ok: boolean; error?: string } {
  const request = pendingQuestionRequests.get()[requestId];

  if (!request) {
    return { ok: false, error: `Question request '${requestId}' not found.` };
  }

  if (request.status !== 'pending') {
    return { ok: false, error: `Question request '${requestId}' is not pending.` };
  }

  const answerById = new Map(response.answers.map((answer) => [answer.questionId, answer]));

  for (const question of request.questions) {
    const answer = answerById.get(question.id);

    if (!answer) {
      return { ok: false, error: `Missing answer for question '${question.id}'.` };
    }

    const selectedOption = answer.selectedOption?.trim();
    const freeText = answer.freeText?.trim();

    if ((!selectedOption || selectedOption.length === 0) && (!freeText || freeText.length === 0)) {
      return { ok: false, error: `Question '${question.id}' requires an option or free-text answer.` };
    }

    if (question.options && selectedOption && !question.options.includes(selectedOption)) {
      return { ok: false, error: `Invalid option '${selectedOption}' for question '${question.id}'.` };
    }
  }

  const normalizedResponse: AskUserQuestionResponse = {
    answers: request.questions.map((question) => {
      const incoming = answerById.get(question.id)!;

      return {
        questionId: question.id,
        selectedOption: incoming.selectedOption?.trim() || undefined,
        freeText: incoming.freeText?.trim() || undefined,
      };
    }),
    submittedAt: response.submittedAt,
  };

  const resolved = resolvePendingQuestion(requestId, normalizedResponse);

  if (!resolved) {
    return { ok: false, error: `Failed to resolve question request '${requestId}'.` };
  }

  return { ok: true };
}

export function failPendingQuestion(requestId: string, error: string): boolean {
  const request = pendingQuestionRequests.get()[requestId];

  if (!request) {
    return false;
  }

  pendingQuestionRequests.setKey(requestId, {
    ...request,
    status: 'failed',
    error,
  });

  const waiter = pendingQuestionWaiters.get(requestId);
  if (waiter) {
    pendingQuestionWaiters.delete(requestId);
    waiter.reject(new Error(error));
  }

  return true;
}

// ─── Browser URL Approval State ──────────────────────────────────────

export interface BrowserUrlApprovalState {
  sessionApprovedOrigins: string[];
  allowedOnceUrls: string[];
}

const browserUrlApprovalBySession = map<Record<string, BrowserUrlApprovalState>>({});

const EMPTY_BROWSER_APPROVAL_STATE: BrowserUrlApprovalState = {
  sessionApprovedOrigins: [],
  allowedOnceUrls: [],
};

function ensureSessionBrowserApprovalState(sessionId: string): BrowserUrlApprovalState {
  const current = browserUrlApprovalBySession.get()[sessionId];

  if (current) {
    return current;
  }

  browserUrlApprovalBySession.setKey(sessionId, {
    sessionApprovedOrigins: [],
    allowedOnceUrls: [],
  });

  return browserUrlApprovalBySession.get()[sessionId] ?? {
    sessionApprovedOrigins: [],
    allowedOnceUrls: [],
  };
}

function normalizeOrigin(value: string): string | undefined {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function normalizeUrl(value: string): string | undefined {
  try {
    return new URL(value).href;
  } catch {
    return undefined;
  }
}

export function addSessionApprovedBrowserOrigin(sessionId: string, origin: string): boolean {
  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return false;
  }

  const state = ensureSessionBrowserApprovalState(sessionId);

  if (state.sessionApprovedOrigins.includes(normalizedOrigin)) {
    return true;
  }

  browserUrlApprovalBySession.setKey(sessionId, {
    ...state,
    sessionApprovedOrigins: [...state.sessionApprovedOrigins, normalizedOrigin],
  });

  return true;
}

export function addBrowserAllowedOnceUrl(sessionId: string, url: string): boolean {
  const normalizedUrl = normalizeUrl(url);

  if (!normalizedUrl) {
    return false;
  }

  const state = ensureSessionBrowserApprovalState(sessionId);

  if (state.allowedOnceUrls.includes(normalizedUrl)) {
    return true;
  }

  browserUrlApprovalBySession.setKey(sessionId, {
    ...state,
    allowedOnceUrls: [...state.allowedOnceUrls, normalizedUrl],
  });

  return true;
}

export function consumeBrowserAllowedOnceUrl(sessionId: string, url: string): boolean {
  const normalizedUrl = normalizeUrl(url);

  if (!normalizedUrl) {
    return false;
  }

  const state = browserUrlApprovalBySession.get()[sessionId];

  if (!state || !state.allowedOnceUrls.includes(normalizedUrl)) {
    return false;
  }

  browserUrlApprovalBySession.setKey(sessionId, {
    ...state,
    allowedOnceUrls: state.allowedOnceUrls.filter((candidate) => candidate !== normalizedUrl),
  });

  return true;
}

export function isBrowserOriginApprovedForSession(sessionId: string, origin: string): boolean {
  const normalizedOrigin = normalizeOrigin(origin);

  if (!normalizedOrigin) {
    return false;
  }

  const state = browserUrlApprovalBySession.get()[sessionId];
  return Boolean(state?.sessionApprovedOrigins.includes(normalizedOrigin));
}

export function getBrowserUrlApprovalState(sessionId: string): BrowserUrlApprovalState {
  return browserUrlApprovalBySession.get()[sessionId] ?? EMPTY_BROWSER_APPROVAL_STATE;
}

export function clearBrowserUrlApprovalState(sessionId: string): void {
  const current = { ...browserUrlApprovalBySession.get() };
  delete current[sessionId];
  browserUrlApprovalBySession.set(current);
}
