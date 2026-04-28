import type { Tool, ToolCallProgress, ToolResult, ToolUseContext } from '../types';
import {
  evaluateBrowserUrlScope,
  listPreviewBaseUrls,
  type BrowserUrlScopeEvaluation,
} from '../browser-url-scope';
import {
  addBrowserAllowedOnceUrl,
  addSessionApprovedBrowserOrigin,
  consumeBrowserAllowedOnceUrl,
} from '../stores';
import { enqueueBrowserExtensionCommand } from '../browser-extension-bridge';
import { AskUserQuestionTool } from './ask-user-question.tool';

export type BrowserAction =
  | 'navigate'
  | 'extract_text'
  | 'snapshot_html'
  | 'click'
  | 'tap'
  | 'type'
  | 'scroll'
  | 'wait_for'
  | 'capture_console'
  | 'capture_network';

export interface BrowserInput {
  action?: BrowserAction;
  url: string;
  max_chars?: number;
  selector?: string;
  text?: string;
  timeout_ms?: number;
  x?: number;
  y?: number;
  delta_x?: number;
  delta_y?: number;
  limit?: number;
}

export interface BrowserOutput {
  action: BrowserAction;
  requestedUrl: string;
  normalizedUrl: string;
  normalizedOrigin: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  title?: string;
  content: string;
  truncated: boolean;
  allowedBy: 'preview_scope' | 'session_origin' | 'allow_once';
}

type ApprovalDecision = 'allow_once' | 'allow_origin' | 'deny';

const DEFAULT_MAX_CHARS = 8_000;
const MAX_MAX_CHARS = 100_000;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_CAPTURE_LIMIT = 50;
const MAX_CAPTURE_LIMIT = 500;

function clampMaxChars(input?: number): number {
  if (!Number.isFinite(input)) {
    return DEFAULT_MAX_CHARS;
  }

  return Math.min(Math.max(Math.floor(input as number), 256), MAX_MAX_CHARS);
}

function clampTimeoutMs(input?: number): number {
  if (!Number.isFinite(input)) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(Math.max(Math.floor(input as number), 100), 120_000);
}

function clampCaptureLimit(input?: number): number {
  if (!Number.isFinite(input)) {
    return DEFAULT_CAPTURE_LIMIT;
  }

  return Math.min(Math.max(Math.floor(input as number), 1), MAX_CAPTURE_LIMIT);
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripScriptsAndStyles(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
}

function htmlToText(html: string): string {
  const withoutScripts = stripScriptsAndStyles(html);
  const withoutTags = withoutScripts.replace(/<[^>]+>/g, ' ');

  return collapseWhitespace(withoutTags);
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);

  if (!match?.[1]) {
    return undefined;
  }

  const title = collapseWhitespace(match[1].replace(/<[^>]+>/g, ' '));
  return title.length > 0 ? title : undefined;
}

function truncateContent(content: string, maxChars: number): { content: string; truncated: boolean } {
  if (content.length <= maxChars) {
    return { content, truncated: false };
  }

  return {
    content: `${content.slice(0, maxChars)}…`,
    truncated: true,
  };
}

function emitBrowserProgress(
  onProgress: ToolCallProgress | undefined,
  toolUseId: string,
  type: string,
  data: Record<string, unknown>,
): void {
  onProgress?.({
    toolUseId,
    type,
    data,
  });
}

function resolveAllowedBy(scope: {
  inPreviewScope: boolean;
  hasSessionApproval: boolean;
  hasAllowOnceApproval: boolean;
}): 'preview_scope' | 'session_origin' | 'allow_once' {
  if (scope.inPreviewScope) {
    return 'preview_scope';
  }

  if (scope.hasSessionApproval) {
    return 'session_origin';
  }

  return 'allow_once';
}

