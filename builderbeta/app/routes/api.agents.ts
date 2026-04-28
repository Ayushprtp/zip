/**
 * Agent API Route
 * GET: List agents and runtime state snapshots
 * POST: Spawn/resume/abort runtime agents (server-authoritative)
 */

import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import {
  abortRuntimeExecution,
  getRuntimeAgentContinuation,
  getRuntimeAgentState,
  hasRuntimeAgentContinuation,
  listRegisteredAgents,
  listRuntimeAgentStates,
  listRuntimeEventsSnapshot,
  spawnRuntimeAgent,
  resumeRuntimeAgent,
  type RuntimeEnvironmentConfig,
} from '~/lib/.server/agent-runtime/orchestrator';
import { setE2BApiKeyOverride, setPreferredTemplateOverride } from '~/lib/e2b/sandbox';
import type { PermissionPolicyConfig } from '~/lib/agentic/types';

interface RuntimeContextOverrides {
  browserServerUrl?: string;
  browserServerApiKey?: string;
  previewBaseUrls?: string[];
  browserExtensionBridgeSessionId?: string;
  browserExtensionName?: string;
}

interface RuntimeRequestBody {
  action?: 'spawn' | 'resume' | 'abort' | 'status' | 'events';
  sessionId?: string;
  runInBackground?: boolean;
  model?: string;
  workDir?: string;
  permissionPolicy?: PermissionPolicyConfig;
  agentType?: string;
  prompt?: string;
  description?: string;
  parentAgentId?: string;
  agentId?: string;
  message?: string;
  taskId?: string;
  afterEventId?: string;
  limit?: number;
  browserServerUrl?: string;
  browserServerApiKey?: string;
  previewBaseUrls?: string[];
  browserExtensionBridgeSessionId?: string;
  browserExtensionName?: string;
  runtimeContext?: RuntimeContextOverrides;
}

interface E2BRuntimeConfig {
  apiKey?: string;
  templateId?: string;
}

function resolveE2BRuntimeConfig(
  context: ActionFunctionArgs['context'] | LoaderFunctionArgs['context'],
): E2BRuntimeConfig {
  const cloudflareEnv = (context.cloudflare?.env || {}) as unknown as Record<string, string | undefined>;
  const nodeEnv = typeof process !== 'undefined' ? process.env : {};

  const apiKey =
    cloudflareEnv.E2B_API_KEY || cloudflareEnv.VITE_E2B_API_KEY || nodeEnv.E2B_API_KEY || nodeEnv.VITE_E2B_API_KEY;

  const templateId =
    cloudflareEnv.E2B_TEMPLATE_ID ||
    cloudflareEnv.VITE_E2B_TEMPLATE_ID ||
    nodeEnv.E2B_TEMPLATE_ID ||
    nodeEnv.VITE_E2B_TEMPLATE_ID;

  return {
    apiKey: apiKey?.trim() || undefined,
    templateId: templateId?.trim() || undefined,
  };
}

function applyE2BRuntimeConfig(context: ActionFunctionArgs['context'] | LoaderFunctionArgs['context']): void {
  const runtimeConfig = resolveE2BRuntimeConfig(context);

  setE2BApiKeyOverride(runtimeConfig.apiKey || null);
  setPreferredTemplateOverride(runtimeConfig.templateId || null);
}

