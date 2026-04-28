/**
 * Tasks API Route
 * GET/POST: List tasks, inspect task output, stop running tasks, proxy RemoteTrigger actions,
 * and manage pending ask_user_question approvals for server-runtime executions.
 */

import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import {
  abortRuntimeExecution,
  getRuntimeTaskOutput,
  getRuntimeTaskSnapshot,
  listRuntimeTasksSnapshot,
} from '~/lib/.server/agent-runtime/orchestrator';
import {
  getPendingQuestionRequestsList,
  submitPendingQuestionAnswers,
  type AskUserQuestionResponse,
} from '~/lib/agentic/stores';

interface RemoteTriggerRequestBody {
  action: 'list' | 'get' | 'create' | 'update' | 'run';
  trigger_id?: string;
  body?: Record<string, unknown>;
}

interface TaskRouteRequestBody {
  action?: 'list' | 'get' | 'output' | 'abort' | 'remote_trigger' | 'questions' | 'question_submit';
  sessionId?: string;
  taskId?: string;
  agentId?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'killed';
  offset?: number;
  limit?: number;
  remoteTrigger?: RemoteTriggerRequestBody;
  requestId?: string;
  answers?: AskUserQuestionResponse['answers'];
}

interface RemoteTriggerActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  status: number;
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function resolveRemoteTriggerApiBase(context: ActionFunctionArgs['context'] | LoaderFunctionArgs['context']): string {
  const cloudflareEnv = (context.cloudflare?.env || {}) as unknown as Record<string, string | undefined>;
  const nodeEnv = typeof process !== 'undefined' ? process.env : {};

  const configured =
    cloudflareEnv.CLAUDE_API_BASE_URL ||
    cloudflareEnv.REMOTE_TRIGGER_API_BASE_URL ||
    nodeEnv.CLAUDE_API_BASE_URL ||
    nodeEnv.REMOTE_TRIGGER_API_BASE_URL;

  return typeof configured === 'string' && configured.trim().length > 0
    ? configured.trim().replace(/\/$/, '')
    : 'https://api.claude.ai';
}

function resolveRemoteTriggerAuthToken(
  context: ActionFunctionArgs['context'] | LoaderFunctionArgs['context'],
): string | undefined {
  const cloudflareEnv = (context.cloudflare?.env || {}) as unknown as Record<string, string | undefined>;
  const nodeEnv = typeof process !== 'undefined' ? process.env : {};

  const token =
    cloudflareEnv.CLAUDE_CODE_OAUTH_TOKEN ||
    cloudflareEnv.CLAUDE_OAUTH_TOKEN ||
    cloudflareEnv.CLAUDE_API_KEY ||
    nodeEnv.CLAUDE_CODE_OAUTH_TOKEN ||
    nodeEnv.CLAUDE_OAUTH_TOKEN ||
    nodeEnv.CLAUDE_API_KEY;

  if (typeof token !== 'string') {
    return undefined;
  }

  const trimmed = token.trim();

  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveRemoteTriggerHeaders(token: string): HeadersInit {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function safeParseResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    try {
      return await response.text();
    } catch {
      return undefined;
    }
  }
}

function toRemoteTriggerRoute(
  action: RemoteTriggerRequestBody['action'],
  triggerId?: string,
): { method: 'GET' | 'POST'; path: string } {
  const encodedTriggerId = triggerId ? encodeURIComponent(triggerId) : '';

  switch (action) {
    case 'list': {
      return { method: 'GET', path: '/v1/code/triggers' };
    }
    case 'get': {
      return { method: 'GET', path: `/v1/code/triggers/${encodedTriggerId}` };
    }
    case 'create': {
      return { method: 'POST', path: '/v1/code/triggers' };
    }
    case 'update': {
      return { method: 'POST', path: `/v1/code/triggers/${encodedTriggerId}` };
    }
    case 'run': {
      return { method: 'POST', path: `/v1/code/triggers/${encodedTriggerId}/run` };
    }
    default: {
      return { method: 'GET', path: '/v1/code/triggers' };
    }
  }
}