function resolveBrowserServerUrl(context: ToolUseContext): string | undefined {
  const explicit = context.browserServerUrl?.trim();

  if (explicit) {
    return explicit;
  }

  const env = typeof process !== 'undefined' ? process.env : {};
  const fromEnv = env.BROWSER_SERVER_URL || env.VITE_BROWSER_SERVER_URL;

  return typeof fromEnv === 'string' && fromEnv.trim().length > 0 ? fromEnv.trim() : undefined;
}

function resolveBrowserServerApiKey(context: ToolUseContext): string | undefined {
  const explicit = context.browserServerApiKey?.trim();

  if (explicit) {
    return explicit;
  }

  const env = typeof process !== 'undefined' ? process.env : {};
  const fromEnv = env.BROWSER_SERVER_API_KEY || env.VITE_BROWSER_SERVER_API_KEY;

  return typeof fromEnv === 'string' && fromEnv.trim().length > 0 ? fromEnv.trim() : undefined;
}

function resolveBrowserExtensionBridgeSessionId(context: ToolUseContext): string | undefined {
  const explicit = context.browserExtensionBridgeSessionId?.trim();

  if (explicit) {
    return explicit;
  }

  const env = typeof process !== 'undefined' ? process.env : {};
  const fromEnv = env.BROWSER_EXTENSION_BRIDGE_SESSION_ID || env.VITE_BROWSER_EXTENSION_BRIDGE_SESSION_ID;

  return typeof fromEnv === 'string' && fromEnv.trim().length > 0 ? fromEnv.trim() : undefined;
}

function resolveBrowserExtensionName(context: ToolUseContext): string | undefined {
  const explicit = context.browserExtensionName?.trim();

  if (explicit) {
    return explicit;
  }

  const env = typeof process !== 'undefined' ? process.env : {};
  const fromEnv = env.BROWSER_EXTENSION_NAME || env.VITE_BROWSER_EXTENSION_NAME;

  return typeof fromEnv === 'string' && fromEnv.trim().length > 0 ? fromEnv.trim() : undefined;
}

function buildBrowserServerHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

function ensureSelector(input: BrowserInput, action: BrowserAction): string {
  const selector = typeof input.selector === 'string' ? input.selector.trim() : '';

  if (!selector) {
    throw new Error(`Browser action '${action}' requires a non-empty selector`);
  }

  return selector;
}

function ensureText(input: BrowserInput): string {
  if (typeof input.text !== 'string') {
    throw new Error(`Browser action 'type' requires text`);
  }

  return input.text;
}

interface BrowserServerActionResult {
  status?: number;
  ok?: boolean;
  finalUrl?: string;
  title?: string;
  content?: string;
  html?: string;
  data?: unknown;
  logs?: unknown[];
  entries?: unknown[];
}

interface BrowserRuntimeActionResponse {
  success: boolean;
  data: BrowserServerActionResult;
  status: number;
  ok: boolean;
  finalUrl: string;
}

function buildBrowserServerPayload(args: {
  context: ToolUseContext;
  action: BrowserAction;
  scope: BrowserUrlScopeEvaluation;
  input: BrowserInput;
  timeoutMs: number;
  maxChars: number;
}): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    sessionId: args.context.sessionId,
    taskId: args.context.taskId,
    action: args.action,
    url: args.scope.normalizedUrl,
    timeoutMs: args.timeoutMs,
    maxChars: args.maxChars,
  };

  switch (args.action) {
    case 'click':
    case 'tap': {
      payload.selector = ensureSelector(args.input, args.action);
      break;
    }

    case 'type': {
      payload.selector = ensureSelector(args.input, args.action);
      payload.text = ensureText(args.input);
      break;
    }

    case 'scroll': {
      payload.selector = typeof args.input.selector === 'string' && args.input.selector.trim().length > 0
        ? args.input.selector.trim()
        : undefined;
      payload.x = Number.isFinite(args.input.x) ? Math.floor(args.input.x as number) : undefined;
      payload.y = Number.isFinite(args.input.y) ? Math.floor(args.input.y as number) : undefined;
      payload.deltaX = Number.isFinite(args.input.delta_x) ? Math.floor(args.input.delta_x as number) : undefined;
      payload.deltaY = Number.isFinite(args.input.delta_y) ? Math.floor(args.input.delta_y as number) : undefined;
      break;
    }

    case 'wait_for': {
      payload.selector = typeof args.input.selector === 'string' && args.input.selector.trim().length > 0
        ? args.input.selector.trim()
        : undefined;
      payload.waitFor = payload.selector ? 'selector' : 'timeout';
      break;
    }

    case 'capture_console':
    case 'capture_network': {
      payload.limit = clampCaptureLimit(args.input.limit);
      break;
    }

    default:
      break;
  }

  return payload;
}