function toRuntimeEnv(
  context: ActionFunctionArgs['context'] | LoaderFunctionArgs['context'],
  overrides?: {
    model?: string;
    workDir?: string;
    browserServerUrl?: string;
    browserServerApiKey?: string;
    previewBaseUrls?: string[];
    browserExtensionBridgeSessionId?: string;
    browserExtensionName?: string;
  },
): RuntimeEnvironmentConfig {
  const cloudflareEnv = (context.cloudflare?.env || {}) as unknown as Record<string, string | undefined>;
  const nodeEnv = typeof process !== 'undefined' ? process.env : {};

  const extensionBridgeSessionId =
    overrides?.browserExtensionBridgeSessionId ||
    cloudflareEnv.BROWSER_EXTENSION_BRIDGE_SESSION_ID ||
    cloudflareEnv.VITE_BROWSER_EXTENSION_BRIDGE_SESSION_ID ||
    nodeEnv.BROWSER_EXTENSION_BRIDGE_SESSION_ID ||
    nodeEnv.VITE_BROWSER_EXTENSION_BRIDGE_SESSION_ID;

  const extensionName =
    overrides?.browserExtensionName ||
    cloudflareEnv.BROWSER_EXTENSION_NAME ||
    cloudflareEnv.VITE_BROWSER_EXTENSION_NAME ||
    nodeEnv.BROWSER_EXTENSION_NAME ||
    nodeEnv.VITE_BROWSER_EXTENSION_NAME;

  return {
    apiKey:
      cloudflareEnv.OPENAI_API_KEY ||
      cloudflareEnv.ANTHROPIC_API_KEY ||
      nodeEnv.OPENAI_API_KEY ||
      nodeEnv.VITE_OPENAI_API_KEY ||
      nodeEnv.ANTHROPIC_API_KEY,
    apiBaseUrl: cloudflareEnv.OPENAI_API_BASE_URL || nodeEnv.OPENAI_API_BASE_URL,
    model: overrides?.model,
    workDir: overrides?.workDir,
    browserServerUrl:
      overrides?.browserServerUrl ||
      cloudflareEnv.BROWSER_SERVER_URL ||
      cloudflareEnv.VITE_BROWSER_SERVER_URL ||
      nodeEnv.BROWSER_SERVER_URL ||
      nodeEnv.VITE_BROWSER_SERVER_URL,
    browserServerApiKey:
      overrides?.browserServerApiKey ||
      cloudflareEnv.BROWSER_SERVER_API_KEY ||
      cloudflareEnv.VITE_BROWSER_SERVER_API_KEY ||
      nodeEnv.BROWSER_SERVER_API_KEY ||
      nodeEnv.VITE_BROWSER_SERVER_API_KEY,
    previewBaseUrls:
      overrides?.previewBaseUrls ||
      cloudflareEnv.BROWSER_PREVIEW_BASE_URLS?.split(',')
        .map((value: string) => value.trim())
        .filter(Boolean) ||
      cloudflareEnv.PREVIEW_BASE_URLS?.split(',')
        .map((value: string) => value.trim())
        .filter(Boolean) ||
      nodeEnv.BROWSER_PREVIEW_BASE_URLS?.split(',')
        .map((value: string) => value.trim())
        .filter(Boolean) ||
      nodeEnv.PREVIEW_BASE_URLS?.split(',')
        .map((value: string) => value.trim())
        .filter(Boolean) ||
      [],
    browserExtensionBridgeSessionId:
      typeof extensionBridgeSessionId === 'string' && extensionBridgeSessionId.trim().length > 0
        ? extensionBridgeSessionId.trim()
        : undefined,
    browserExtensionName:
      typeof extensionName === 'string' && extensionName.trim().length > 0 ? extensionName.trim() : undefined,
  };
}

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function resolveBridgeSessionIdFromRequest(
  input: {
    bridgeSessionId?: string;
    runtimeContext?: RuntimeContextOverrides;
    browserExtensionBridgeSessionId?: string;
  },
): string | undefined {
  const candidates = [
    input.bridgeSessionId,
    input.runtimeContext?.browserExtensionBridgeSessionId,
    input.browserExtensionBridgeSessionId,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return undefined;
}

function resolveRuntimeContextOverrides(body: RuntimeRequestBody): RuntimeContextOverrides | undefined {
  const runtimeContext = body.runtimeContext;

  const browserServerUrl =
    typeof runtimeContext?.browserServerUrl === 'string' && runtimeContext.browserServerUrl.trim().length > 0
      ? runtimeContext.browserServerUrl.trim()
      : typeof body.browserServerUrl === 'string' && body.browserServerUrl.trim().length > 0
        ? body.browserServerUrl.trim()
        : undefined;

  const browserServerApiKey =
    typeof runtimeContext?.browserServerApiKey === 'string' && runtimeContext.browserServerApiKey.trim().length > 0
      ? runtimeContext.browserServerApiKey.trim()
      : typeof body.browserServerApiKey === 'string' && body.browserServerApiKey.trim().length > 0
        ? body.browserServerApiKey.trim()
        : undefined;

  const previewBaseUrls = Array.isArray(runtimeContext?.previewBaseUrls)
    ? runtimeContext.previewBaseUrls
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value): value is string => value.length > 0)
    : Array.isArray(body.previewBaseUrls)
      ? body.previewBaseUrls
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter((value): value is string => value.length > 0)
      : undefined;

  const browserExtensionBridgeSessionId = resolveBridgeSessionIdFromRequest({
    runtimeContext,
    browserExtensionBridgeSessionId: body.browserExtensionBridgeSessionId,
  });

  const browserExtensionName =
    typeof runtimeContext?.browserExtensionName === 'string' && runtimeContext.browserExtensionName.trim().length > 0
      ? runtimeContext.browserExtensionName.trim()
      : typeof body.browserExtensionName === 'string' && body.browserExtensionName.trim().length > 0
        ? body.browserExtensionName.trim()
        : undefined;

  if (
    !browserServerUrl &&
    !browserServerApiKey &&
    !previewBaseUrls?.length &&
    !browserExtensionBridgeSessionId &&
    !browserExtensionName
  ) {
    return undefined;
  }

  return {
    browserServerUrl,
    browserServerApiKey,
    previewBaseUrls,
    browserExtensionBridgeSessionId,
    browserExtensionName,
  };
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  applyE2BRuntimeConfig(context);

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'list';

  if (action === 'list') {
    const agents = listRegisteredAgents();
    const runtimeAgents = listRuntimeAgentStates();

    return json({
      success: true,
      agents,
      runtimeAgents,
      count: agents.length,
      active: runtimeAgents.filter((agent) => agent.status === 'running').length,
    });
  }

  if (action === 'status') {
    const agentId = url.searchParams.get('agentId') || '';

    if (!agentId) {
      return json({ success: false, error: 'Missing required query parameter: agentId' }, { status: 400 });
    }

    const agent = getRuntimeAgentState(agentId);

    if (!agent) {
      return json({ success: false, error: `Agent '${agentId}' not found` }, { status: 404 });
    }

    return json({
      success: true,
      agent,
      hasContinuation: hasRuntimeAgentContinuation(agentId),
      continuation: getRuntimeAgentContinuation(agentId),
    });
  }

  if (action === 'events') {
    const sessionId = url.searchParams.get('sessionId') || '';

    if (!sessionId) {
      return json({ success: false, error: 'Missing required query parameter: sessionId' }, { status: 400 });
    }

    const events = listRuntimeEventsSnapshot({
      sessionId,
      afterEventId: url.searchParams.get('afterEventId') || undefined,
      limit: parsePositiveInt(url.searchParams.get('limit'), 200),
    });

    return json({
      success: true,
      sessionId,
      count: events.length,
      events,
    });
  }

  return json({ success: false, error: `Unsupported action: ${action}` }, { status: 400 });
}

