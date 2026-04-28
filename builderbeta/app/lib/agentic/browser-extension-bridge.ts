export type BrowserExtensionAction =
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

export interface BrowserExtensionCommand {
  id: string;
  bridgeSessionId: string;
  sessionId?: string;
  taskId?: string;
  action: BrowserExtensionAction;
  url: string;
  input: Record<string, unknown>;
  timeoutMs: number;
  maxChars: number;
  createdAt: number;
  extensionName: string;
}

export interface BrowserExtensionCommandResult {
  success: boolean;
  status?: number;
  ok?: boolean;
  finalUrl?: string;
  title?: string;
  content?: string;
  html?: string;
  data?: unknown;
  logs?: unknown[];
  entries?: unknown[];
  error?: string;
}

interface PendingCommandResolver {
  bridgeSessionId: string;
  resolve: (result: BrowserExtensionCommandResult) => void;
  reject: (error: Error) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
  abortListener?: () => void;
}

interface EnqueueBrowserExtensionCommandInput {
  bridgeSessionId: string;
  sessionId?: string;
  taskId?: string;
  action: BrowserExtensionAction;
  url: string;
  input: Record<string, unknown>;
  timeoutMs: number;
  maxChars: number;
  extensionName?: string;
  waitTimeoutMs?: number;
  abortSignal?: AbortSignal;
}

interface BrowserExtensionBridgeSessionSnapshot {
  bridgeSessionId: string;
  queueLength: number;
  lastSeenAt?: number;
}

const commandQueuesByBridgeSession = new Map<string, BrowserExtensionCommand[]>();
const pendingCommandResolvers = new Map<string, PendingCommandResolver>();
const lastSeenByBridgeSession = new Map<string, number>();

const DEFAULT_EXTENSION_NAME = 'Flare Browser agent';
const MIN_WAIT_TIMEOUT_MS = 5_000;
const MAX_WAIT_TIMEOUT_MS = 5 * 60_000;