function validateRemoteTriggerRequest(input: RemoteTriggerRequestBody | undefined): string | undefined {
  if (!input) {
    return 'Missing remoteTrigger payload.';
  }

  if (!['list', 'get', 'create', 'update', 'run'].includes(input.action)) {
    return `Unsupported remote trigger action: ${String(input.action)}`;
  }

  if ((input.action === 'get' || input.action === 'update' || input.action === 'run') && !input.trigger_id) {
    return `remoteTrigger.trigger_id is required for action '${input.action}'.`;
  }

  if ((input.action === 'create' || input.action === 'update') && (!input.body || typeof input.body !== 'object')) {
    return `remoteTrigger.body is required for action '${input.action}'.`;
  }

  return undefined;
}

async function executeRemoteTriggerAction(
  input: RemoteTriggerRequestBody,
  context: ActionFunctionArgs['context'] | LoaderFunctionArgs['context'],
  abortSignal?: AbortSignal,
): Promise<RemoteTriggerActionResult> {
  const validationError = validateRemoteTriggerRequest(input);

  if (validationError) {
    return {
      success: false,
      status: 400,
      error: validationError,
    };
  }

  const token = resolveRemoteTriggerAuthToken(context);

  if (!token) {
    return {
      success: false,
      status: 401,
      error: 'RemoteTrigger auth token is missing. Set CLAUDE_CODE_OAUTH_TOKEN, CLAUDE_OAUTH_TOKEN, or CLAUDE_API_KEY.',
    };
  }

  const baseUrl = resolveRemoteTriggerApiBase(context);
  const route = toRemoteTriggerRoute(input.action, input.trigger_id);
  const url = `${baseUrl}${route.path}`;

  try {
    const response = await fetch(url, {
      method: route.method,
      headers: resolveRemoteTriggerHeaders(token),
      body: route.method === 'POST' ? JSON.stringify(input.body || {}) : undefined,
      signal: abortSignal,
    });

    const payload = await safeParseResponseBody(response);

    if (!response.ok) {
      const errorMessage =
        typeof payload === 'object' && payload && 'error' in payload
          ? String((payload as { error?: unknown }).error)
          : `RemoteTrigger ${input.action} failed with status ${response.status}`;

      return {
        success: false,
        status: response.status,
        error: errorMessage,
        data: payload,
      };
    }

    return {
      success: true,
      status: response.status,
      data: payload,
    };
  } catch (error: any) {
    return {
      success: false,
      status: 502,
      error: error?.message || 'RemoteTrigger request failed',
    };
  }
}

function toRemoteTriggerResponse(result: RemoteTriggerActionResult) {
  if (!result.success) {
    return json(
      {
        success: false,
        error: result.error || 'RemoteTrigger request failed',
        data: result.data,
      },
      { status: result.status },
    );
  }

  return json(
    {
      success: true,
      data: result.data,
    },
    { status: result.status },
  );
}