export async function action({ request, context }: ActionFunctionArgs) {
  applyE2BRuntimeConfig(context);

  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, { status: 405 });
  }

  let body: RuntimeRequestBody;

  try {
    body = (await request.json()) as RuntimeRequestBody;
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const actionType = body.action || 'spawn';
  const runtimeContextOverrides = resolveRuntimeContextOverrides(body);

  try {
    if (actionType === 'spawn') {
      if (!body.agentType || !body.prompt) {
        return json({ success: false, error: 'Missing required fields: agentType, prompt' }, { status: 400 });
      }

      const result = await spawnRuntimeAgent(
        {
          sessionId: body.sessionId,
          agentType: body.agentType,
          prompt: body.prompt,
          description: body.description,
          model: body.model,
          runInBackground: Boolean(body.runInBackground),
          parentAgentId: body.parentAgentId,
          workDir: body.workDir,
          permissionPolicy: body.permissionPolicy,
        },
        toRuntimeEnv(context, {
          model: body.model,
          workDir: body.workDir,
          browserServerUrl: runtimeContextOverrides?.browserServerUrl,
          browserServerApiKey: runtimeContextOverrides?.browserServerApiKey,
          previewBaseUrls: runtimeContextOverrides?.previewBaseUrls,
          browserExtensionBridgeSessionId: runtimeContextOverrides?.browserExtensionBridgeSessionId,
          browserExtensionName: runtimeContextOverrides?.browserExtensionName,
        }),
      );

      return json(
        {
          success: !result.error,
          ...result,
        },
        { status: result.error ? 500 : 200 },
      );
    }

    if (actionType === 'resume') {
      if (!body.agentId || !body.message) {
        return json({ success: false, error: 'Missing required fields: agentId, message' }, { status: 400 });
      }

      const result = await resumeRuntimeAgent(
        {
          sessionId: body.sessionId,
          agentId: body.agentId,
          message: body.message,
          description: body.description,
          runInBackground: Boolean(body.runInBackground),
          workDir: body.workDir,
          model: body.model,
          permissionPolicy: body.permissionPolicy,
        },
        toRuntimeEnv(context, {
          model: body.model,
          workDir: body.workDir,
          browserServerUrl: runtimeContextOverrides?.browserServerUrl,
          browserServerApiKey: runtimeContextOverrides?.browserServerApiKey,
          previewBaseUrls: runtimeContextOverrides?.previewBaseUrls,
          browserExtensionBridgeSessionId: runtimeContextOverrides?.browserExtensionBridgeSessionId,
          browserExtensionName: runtimeContextOverrides?.browserExtensionName,
        }),
      );

      return json(
        {
          success: !result.error,
          ...result,
        },
        { status: result.error ? 500 : 200 },
      );
    }

    if (actionType === 'abort') {
      const abortResult = abortRuntimeExecution({
        taskId: body.taskId,
        agentId: body.agentId,
      });

      return json(abortResult, { status: abortResult.success ? 200 : 404 });
    }

    if (actionType === 'status') {
      if (!body.agentId) {
        return json({ success: false, error: 'Missing required field: agentId' }, { status: 400 });
      }

      const agent = getRuntimeAgentState(body.agentId);

      if (!agent) {
        return json({ success: false, error: `Agent '${body.agentId}' not found` }, { status: 404 });
      }

      return json({
        success: true,
        agent,
        hasContinuation: hasRuntimeAgentContinuation(body.agentId),
        continuation: getRuntimeAgentContinuation(body.agentId),
      });
    }

    if (actionType === 'events') {
      if (!body.sessionId) {
        return json({ success: false, error: 'Missing required field: sessionId' }, { status: 400 });
      }

      const events = listRuntimeEventsSnapshot({
        sessionId: body.sessionId,
        afterEventId: body.afterEventId,
        limit: typeof body.limit === 'number' ? body.limit : 200,
      });

      return json({
        success: true,
        sessionId: body.sessionId,
        count: events.length,
        events,
      });
    }

    return json({ success: false, error: `Unsupported action: ${actionType}` }, { status: 400 });
  } catch (error: any) {
    return json({ success: false, error: error?.message || 'Agent runtime request failed' }, { status: 500 });
  }
}