function nextCommandId(): string {
  return `extcmd-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function normalizeBridgeSessionId(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function removeQueuedCommand(bridgeSessionId: string, commandId: string): void {
  const queue = commandQueuesByBridgeSession.get(bridgeSessionId);

  if (!queue || queue.length === 0) {
    return;
  }

  const nextQueue = queue.filter((command) => command.id !== commandId);

  if (nextQueue.length === 0) {
    commandQueuesByBridgeSession.delete(bridgeSessionId);
    return;
  }

  commandQueuesByBridgeSession.set(bridgeSessionId, nextQueue);
}

function clearPendingCommand(commandId: string): PendingCommandResolver | undefined {
  const pending = pendingCommandResolvers.get(commandId);

  if (!pending) {
    return undefined;
  }

  pendingCommandResolvers.delete(commandId);
  clearTimeout(pending.timeoutHandle);
  pending.abortListener?.();

  return pending;
}

function clampWaitTimeoutMs(input: number): number {
  return Math.min(MAX_WAIT_TIMEOUT_MS, Math.max(MIN_WAIT_TIMEOUT_MS, Math.floor(input)));
}

export function markBrowserExtensionBridgeSeen(bridgeSessionId: string): void {
  const normalizedBridgeSessionId = normalizeBridgeSessionId(bridgeSessionId);

  if (!normalizedBridgeSessionId) {
    return;
  }

  lastSeenByBridgeSession.set(normalizedBridgeSessionId, Date.now());
}

export function getBrowserExtensionBridgeSessionSnapshot(
  bridgeSessionId: string,
): BrowserExtensionBridgeSessionSnapshot | undefined {
  const normalizedBridgeSessionId = normalizeBridgeSessionId(bridgeSessionId);

  if (!normalizedBridgeSessionId) {
    return undefined;
  }

  return {
    bridgeSessionId: normalizedBridgeSessionId,
    queueLength: commandQueuesByBridgeSession.get(normalizedBridgeSessionId)?.length || 0,
    lastSeenAt: lastSeenByBridgeSession.get(normalizedBridgeSessionId),
  };
}

export function pullNextBrowserExtensionCommand(bridgeSessionId: string): BrowserExtensionCommand | undefined {
  const normalizedBridgeSessionId = normalizeBridgeSessionId(bridgeSessionId);

  if (!normalizedBridgeSessionId) {
    return undefined;
  }

  markBrowserExtensionBridgeSeen(normalizedBridgeSessionId);

  const queue = commandQueuesByBridgeSession.get(normalizedBridgeSessionId);

  if (!queue || queue.length === 0) {
    return undefined;
  }

  const command = queue.shift();

  if (!command) {
    return undefined;
  }

  if (queue.length === 0) {
    commandQueuesByBridgeSession.delete(normalizedBridgeSessionId);
  } else {
    commandQueuesByBridgeSession.set(normalizedBridgeSessionId, queue);
  }

  return command;
}

export function resolveBrowserExtensionCommandResult(input: {
  bridgeSessionId: string;
  commandId: string;
  result: BrowserExtensionCommandResult;
}): boolean {
  const normalizedBridgeSessionId = normalizeBridgeSessionId(input.bridgeSessionId);

  if (!normalizedBridgeSessionId) {
    return false;
  }

  const pending = clearPendingCommand(input.commandId);

  if (!pending || pending.bridgeSessionId !== normalizedBridgeSessionId) {
    return false;
  }

  markBrowserExtensionBridgeSeen(normalizedBridgeSessionId);
  pending.resolve(input.result);

  return true;
}

export function rejectBrowserExtensionCommandResult(input: {
  bridgeSessionId: string;
  commandId: string;
  error: string;
}): boolean {
  const normalizedBridgeSessionId = normalizeBridgeSessionId(input.bridgeSessionId);

  if (!normalizedBridgeSessionId) {
    return false;
  }

  const pending = clearPendingCommand(input.commandId);

  if (!pending || pending.bridgeSessionId !== normalizedBridgeSessionId) {
    return false;
  }

  markBrowserExtensionBridgeSeen(normalizedBridgeSessionId);
  pending.reject(new Error(input.error));

  return true;
}

export async function enqueueBrowserExtensionCommand(
  input: EnqueueBrowserExtensionCommandInput,
): Promise<BrowserExtensionCommandResult> {
  const normalizedBridgeSessionId = normalizeBridgeSessionId(input.bridgeSessionId);

  if (!normalizedBridgeSessionId) {
    throw new Error('Missing browser extension bridge session id. Connect Flare Browser agent first.');
  }

  if (input.abortSignal?.aborted) {
    throw new Error('Browser extension request aborted before dispatch.');
  }

  const command: BrowserExtensionCommand = {
    id: nextCommandId(),
    bridgeSessionId: normalizedBridgeSessionId,
    sessionId: input.sessionId,
    taskId: input.taskId,
    action: input.action,
    url: input.url,
    input: input.input,
    timeoutMs: input.timeoutMs,
    maxChars: input.maxChars,
    createdAt: Date.now(),
    extensionName:
      typeof input.extensionName === 'string' && input.extensionName.trim().length > 0
        ? input.extensionName.trim()
        : DEFAULT_EXTENSION_NAME,
  };

  const queue = commandQueuesByBridgeSession.get(normalizedBridgeSessionId) ?? [];
  queue.push(command);
  commandQueuesByBridgeSession.set(normalizedBridgeSessionId, queue);

  markBrowserExtensionBridgeSeen(normalizedBridgeSessionId);

  const waitTimeoutMs = clampWaitTimeoutMs(input.waitTimeoutMs ?? input.timeoutMs + 45_000);

  return new Promise<BrowserExtensionCommandResult>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      removeQueuedCommand(normalizedBridgeSessionId, command.id);
      pendingCommandResolvers.delete(command.id);
      reject(
        new Error(
          `${command.extensionName} did not respond within ${Math.round(waitTimeoutMs / 1000)} seconds.`,
        ),
      );
    }, waitTimeoutMs);

    const pending: PendingCommandResolver = {
      bridgeSessionId: normalizedBridgeSessionId,
      timeoutHandle,
      resolve: (result) => {
        resolve(result);
      },
      reject,
    };

    if (input.abortSignal) {
      const onAbort = () => {
        clearPendingCommand(command.id);
        removeQueuedCommand(normalizedBridgeSessionId, command.id);
        reject(new Error('Browser extension request aborted.'));
      };

      input.abortSignal.addEventListener('abort', onAbort, { once: true });
      pending.abortListener = () => {
        input.abortSignal?.removeEventListener('abort', onAbort);
      };
    }

    pendingCommandResolvers.set(command.id, pending);
  });
}