async function callBrowserExtensionAction(args: {
  context: ToolUseContext;
  action: BrowserAction;
  scope: BrowserUrlScopeEvaluation;
  input: BrowserInput;
  timeoutMs: number;
  maxChars: number;
  onProgress?: ToolCallProgress;
  toolUseId: string;
}): Promise<BrowserRuntimeActionResponse> {
  const bridgeSessionId = resolveBrowserExtensionBridgeSessionId(args.context);

  if (!bridgeSessionId) {
    throw new Error('Missing browser extension bridge session id. Connect Flare Browser agent first.');
  }

  const extensionName = resolveBrowserExtensionName(args.context);
  const payload = buildBrowserServerPayload(args);

  emitBrowserProgress(args.onProgress, args.toolUseId, 'browser_extension_request_start', {
    action: args.action,
    bridgeSessionId,
    extensionName,
    normalizedUrl: args.scope.normalizedUrl,
  });

  const result = await enqueueBrowserExtensionCommand({
    bridgeSessionId,
    sessionId: args.context.sessionId,
    taskId: args.context.taskId,
    action: args.action,
    url: args.scope.normalizedUrl!,
    input: payload,
    timeoutMs: args.timeoutMs,
    maxChars: args.maxChars,
    extensionName,
    abortSignal: args.context.abortSignal,
  });

  emitBrowserProgress(args.onProgress, args.toolUseId, 'browser_extension_response_received', {
    action: args.action,
    bridgeSessionId,
    success: result.success !== false,
    ok: result.ok !== false,
    status: Number.isFinite(result.status) ? Number(result.status) : undefined,
  });

  if (result.success === false) {
    throw new Error(result.error || 'Flare Browser agent reported failure');
  }

  return {
    success: true,
    data: result,
    status: Number.isFinite(result.status) ? Number(result.status) : 200,
    ok: typeof result.ok === 'boolean' ? result.ok : true,
    finalUrl: typeof result.finalUrl === 'string' && result.finalUrl.length > 0
      ? result.finalUrl
      : args.scope.normalizedUrl!,
  };
}