function listPendingQuestionRequestsResponse() {
  const requests = getPendingQuestionRequestsList().filter((request) => request.status === 'pending');

  return json({
    success: true,
    requests,
    count: requests.length,
  });
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'list';

  if (action === 'list') {
    const sessionId = url.searchParams.get('sessionId') || undefined;
    const status = (url.searchParams.get('status') || undefined) as TaskRouteRequestBody['status'];

    const tasks = listRuntimeTasksSnapshot({ sessionId, status });

    return json({
      success: true,
      tasks,
      count: tasks.length,
      active: tasks.filter((task) => task.status === 'running').length,
      completed: tasks.filter((task) => task.status === 'completed').length,
      failed: tasks.filter((task) => task.status === 'failed').length,
      killed: tasks.filter((task) => task.status === 'killed').length,
    });
  }

  if (action === 'get') {
    const taskId = url.searchParams.get('taskId') || '';

    if (!taskId) {
      return json({ success: false, error: 'Missing required query parameter: taskId' }, { status: 400 });
    }

    const task = getRuntimeTaskSnapshot(taskId);

    if (!task) {
      return json({ success: false, error: `Task '${taskId}' not found` }, { status: 404 });
    }

    return json({ success: true, task });
  }

  if (action === 'output') {
    const taskId = url.searchParams.get('taskId') || '';

    if (!taskId) {
      return json({ success: false, error: 'Missing required query parameter: taskId' }, { status: 400 });
    }

    const output = getRuntimeTaskOutput(
      taskId,
      parsePositiveInt(url.searchParams.get('offset'), 0),
      Math.max(1, parsePositiveInt(url.searchParams.get('limit'), 200)),
    );

    if (output.status === 'not_found') {
      return json({ success: false, error: `Task '${taskId}' not found`, ...output }, { status: 404 });
    }

    return json({ success: true, ...output });
  }

  if (action === 'questions') {
    return listPendingQuestionRequestsResponse();
  }

  if (action === 'remote_trigger') {
    const remoteAction = (url.searchParams.get('remote_action') || 'list') as RemoteTriggerRequestBody['action'];
    const triggerId = url.searchParams.get('trigger_id') || undefined;

    const result = await executeRemoteTriggerAction(
      {
        action: remoteAction,
        trigger_id: triggerId,
      },
      context,
      request.signal,
    );

    return toRemoteTriggerResponse(result);
  }

  return json({ success: false, error: `Unsupported action: ${action}` }, { status: 400 });
}

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, { status: 405 });
  }

  let body: TaskRouteRequestBody;

  try {
    body = (await request.json()) as TaskRouteRequestBody;
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const actionType = body.action || 'list';

  try {
    if (actionType === 'list') {
      const tasks = listRuntimeTasksSnapshot({
        sessionId: body.sessionId,
        status: body.status,
      });

      return json({
        success: true,
        tasks,
        count: tasks.length,
      });
    }

    if (actionType === 'get') {
      if (!body.taskId) {
        return json({ success: false, error: 'Missing required field: taskId' }, { status: 400 });
      }

      const task = getRuntimeTaskSnapshot(body.taskId);

      if (!task) {
        return json({ success: false, error: `Task '${body.taskId}' not found` }, { status: 404 });
      }

      return json({ success: true, task });
    }

    if (actionType === 'output') {
      if (!body.taskId) {
        return json({ success: false, error: 'Missing required field: taskId' }, { status: 400 });
      }

      const output = getRuntimeTaskOutput(body.taskId, body.offset ?? 0, body.limit ?? 200);

      if (output.status === 'not_found') {
        return json({ success: false, error: `Task '${body.taskId}' not found`, ...output }, { status: 404 });
      }

      return json({ success: true, ...output });
    }

    if (actionType === 'abort') {
      const abortResult = abortRuntimeExecution({
        taskId: body.taskId,
        agentId: body.agentId,
      });

      return json(abortResult, { status: abortResult.success ? 200 : 404 });
    }

    if (actionType === 'questions') {
      return listPendingQuestionRequestsResponse();
    }

    if (actionType === 'question_submit') {
      if (!body.requestId) {
        return json({ success: false, error: 'Missing required field: requestId' }, { status: 400 });
      }

      if (!Array.isArray(body.answers)) {
        return json({ success: false, error: 'Missing required field: answers' }, { status: 400 });
      }

      const submitResult = submitPendingQuestionAnswers(body.requestId, {
        answers: body.answers,
        submittedAt: Date.now(),
      });

      if (!submitResult.ok) {
        return json({ success: false, error: submitResult.error || 'Failed to submit answers' }, { status: 400 });
      }

      return json({
        success: true,
        requestId: body.requestId,
      });
    }

    if (actionType === 'remote_trigger') {
      const result = await executeRemoteTriggerAction(
        body.remoteTrigger as RemoteTriggerRequestBody,
        context,
        request.signal,
      );
      return toRemoteTriggerResponse(result);
    }

    return json({ success: false, error: `Unsupported action: ${actionType}` }, { status: 400 });
  } catch (error: any) {
    return json({ success: false, error: error?.message || 'Task runtime request failed' }, { status: 500 });
  }
}
