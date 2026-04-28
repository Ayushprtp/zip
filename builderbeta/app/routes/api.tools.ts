/**
 * Tools API Route
 * GET: List all registered tools from the agentic system
 * POST: Execute a tool in backend runtime (server-authoritative)
 */

import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import {
  assignTemplateTags,
  buildTemplateFromSnapshot,
  clearPreferredTemplate,
  createSandboxSnapshot,
  flushAutoSnapshot,
  getPreferredTemplate,
  getSnapshotMetadata,
  getStoredSnapshotId,
  getTemplateTags,
  listSandboxSnapshots,
  removeTemplateTags,
  restoreSandboxFromSnapshot,
  setE2BApiKeyOverride,
  setPreferredTemplate,
  setPreferredTemplateOverride,
  templateExists,
} from '~/lib/e2b/sandbox';
import {
  executeRuntimeTool,
  listRegisteredTools,
  listRuntimeEventsSnapshot,
  type RuntimeEnvironmentConfig,
} from '~/lib/.server/agent-runtime/orchestrator';
import {
  getBrowserExtensionBridgeSessionSnapshot,
  markBrowserExtensionBridgeSeen,
  pullNextBrowserExtensionCommand,
  rejectBrowserExtensionCommandResult,
  resolveBrowserExtensionCommandResult,
  type BrowserExtensionCommandResult,
} from '~/lib/agentic/browser-extension-bridge';
import type { PermissionPolicyConfig } from '~/lib/agentic/types';

interface RuntimeContextOverrides {
  browserServerUrl?: string;
  browserServerApiKey?: string;
  previewBaseUrls?: string[];
  browserExtensionBridgeSessionId?: string;
  browserExtensionName?: string;
}

type RuntimeToolActionType =
  | 'execute'
  | 'events'
  | 'snapshot_create'
  | 'snapshot_flush'
  | 'snapshot_list'
  | 'snapshot_restore'
  | 'snapshot_metadata'
  | 'template_get_preferred'
  | 'template_set_preferred'
  | 'template_clear_preferred'
  | 'template_exists'
  | 'template_list_tags'
  | 'template_assign_tags'
  | 'template_remove_tags'
  | 'template_build_from_snapshot'
  | 'browser_extension_pull'
  | 'browser_extension_resolve'
  | 'browser_extension_reject'
  | 'browser_extension_seen'
  | 'browser_extension_snapshot';