async function callBrowserServerAction(args: {
  context: ToolUseContext;
  action: BrowserAction;
  scope: BrowserUrlScopeEvaluation;
  input: BrowserInput;
  timeoutMs: number;
  maxChars: number;
  onProgress?: ToolCallProgress;
  toolUseId: string;
}): Promise<BrowserRuntimeActionResponse> {
  const browserServerUrl = resolveBrowserServerUrl(args.context);

  if (!browserServerUrl) {
    throw new Error(
      'Browser server is not configured. Set browserServerUrl in context or BROWSER_SERVER_URL in environment.',
    );
  }

  const endpoint = `${browserServerUrl.replace(/\/$/, '')}/actions`;
  const apiKey = resolveBrowserServerApiKey(args.context);
  const payload = buildBrowserServerPayload(args);

  emitBrowserProgress(args.onProgress, args.toolUseId, 'browser_server_request_start', {
    action: args.action,
    endpoint,
    normalizedUrl: args.scope.normalizedUrl,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: buildBrowserServerHeaders(apiKey),
    body: JSON.stringify(payload),
    signal: args.context.abortSignal,
  });

  let body: any;

  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  emitBrowserProgress(args.onProgress, args.toolUseId, 'browser_server_response_received', {
    action: args.action,
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    const error = body?.error || `Browser server request failed with status ${response.status}`;
    throw new Error(error);
  }

  const data = body?.data || body || {};

  return {
    success: body?.success !== false,
    data,
    status: Number.isFinite(data.status) ? Number(data.status) : response.status,
    ok: typeof data.ok === 'boolean' ? data.ok : response.ok,
    finalUrl: typeof data.finalUrl === 'string' && data.finalUrl.length > 0
      ? data.finalUrl
      : args.scope.normalizedUrl!,
  };
}

async function requestExternalUrlApproval(
  normalizedUrl: string,
  normalizedOrigin: string,
  context: ToolUseContext,
  onProgress?: ToolCallProgress,
  toolUseId = '',
): Promise<ApprovalDecision> {
  emitBrowserProgress(onProgress, toolUseId, 'browser_approval_required', {
    normalizedUrl,
    normalizedOrigin,
  });

  const result = await AskUserQuestionTool.execute(
    {
      title: 'External browser access requires approval',
      instructions:
        `The browser tool attempted to access ${normalizedUrl}. ` +
        `You can allow this one URL once, trust the origin ${normalizedOrigin} for this session, or deny access.`,
      questions: [
        {
          id: 'browser_url_approval',
          prompt: `Allow browser access to ${normalizedUrl}?`,
          options: ['Allow once', 'Allow this origin for this session', 'Deny'],
        },
      ],
    },
    context,
  );

  if (!result.success) {
    emitBrowserProgress(onProgress, toolUseId, 'browser_approval_resolved', {
      normalizedUrl,
      normalizedOrigin,
      decision: 'deny',
    });
    return 'deny';
  }

  const answer = result.data.answers?.[0];
  const selected = answer?.selectedOption?.toLowerCase() ?? '';
  const freeText = answer?.freeText?.toLowerCase() ?? '';
  const decisionText = `${selected} ${freeText}`;

  let decision: ApprovalDecision = 'deny';

  if (decisionText.includes('deny')) {
    decision = 'deny';
  } else if (decisionText.includes('origin') || decisionText.includes('session')) {
    decision = 'allow_origin';
  } else if (decisionText.includes('once')) {
    decision = 'allow_once';
  }

  emitBrowserProgress(onProgress, toolUseId, 'browser_approval_resolved', {
    normalizedUrl,
    normalizedOrigin,
    decision,
  });

  return decision;
}

async function ensureScopeApproved(
  targetUrl: string,
  context: ToolUseContext,
  previewBaseUrls: string[],
  options?: {
    phase?: 'initial' | 'redirect';
    onProgress?: ToolCallProgress;
    toolUseId?: string;
  },
): Promise<BrowserUrlScopeEvaluation> {
  const phase = options?.phase || 'initial';
  const onProgress = options?.onProgress;
  const toolUseId = options?.toolUseId || '';

  emitBrowserProgress(onProgress, toolUseId, 'browser_scope_check_start', {
    phase,
    url: targetUrl,
  });

  let scope = evaluateBrowserUrlScope(targetUrl, {
    sessionId: context.sessionId,
    previewBaseUrls,
  });

  if (!scope.isValidUrl || !scope.normalizedUrl || !scope.normalizedOrigin) {
    emitBrowserProgress(onProgress, toolUseId, 'browser_error', {
      phase: `${phase}_scope_check`,
      error: `Invalid URL: ${targetUrl}`,
      url: targetUrl,
    });
    throw new Error(`Invalid URL: ${targetUrl}`);
  }

  if (scope.allowed) {
    emitBrowserProgress(onProgress, toolUseId, 'browser_scope_check_complete', {
      phase,
      normalizedUrl: scope.normalizedUrl,
      normalizedOrigin: scope.normalizedOrigin,
      allowedBy: resolveAllowedBy(scope),
      allowed: true,
    });
    return scope;
  }

  const decision = await requestExternalUrlApproval(
    scope.normalizedUrl,
    scope.normalizedOrigin,
    context,
    onProgress,
    toolUseId,
  );

  if (decision === 'deny') {
    emitBrowserProgress(onProgress, toolUseId, 'browser_error', {
      phase: `${phase}_approval`,
      error: `External URL denied by user approval flow: ${scope.normalizedUrl}`,
      url: scope.normalizedUrl,
    });
    throw new Error(`External URL denied by user approval flow: ${scope.normalizedUrl}`);
  }

  if (context.sessionId) {
    if (decision === 'allow_origin') {
      addSessionApprovedBrowserOrigin(context.sessionId, scope.normalizedOrigin);
    } else {
      addBrowserAllowedOnceUrl(context.sessionId, scope.normalizedUrl);
    }
  }

  scope = evaluateBrowserUrlScope(scope.normalizedUrl, {
    sessionId: context.sessionId,
    previewBaseUrls,
  });

  if (!scope.allowed && !context.sessionId) {
    scope = {
      ...scope,
      hasSessionApproval: decision === 'allow_origin',
      hasAllowOnceApproval: decision === 'allow_once',
      allowed: true,
    };
  }

  if (!scope.allowed) {
    emitBrowserProgress(onProgress, toolUseId, 'browser_error', {
      phase: `${phase}_approval_recheck`,
      error: `URL remains out of scope after approval handling: ${scope.normalizedUrl}`,
      url: scope.normalizedUrl,
    });
    throw new Error(`URL remains out of scope after approval handling: ${scope.normalizedUrl}`);
  }

  emitBrowserProgress(onProgress, toolUseId, 'browser_scope_check_complete', {
    phase,
    normalizedUrl: scope.normalizedUrl,
    normalizedOrigin: scope.normalizedOrigin,
    allowedBy: resolveAllowedBy(scope),
    allowed: true,
  });

  return scope;
}

function errorResult(args: {
  action: BrowserAction;
  requestedUrl: string;
  normalizedUrl?: string;
  normalizedOrigin?: string;
  finalUrl?: string;
  status?: number;
  allowedBy?: 'preview_scope' | 'session_origin' | 'allow_once';
  error: string;
}): ToolResult<BrowserOutput> {
  return {
    success: false,
    data: {
      action: args.action,
      requestedUrl: args.requestedUrl,
      normalizedUrl: args.normalizedUrl ?? args.requestedUrl,
      normalizedOrigin: args.normalizedOrigin ?? '',
      finalUrl: args.finalUrl ?? args.normalizedUrl ?? args.requestedUrl,
      status: args.status ?? 0,
      ok: false,
      content: '',
      truncated: false,
      allowedBy: args.allowedBy ?? 'allow_once',
    },
    error: args.error,
  };
}

function normalizeServerResponseContent(action: BrowserAction, payload: BrowserServerActionResult): string {
  if (action === 'snapshot_html') {
    if (typeof payload.html === 'string') {
      return payload.html;
    }

    if (typeof payload.content === 'string') {
      return payload.content;
    }

    return '';
  }

  if (action === 'extract_text') {
    if (typeof payload.content === 'string') {
      return payload.content;
    }

    if (typeof payload.html === 'string') {
      return htmlToText(payload.html);
    }

    return '';
  }

  if (action === 'capture_console') {
    const source = Array.isArray(payload.logs) ? payload.logs : Array.isArray(payload.entries) ? payload.entries : [];
    return safeStringify(source);
  }

  if (action === 'capture_network') {
    const source = Array.isArray(payload.entries) ? payload.entries : Array.isArray(payload.logs) ? payload.logs : [];
    return safeStringify(source);
  }

  if (typeof payload.content === 'string') {
    return payload.content;
  }

  if (payload.data !== undefined) {
    return safeStringify(payload.data);
  }

  return '';
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '[unserializable payload]';
  }
}

export const BrowserTool: Tool<BrowserInput, BrowserOutput> = {
  name: 'browser',
  displayName: 'Browser',
  description: `Control pages through a server/VPS-backed browser runtime with URL-scope enforcement.

Scope behavior:
- Preview URLs are auto-allowed
- External URLs require explicit user approval (allow-once or allow-origin-for-session)
- Out-of-scope URLs are blocked until approved

Runtime behavior:
- Prefers connected Flare Browser agent (extension bridge) when bridge session is available
- Falls back to configured remote browser server endpoint when extension bridge is unavailable
- Supports navigate/extract/snapshot plus click/tap/type/scroll/wait and console/network capture`,

  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'navigate',
          'extract_text',
          'snapshot_html',
          'click',
          'tap',
          'type',
          'scroll',
          'wait_for',
          'capture_console',
          'capture_network',
        ],
        description: 'Browser operation to perform. Defaults to navigate.',
      },
      url: {
        type: 'string',
        description: 'Absolute URL to access.',
      },
      selector: {
        type: 'string',
        description: 'CSS selector used by click/tap/type/wait_for actions.',
      },
      text: {
        type: 'string',
        description: 'Text payload for type action.',
      },
      timeout_ms: {
        type: 'number',
        description: `Action timeout in milliseconds (default ${DEFAULT_TIMEOUT_MS}).`,
      },
      x: {
        type: 'number',
        description: 'Scroll target x-coordinate for scroll action.',
      },
      y: {
        type: 'number',
        description: 'Scroll target y-coordinate for scroll action.',
      },
      delta_x: {
        type: 'number',
        description: 'Horizontal scroll delta for scroll action.',
      },
      delta_y: {
        type: 'number',
        description: 'Vertical scroll delta for scroll action.',
      },
      limit: {
        type: 'number',
        description: `Maximum entries for capture actions (default ${DEFAULT_CAPTURE_LIMIT}, max ${MAX_CAPTURE_LIMIT}).`,
      },
      max_chars: {
        type: 'number',
        description: `Maximum response characters to return (default ${DEFAULT_MAX_CHARS}, max ${MAX_MAX_CHARS}).`,
      },
    },
    required: ['url'],
  },

  isReadOnly: false,
  isConcurrencySafe: true,
  category: 'web',
  searchHint: 'browser navigate click tap type scroll wait console network devtools vps server',

  async execute(
    input: BrowserInput,
    context: ToolUseContext,
    onProgress?: ToolCallProgress,
  ): Promise<ToolResult<BrowserOutput>> {
    const action = input.action ?? 'navigate';
    const maxChars = clampMaxChars(input.max_chars);
    const timeoutMs = clampTimeoutMs(input.timeout_ms);
    const toolUseId = `browser-${context.taskId || 'standalone'}`;

    const previewBaseUrls = await listPreviewBaseUrls({
      previewBaseUrls: context.previewBaseUrls,
    });

    let initialScope: BrowserUrlScopeEvaluation;

    try {
      initialScope = await ensureScopeApproved(input.url, context, previewBaseUrls, {
        phase: 'initial',
        onProgress,
        toolUseId,
      });
    } catch (error: any) {
      return errorResult({
        action,
        requestedUrl: input.url,
        error: error?.message || `Invalid URL: ${input.url}`,
      });
    }

    emitBrowserProgress(onProgress, toolUseId, 'browser_action_start', {
      action,
      normalizedUrl: initialScope.normalizedUrl,
      timeoutMs,
    });

    let actionResponse: BrowserRuntimeActionResponse;

    try {
      const hasExtensionBridge = Boolean(resolveBrowserExtensionBridgeSessionId(context));

      if (hasExtensionBridge) {
        try {
          actionResponse = await callBrowserExtensionAction({
            context,
            action,
            scope: initialScope,
            input,
            timeoutMs,
            maxChars,
            onProgress,
            toolUseId,
          });
        } catch (extensionError: any) {
          emitBrowserProgress(onProgress, toolUseId, 'browser_extension_fallback', {
            action,
            normalizedUrl: initialScope.normalizedUrl,
            reason: extensionError?.message || 'Unknown extension bridge error',
          });

          actionResponse = await callBrowserServerAction({
            context,
            action,
            scope: initialScope,
            input,
            timeoutMs,
            maxChars,
            onProgress,
            toolUseId,
          });
        }
      } else {
        actionResponse = await callBrowserServerAction({
          context,
          action,
          scope: initialScope,
          input,
          timeoutMs,
          maxChars,
          onProgress,
          toolUseId,
        });
      }
    } catch (error: any) {
      emitBrowserProgress(onProgress, toolUseId, 'browser_error', {
        phase: 'request',
        error: `Browser request failed: ${error?.message || 'Unknown runtime error'}`,
        url: initialScope.normalizedUrl,
      });

      return errorResult({
        action,
        requestedUrl: input.url,
        normalizedUrl: initialScope.normalizedUrl,
        normalizedOrigin: initialScope.normalizedOrigin,
        finalUrl: initialScope.normalizedUrl,
        allowedBy: resolveAllowedBy(initialScope),
        error: `Browser request failed: ${error?.message || 'Unknown runtime error'}`,
      });
    }

    const finalUrl = actionResponse.finalUrl || initialScope.normalizedUrl!;

    emitBrowserProgress(onProgress, toolUseId, 'browser_response_received', {
      status: actionResponse.status,
      ok: actionResponse.ok,
      finalUrl,
      action,
    });

    let finalScope: BrowserUrlScopeEvaluation;

    try {
      finalScope = await ensureScopeApproved(finalUrl, context, previewBaseUrls, {
        phase: 'redirect',
        onProgress,
        toolUseId,
      });
    } catch (error: any) {
      return errorResult({
        action,
        requestedUrl: input.url,
        normalizedUrl: initialScope.normalizedUrl,
        normalizedOrigin: initialScope.normalizedOrigin,
        finalUrl,
        status: actionResponse.status,
        allowedBy: resolveAllowedBy(initialScope),
        error: error?.message || `Redirect target is out of scope: ${finalUrl}`,
      });
    }

    if (context.sessionId) {
      if (initialScope.hasAllowOnceApproval && initialScope.normalizedUrl) {
        consumeBrowserAllowedOnceUrl(context.sessionId, initialScope.normalizedUrl);
      }

      if (
        finalScope.hasAllowOnceApproval &&
        finalScope.normalizedUrl &&
        finalScope.normalizedUrl !== initialScope.normalizedUrl
      ) {
        consumeBrowserAllowedOnceUrl(context.sessionId, finalScope.normalizedUrl);
      }
    }

    const titleCandidate = typeof actionResponse.data.title === 'string'
      ? collapseWhitespace(actionResponse.data.title)
      : undefined;

    const rawContent = normalizeServerResponseContent(action, actionResponse.data);
    const truncated = truncateContent(rawContent, maxChars);

    emitBrowserProgress(onProgress, toolUseId, 'browser_extract_complete', {
      action,
      charCount: truncated.content.length,
      truncated: truncated.truncated,
      title: titleCandidate,
      finalUrl,
    });

    emitBrowserProgress(onProgress, toolUseId, 'browser_action_complete', {
      action,
      finalUrl,
      ok: actionResponse.ok,
      status: actionResponse.status,
    });

    return {
      success: actionResponse.success && actionResponse.ok,
      data: {
        action,
        requestedUrl: input.url,
        normalizedUrl: finalScope.normalizedUrl!,
        normalizedOrigin: finalScope.normalizedOrigin!,
        finalUrl,
        status: actionResponse.status,
        ok: actionResponse.ok,
        title: titleCandidate,
        content: truncated.content,
        truncated: truncated.truncated,
        allowedBy: resolveAllowedBy(finalScope),
      },
      error:
        actionResponse.success && actionResponse.ok
          ? undefined
          : `Browser action failed with status ${actionResponse.status}`,
    };
  },
};