interface RuntimeToolRequestBody {
  action?: RuntimeToolActionType;
  sessionId?: string;
  toolName?: string;
  input?: Record<string, unknown>;
  description?: string;
  model?: string;
  runInBackground?: boolean;
  workDir?: string;
  parentAgentId?: string;
  permissionPolicy?: PermissionPolicyConfig;
  afterEventId?: string;
  limit?: number;
  browserServerUrl?: string;
  browserServerApiKey?: string;
  previewBaseUrls?: string[];
  browserExtensionBridgeSessionId?: string;
  browserExtensionName?: string;
  runtimeContext?: RuntimeContextOverrides;
  reason?: string;
  snapshotId?: string;
  templateId?: string;
  templateName?: string;
  tags?: string[] | string;
  resetSandbox?: boolean;
  bridgeSessionId?: string;
  commandId?: string;
  result?: Record<string, unknown>;
  error?: string;
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
    cloudflareEnv.E2B_API_KEY ||
    cloudflareEnv.VITE_E2B_API_KEY ||
    nodeEnv.E2B_API_KEY ||
    nodeEnv.VITE_E2B_API_KEY;

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

function applyE2BRuntimeConfig(
  context: ActionFunctionArgs['context'] | LoaderFunctionArgs['context'],
): void {
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
        .map((value) => value.trim())
        .filter(Boolean) ||
      cloudflareEnv.PREVIEW_BASE_URLS?.split(',')
        .map((value) => value.trim())
        .filter(Boolean) ||
      nodeEnv.BROWSER_PREVIEW_BASE_URLS?.split(',')
        .map((value) => value.trim())
        .filter(Boolean) ||
      nodeEnv.PREVIEW_BASE_URLS?.split(',')
        .map((value) => value.trim())
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

function resolveRuntimeContextOverrides(body: RuntimeToolRequestBody): RuntimeContextOverrides | undefined {
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

function normalizeTags(tags: RuntimeToolRequestBody['tags']): string[] {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  applyE2BRuntimeConfig(context);

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'list';

  if (action === 'list') {
    const tools = listRegisteredTools();

    return json({
      success: true,
      tools,
      count: tools.length,
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

  if (action === 'snapshot_metadata') {
    const metadata = getSnapshotMetadata();

    return json({
      success: true,
      metadata,
      preferredTemplate: getPreferredTemplate(),
      storedSnapshotId: getStoredSnapshotId(),
    });
  }

  if (action === 'snapshot_list') {
    const snapshots = await listSandboxSnapshots(parsePositiveInt(url.searchParams.get('limit'), 50));

    return json({
      success: true,
      count: snapshots.length,
      snapshots,
    });
  }

  if (action === 'template_get_preferred') {
    return json({
      success: true,
      templateId: getPreferredTemplate(),
    });
  }

  if (action === 'template_exists') {
    const templateName = (url.searchParams.get('templateName') || '').trim();

    if (!templateName) {
      return json({ success: false, error: 'Missing required query parameter: templateName' }, { status: 400 });
    }

    const exists = await templateExists(templateName);

    return json({
      success: true,
      templateName,
      exists,
    });
  }

  if (action === 'template_list_tags') {
    const templateId = (url.searchParams.get('templateId') || '').trim();

    if (!templateId) {
      return json({ success: false, error: 'Missing required query parameter: templateId' }, { status: 400 });
    }

    const tags = await getTemplateTags(templateId);

    return json({
      success: true,
      templateId,
      count: tags.length,
      tags,
    });
  }

  if (action === 'browser_extension_pull') {
    const bridgeSessionId = (url.searchParams.get('bridgeSessionId') || '').trim();

    if (!bridgeSessionId) {
      return json({ success: false, error: 'Missing required query parameter: bridgeSessionId' }, { status: 400 });
    }

    markBrowserExtensionBridgeSeen(bridgeSessionId);
    const command = pullNextBrowserExtensionCommand(bridgeSessionId);

    return json({
      success: true,
      bridgeSessionId,
      hasCommand: Boolean(command),
      command: command || null,
    });
  }

  if (action === 'browser_extension_snapshot') {
    const bridgeSessionId = (url.searchParams.get('bridgeSessionId') || '').trim();

    if (!bridgeSessionId) {
      return json({ success: false, error: 'Missing required query parameter: bridgeSessionId' }, { status: 400 });
    }

    const snapshot = getBrowserExtensionBridgeSessionSnapshot(bridgeSessionId);

    return json({
      success: true,
      bridgeSessionId,
      snapshot: snapshot || null,
    });
  }

  return json({ success: false, error: `Unsupported action: ${action}` }, { status: 400 });
}

export async function action({ request, context }: ActionFunctionArgs) {
  applyE2BRuntimeConfig(context);

  if (request.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed' }, { status: 405 });
  }

  let body: RuntimeToolRequestBody;

  try {
    body = (await request.json()) as RuntimeToolRequestBody;
  } catch {
    return json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const actionType: RuntimeToolActionType = body.action || 'execute';
  const runtimeContextOverrides = resolveRuntimeContextOverrides(body);

  try {
    if (actionType === 'execute') {
      if (!body.toolName) {
        return json({ success: false, error: 'Missing required field: toolName' }, { status: 400 });
      }

      const result = await executeRuntimeTool(
        {
          sessionId: body.sessionId,
          toolName: body.toolName,
          input: body.input || {},
          description: body.description,
          model: body.model,
          runInBackground: Boolean(body.runInBackground),
          workDir: body.workDir,
          parentAgentId: body.parentAgentId,
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

    if (actionType === 'browser_extension_pull') {
      const bridgeSessionId = resolveBridgeSessionIdFromRequest(body);

      if (!bridgeSessionId) {
        return json({ success: false, error: 'Missing required field: bridgeSessionId' }, { status: 400 });
      }

      markBrowserExtensionBridgeSeen(bridgeSessionId);
      const command = pullNextBrowserExtensionCommand(bridgeSessionId);

      return json({
        success: true,
        bridgeSessionId,
        hasCommand: Boolean(command),
        command: command || null,
      });
    }

    if (actionType === 'browser_extension_seen') {
      const bridgeSessionId = resolveBridgeSessionIdFromRequest(body);

      if (!bridgeSessionId) {
        return json({ success: false, error: 'Missing required field: bridgeSessionId' }, { status: 400 });
      }

      markBrowserExtensionBridgeSeen(bridgeSessionId);
      const snapshot = getBrowserExtensionBridgeSessionSnapshot(bridgeSessionId);

      return json({
        success: true,
        bridgeSessionId,
        snapshot: snapshot || null,
      });
    }

    if (actionType === 'browser_extension_snapshot') {
      const bridgeSessionId = resolveBridgeSessionIdFromRequest(body);

      if (!bridgeSessionId) {
        return json({ success: false, error: 'Missing required field: bridgeSessionId' }, { status: 400 });
      }

      const snapshot = getBrowserExtensionBridgeSessionSnapshot(bridgeSessionId);

      return json({
        success: true,
        bridgeSessionId,
        snapshot: snapshot || null,
      });
    }

    if (actionType === 'browser_extension_resolve') {
      const bridgeSessionId = resolveBridgeSessionIdFromRequest(body);
      const commandId = body.commandId?.trim() || '';

      if (!bridgeSessionId) {
        return json({ success: false, error: 'Missing required field: bridgeSessionId' }, { status: 400 });
      }

      if (!commandId) {
        return json({ success: false, error: 'Missing required field: commandId' }, { status: 400 });
      }

      if (!body.result || typeof body.result !== 'object') {
        return json({ success: false, error: 'Missing required field: result' }, { status: 400 });
      }

      const resolved = resolveBrowserExtensionCommandResult({
        bridgeSessionId,
        commandId,
        result: body.result as unknown as BrowserExtensionCommandResult,
      });

      if (!resolved) {
        return json(
          { success: false, error: `Command '${commandId}' not found for bridge session '${bridgeSessionId}'.` },
          { status: 404 },
        );
      }

      return json({
        success: true,
        bridgeSessionId,
        commandId,
      });
    }

    if (actionType === 'browser_extension_reject') {
      const bridgeSessionId = resolveBridgeSessionIdFromRequest(body);
      const commandId = body.commandId?.trim() || '';
      const error = body.error?.trim() || '';

      if (!bridgeSessionId) {
        return json({ success: false, error: 'Missing required field: bridgeSessionId' }, { status: 400 });
      }

      if (!commandId) {
        return json({ success: false, error: 'Missing required field: commandId' }, { status: 400 });
      }

      if (!error) {
        return json({ success: false, error: 'Missing required field: error' }, { status: 400 });
      }

      const rejected = rejectBrowserExtensionCommandResult({
        bridgeSessionId,
        commandId,
        error,
      });

      if (!rejected) {
        return json(
          { success: false, error: `Command '${commandId}' not found for bridge session '${bridgeSessionId}'.` },
          { status: 404 },
        );
      }

      return json({
        success: true,
        bridgeSessionId,
        commandId,
      });
    }

    if (actionType === 'snapshot_create') {
      const snapshot = await createSandboxSnapshot(body.reason?.trim() || 'api_manual');

      return json({
        success: true,
        snapshot,
      });
    }

    if (actionType === 'snapshot_flush') {
      const snapshot = await flushAutoSnapshot(body.reason?.trim() || 'api_flush');

      return json({
        success: true,
        snapshot,
      });
    }

    if (actionType === 'snapshot_list') {
      const snapshots = await listSandboxSnapshots(typeof body.limit === 'number' ? body.limit : 50);

      return json({
        success: true,
        count: snapshots.length,
        snapshots,
      });
    }

    if (actionType === 'snapshot_restore') {
      const restored = await restoreSandboxFromSnapshot(body.snapshotId);

      return json({
        success: true,
        sandboxId: restored.sandboxId,
        snapshotId: body.snapshotId || getStoredSnapshotId(),
      });
    }

    if (actionType === 'snapshot_metadata') {
      const metadata = getSnapshotMetadata();

      return json({
        success: true,
        metadata,
        preferredTemplate: getPreferredTemplate(),
      });
    }

    if (actionType === 'template_get_preferred') {
      return json({
        success: true,
        templateId: getPreferredTemplate(),
      });
    }

    if (actionType === 'template_set_preferred') {
      const normalizedTemplateId = body.templateId?.trim() || null;

      setPreferredTemplate(normalizedTemplateId, {
        resetSandbox: Boolean(body.resetSandbox),
      });

      return json({
        success: true,
        templateId: getPreferredTemplate(),
        resetSandbox: Boolean(body.resetSandbox),
      });
    }

    if (actionType === 'template_clear_preferred') {
      clearPreferredTemplate({
        resetSandbox: Boolean(body.resetSandbox),
      });

      return json({
        success: true,
        templateId: getPreferredTemplate(),
        resetSandbox: Boolean(body.resetSandbox),
      });
    }

    if (actionType === 'template_exists') {
      const templateName = body.templateName?.trim() || '';

      if (!templateName) {
        return json({ success: false, error: 'Missing required field: templateName' }, { status: 400 });
      }

      const exists = await templateExists(templateName);

      return json({
        success: true,
        templateName,
        exists,
      });
    }

    if (actionType === 'template_list_tags') {
      const templateId = body.templateId?.trim() || '';

      if (!templateId) {
        return json({ success: false, error: 'Missing required field: templateId' }, { status: 400 });
      }

      const tags = await getTemplateTags(templateId);

      return json({
        success: true,
        templateId,
        count: tags.length,
        tags,
      });
    }

    if (actionType === 'template_assign_tags') {
      const templateName = body.templateName?.trim() || '';
      const tags = normalizeTags(body.tags);

      if (!templateName) {
        return json({ success: false, error: 'Missing required field: templateName' }, { status: 400 });
      }

      if (tags.length === 0) {
        return json({ success: false, error: 'Missing required field: tags' }, { status: 400 });
      }

      const info = await assignTemplateTags(templateName, tags);

      return json({
        success: true,
        templateName,
        info,
      });
    }

    if (actionType === 'template_remove_tags') {
      const templateName = body.templateName?.trim() || '';
      const tags = normalizeTags(body.tags);

      if (!templateName) {
        return json({ success: false, error: 'Missing required field: templateName' }, { status: 400 });
      }

      if (tags.length === 0) {
        return json({ success: false, error: 'Missing required field: tags' }, { status: 400 });
      }

      await removeTemplateTags(templateName, tags);

      return json({
        success: true,
        templateName,
        removed: tags,
      });
    }

    if (actionType === 'template_build_from_snapshot') {
      const templateName = body.templateName?.trim() || '';
      const snapshotId = body.snapshotId?.trim() || getStoredSnapshotId();
      const tags = normalizeTags(body.tags);

      if (!templateName) {
        return json({ success: false, error: 'Missing required field: templateName' }, { status: 400 });
      }

      if (!snapshotId) {
        return json({ success: false, error: 'Missing required field: snapshotId' }, { status: 400 });
      }

      const build = await buildTemplateFromSnapshot(snapshotId, templateName, tags.length > 0 ? tags : undefined);

      return json({
        success: true,
        snapshotId,
        build,
      });
    }

    return json({ success: false, error: `Unsupported action: ${actionType}` }, { status: 400 });
  } catch (error: any) {
    return json({ success: false, error: error?.message || 'Tool runtime request failed' }, { status: 500 });
  }
}
