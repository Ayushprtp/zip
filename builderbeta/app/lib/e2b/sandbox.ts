import { Sandbox, Template, type SnapshotInfo, type TemplateTag, type TemplateTagInfo } from '@e2b/code-interpreter';

let globalSandbox: Sandbox | null = null;
let sandboxInitialization: Promise<Sandbox> | null = null;

const WORK_DIR = '/home/project';
let isInitialized = false;
let apiKeyOverride: string | null = null;
let templateIdOverride: string | null = null;

const SANDBOX_ID_KEY = 'bolt_e2b_sandbox_id';
const SNAPSHOT_ID_KEY = 'bolt_e2b_snapshot_id';
const SNAPSHOT_AT_KEY = 'bolt_e2b_snapshot_at';
const TEMPLATE_ID_KEY = 'bolt_e2b_template_id';

const AUTOSNAPSHOT_DEBOUNCE_MS = 20_000;
const AUTOSNAPSHOT_MAX_INTERVAL_MS = 5 * 60_000;

interface SnapshotState {
  lastSnapshotId: string | null;
  lastSnapshotAt: number | null;
  pendingReason: string | null;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  inFlight: Promise<SnapshotInfo> | null;
}

const snapshotState: SnapshotState = {
  lastSnapshotId: null,
  lastSnapshotAt: null,
  pendingReason: null,
  debounceTimer: null,
  inFlight: null,
};

export interface SnapshotMetadata {
  sandboxId: string | null;
  snapshotId: string | null;
  lastSnapshotAt: number | null;
}

export interface TemplateBuildResult {
  templateName: string;
  templateId?: string;
  buildId?: string;
}

type CommandResult = { exitCode: number; stdout: string; stderr: string };
type CommandHandle = { wait: () => Promise<CommandResult> };
type RunCommandResult = CommandResult | CommandHandle;

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function getStorageItem(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStorageItem(key: string, value: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (value === null) {
      localStorage.removeItem(key);
      return;
    }

    localStorage.setItem(key, value);
  } catch {
    // no-op when storage is unavailable
  }
}

function clearSnapshotDebounceTimer() {
  if (!snapshotState.debounceTimer) {
    return;
  }

  clearTimeout(snapshotState.debounceTimer);
  snapshotState.debounceTimer = null;
}

function persistSnapshotMetadata(snapshotId: string | null, timestamp: number | null) {
  snapshotState.lastSnapshotId = snapshotId;
  snapshotState.lastSnapshotAt = timestamp;

  setStorageItem(SNAPSHOT_ID_KEY, snapshotId);
  setStorageItem(SNAPSHOT_AT_KEY, timestamp ? String(timestamp) : null);
}

function loadSnapshotMetadataFromStorage() {
  if (snapshotState.lastSnapshotId !== null || snapshotState.lastSnapshotAt !== null) {
    return;
  }

  const snapshotId = getStorageItem(SNAPSHOT_ID_KEY);
  const snapshotAtRaw = getStorageItem(SNAPSHOT_AT_KEY);
  const snapshotAt = snapshotAtRaw ? Number.parseInt(snapshotAtRaw, 10) : Number.NaN;

  snapshotState.lastSnapshotId = snapshotId;
  snapshotState.lastSnapshotAt = Number.isFinite(snapshotAt) ? snapshotAt : null;
}

function resetConnectionState() {
  globalSandbox = null;
  isInitialized = false;
}

export function setE2BApiKeyOverride(apiKey?: string | null): void {
  const normalized = apiKey?.trim();
  apiKeyOverride = normalized ? normalized : null;
}

export function setPreferredTemplateOverride(templateId?: string | null): void {
  const normalized = templateId?.trim();
  templateIdOverride = normalized ? normalized : null;
}

function resolveE2BApiKey(): string {
  const browserEnv = typeof window !== 'undefined' ? (window as any).ENV : undefined;
  const fromWindow = browserEnv?.E2B_API_KEY;
  const fromVite = import.meta.env.VITE_E2B_API_KEY;
  const fromNode = typeof process !== 'undefined' ? process.env.E2B_API_KEY : undefined;
  const apiKey = apiKeyOverride || fromWindow || fromVite || fromNode;

  if (!apiKey) {
    throw new Error('E2B API key not found. Set E2B_API_KEY, VITE_E2B_API_KEY, or expose E2B_API_KEY via window.ENV');
  }

  return apiKey;
}

function resolvePreferredTemplate(): string | null {
  if (templateIdOverride?.trim()) {
    return templateIdOverride.trim();
  }

  const fromStorage = getStorageItem(TEMPLATE_ID_KEY);

  if (fromStorage?.trim()) {
    return fromStorage.trim();
  }

  const browserEnv = typeof window !== 'undefined' ? (window as any).ENV : undefined;
  const fromWindow = browserEnv?.E2B_TEMPLATE_ID;
  const fromVite = import.meta.env.VITE_E2B_TEMPLATE_ID;
  const fromNode = typeof process !== 'undefined' ? process.env.E2B_TEMPLATE_ID : undefined;

  return (fromWindow || fromVite || fromNode || '').trim() || null;
}

async function initializeSandboxEnvironment(sandbox: Sandbox): Promise<void> {
  if (isInitialized) {
    return;
  }

  console.log('[E2B] Initializing sandbox environment...');

  // Ensure project directory and install pnpm synchronously
  await sandbox.files.makeDir(WORK_DIR).catch(() => undefined);

  try {
    // Create local npm global and ensure project dir
    await sandbox.files.makeDir(WORK_DIR).catch(() => undefined);
    await sandbox.commands.run('mkdir -p /home/project/.npm-global', { cwd: WORK_DIR });

    // Update .bashrc and .profile for persistent PATH and shell settings
    const envSetup = `
export PATH=$PATH:/home/project/.npm-global/bin:/home/user/.npm-global/bin
export NPM_CONFIG_PREFIX=/home/project/.npm-global
export HOST=0.0.0.0
alias pnpm='/home/project/.npm-global/bin/pnpm'
cd /home/project
`;
    await sandbox.files.write('/home/user/.bashrc', envSetup);
    await sandbox.files.write('/home/user/.profile', envSetup);

    // Disable pnpm security check for build scripts in this sandbox context
    await sandbox.commands
      .run('pnpm config set only-allow-trusted-dependencies false', { cwd: WORK_DIR })
      .catch(() => undefined);

    // Install pnpm with the new prefix
    await sandbox.commands.run('npm config set prefix /home/project/.npm-global && npm install -g pnpm@latest', {
      cwd: WORK_DIR,
    });

    console.log('[E2B] Environment persistent and pnpm installed');
  } catch (err) {
    console.warn('[E2B] Initialization partially failed (non-critical):', err);
  }

  isInitialized = true;
}

async function connectFromSavedSandboxId(apiKey: string): Promise<Sandbox | null> {
  const savedId = getStorageItem(SANDBOX_ID_KEY);

  if (!savedId) {
    return null;
  }

  try {
    console.log(`[E2B] Attempting to reconnect to sandbox: ${savedId}`);

    const sandbox = await Sandbox.connect(savedId, {
      apiKey,
    });

    console.log('[E2B] Successfully reconnected to existing sandbox');

    return sandbox;
  } catch (err) {
    console.warn('[E2B] Reconnection failed. Session might have expired.', err);
    setStorageItem(SANDBOX_ID_KEY, null);

    return null;
  }
}

async function createDefaultSandbox(apiKey: string): Promise<Sandbox> {
  console.log('[E2B] Creating new Sandbox...');

  let retries = 3;

  while (retries > 0) {
    try {
      return await Sandbox.create({
        apiKey,
        timeoutMs: 1_800_000,
      });
    } catch (err: any) {
      console.error(`[E2B] Creation failed (${retries} retries left):`, err.message);
      retries--;

      if (retries <= 0) {
        throw err;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw new Error('Failed to create sandbox after retries');
}

async function createSandboxFromSnapshot(apiKey: string): Promise<Sandbox | null> {
  loadSnapshotMetadataFromStorage();

  const snapshotId = snapshotState.lastSnapshotId || getStorageItem(SNAPSHOT_ID_KEY);

  if (!snapshotId) {
    return null;
  }

  try {
    console.log(`[E2B] Creating sandbox from snapshot: ${snapshotId}`);

    const sandbox = await Sandbox.create(snapshotId, {
      apiKey,
      timeoutMs: 1_800_000,
    });

    persistSnapshotMetadata(snapshotId, Date.now());

    return sandbox;
  } catch (err) {
    console.warn('[E2B] Failed to create sandbox from snapshot, falling back.', err);
    persistSnapshotMetadata(null, null);

    return null;
  }
}

async function createSandboxFromTemplate(apiKey: string): Promise<Sandbox | null> {
  const templateId = resolvePreferredTemplate();

  if (!templateId) {
    return null;
  }

  try {
    console.log(`[E2B] Creating sandbox from template: ${templateId}`);

    return await Sandbox.create(templateId, {
      apiKey,
      timeoutMs: 1_800_000,
    });
  } catch (err) {
    console.warn('[E2B] Failed to create sandbox from preferred template, falling back.', err);
    return null;
  }
}

export async function getE2BSandbox(): Promise<Sandbox> {
  loadSnapshotMetadataFromStorage();

  const apiKey = resolveE2BApiKey();

  if (sandboxInitialization) {
    return sandboxInitialization;
  }

  // Check if existing sandbox is still healthy
  if (globalSandbox) {
    try {
      await globalSandbox.commands.run('echo 1', { timeoutMs: 2000 });
      return globalSandbox;
    } catch {
      console.warn('[E2B] Sandbox unhealthy or disconnected. Recreating...');
      resetConnectionState();
    }
  }

  if (sandboxInitialization) {
    return sandboxInitialization;
  }

  sandboxInitialization = (async () => {
    let sandbox = globalSandbox;

    if (!sandbox) {
      sandbox = await connectFromSavedSandboxId(apiKey);
    }

    if (!sandbox) {
      sandbox = await createSandboxFromSnapshot(apiKey);
    }

    if (!sandbox) {
      sandbox = await createSandboxFromTemplate(apiKey);
    }

    if (!sandbox) {
      sandbox = await createDefaultSandbox(apiKey);
    }

    globalSandbox = sandbox;
    setStorageItem(SANDBOX_ID_KEY, sandbox.sandboxId);
    await initializeSandboxEnvironment(sandbox);

    console.log('[E2B] Sandbox ready:', sandbox.sandboxId);

    return sandbox;
  })();

  try {
    return await sandboxInitialization;
  } finally {
    sandboxInitialization = null;
  }
}

function resolvePath(filePath: string): string {
  if (filePath.startsWith('/')) {
    return filePath;
  }

  return `${WORK_DIR}/${filePath}`;
}

function isCommandHandle(result: RunCommandResult): result is CommandHandle {
  return typeof (result as CommandHandle).wait === 'function';
}

async function waitForCommandResult(result: RunCommandResult): Promise<CommandResult> {
  if (isCommandHandle(result)) {
    return result.wait();
  }

  return result;
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  const sandbox = await getE2BSandbox();
  const absolutePath = resolvePath(filePath);

  // Ensure parent directory exists
  const dir = absolutePath.substring(0, absolutePath.lastIndexOf('/'));

  if (dir) {
    try {
      await sandbox.files.makeDir(dir);
    } catch {
      // Directory may already exist
    }
  }

  await sandbox.files.write(absolutePath, content);
}

export async function readFile(filePath: string): Promise<string> {
  const sandbox = await getE2BSandbox();
  return await sandbox.files.read(resolvePath(filePath));
}

export async function listFiles(dirPath: string): Promise<string[]> {
  const sandbox = await getE2BSandbox();

  try {
    const entries = await sandbox.files.list(resolvePath(dirPath));
    return entries.map((e: any) => e.name);
  } catch {
    return [];
  }
}

export async function syncFilesToSandbox(files: Record<string, any>) {
  const sandbox = await getE2BSandbox();
  const fileEntries = Object.entries(files);

  await Promise.all(
    fileEntries.map(async ([filePath, file]) => {
      const absolutePath = resolvePath(filePath);

      if (file && file.type === 'file') {
        // Ensure parent directory exists
        const dir = absolutePath.substring(0, absolutePath.lastIndexOf('/'));

        if (dir) {
          try {
            await sandbox.files.makeDir(dir);
          } catch {
            /* exists */
          }
        }

        await sandbox.files.write(absolutePath, file.content);
      } else if (file && file.type === 'folder') {
        try {
          await sandbox.files.makeDir(absolutePath);
        } catch {
          // Ignored if exists
        }
      }
    }),
  );
}

async function runInShell(
  command: string,
  options: {
    timeoutMs?: number;
    background?: boolean;
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
  } = {},
): Promise<RunCommandResult> {
  const sandbox = await getE2BSandbox();

  return sandbox.commands.run(command, {
    timeoutMs: options.timeoutMs ?? 0,
    background: options.background ?? false,
    cwd: WORK_DIR,
    onStdout: options.onStdout,
    onStderr: options.onStderr,
  });
}

export async function runCommand(
  command: string,
  options?: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    background?: boolean;
    timeoutMs?: number;
  },
): Promise<RunCommandResult> {
  const setupCmd = 'export PATH=$PATH:/home/project/.npm-global/bin:/home/user/.npm-global/bin';
  const shellCommand = `${setupCmd} && ${command}`;

  return runInShell(shellCommand, {
    timeoutMs: options?.timeoutMs,
    background: options?.background,
    onStdout: options?.onStdout,
    onStderr: options?.onStderr,
  });
}

async function runCommandAndWait(
  command: string,
  options?: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    timeoutMs?: number;
  },
): Promise<CommandResult> {
  const result = await runCommand(command, {
    onStdout: options?.onStdout,
    onStderr: options?.onStderr,
    timeoutMs: options?.timeoutMs,
    background: false,
  });

  return waitForCommandResult(result);
}

export function getSandboxUrl(port: number): string {
  if (!globalSandbox) {
    return `http://localhost:${port}`;
  }

  const host = globalSandbox.getHost(port);

  return host.startsWith('http://') || host.startsWith('https://') ? host : `https://${host}`;
}

export function getStoredSnapshotId(): string | null {
  loadSnapshotMetadataFromStorage();
  return snapshotState.lastSnapshotId || getStorageItem(SNAPSHOT_ID_KEY);
}

export function getSnapshotMetadata(): SnapshotMetadata {
  loadSnapshotMetadataFromStorage();

  return {
    sandboxId: globalSandbox?.sandboxId || getStorageItem(SANDBOX_ID_KEY),
    snapshotId: snapshotState.lastSnapshotId || getStorageItem(SNAPSHOT_ID_KEY),
    lastSnapshotAt: snapshotState.lastSnapshotAt,
  };
}

export async function createSandboxSnapshot(reason = 'manual'): Promise<SnapshotInfo> {
  if (snapshotState.inFlight) {
    return snapshotState.inFlight;
  }

  snapshotState.inFlight = (async () => {
    const sandbox = await getE2BSandbox();
    const snapshot = await sandbox.createSnapshot();

    const timestamp = Date.now();
    persistSnapshotMetadata(snapshot.snapshotId, timestamp);
    snapshotState.pendingReason = null;

    console.log(`[E2B] Snapshot created (${reason}): ${snapshot.snapshotId}`);

    return snapshot;
  })().finally(() => {
    snapshotState.inFlight = null;
  });

  return snapshotState.inFlight;
}

export async function flushAutoSnapshot(reason = 'manual_flush'): Promise<SnapshotInfo> {
  clearSnapshotDebounceTimer();
  snapshotState.pendingReason = null;

  return createSandboxSnapshot(reason);
}

export function scheduleAutoSnapshot(reason = 'activity'): void {
  loadSnapshotMetadataFromStorage();

  snapshotState.pendingReason = reason;

  const now = Date.now();
  const lastSnapshotAt = snapshotState.lastSnapshotAt;
  const shouldSnapshotImmediately = lastSnapshotAt !== null && now - lastSnapshotAt >= AUTOSNAPSHOT_MAX_INTERVAL_MS;

  if (shouldSnapshotImmediately) {
    clearSnapshotDebounceTimer();

    void createSandboxSnapshot(`auto:${reason}`).catch((error) => {
      console.warn('[E2B] Autosnapshot failed:', error);
    });

    return;
  }

  clearSnapshotDebounceTimer();

  snapshotState.debounceTimer = setTimeout(() => {
    const pendingReason = snapshotState.pendingReason || reason;
    snapshotState.pendingReason = null;

    void createSandboxSnapshot(`auto:${pendingReason}`).catch((error) => {
      console.warn('[E2B] Autosnapshot failed:', error);
    });
  }, AUTOSNAPSHOT_DEBOUNCE_MS);
}

export async function listSandboxSnapshots(limit = 50): Promise<SnapshotInfo[]> {
  const apiKey = resolveE2BApiKey();
  const cappedLimit = Math.max(1, Math.min(limit, 100));
  const paginator = Sandbox.listSnapshots({
    apiKey,
    limit: cappedLimit,
  });

  const snapshots: SnapshotInfo[] = [];

  while (paginator.hasNext && snapshots.length < cappedLimit) {
    const nextItems = await paginator.nextItems();

    if (nextItems.length === 0) {
      break;
    }

    snapshots.push(...nextItems);
  }

  return snapshots.slice(0, cappedLimit);
}

export async function restoreSandboxFromSnapshot(snapshotId?: string): Promise<Sandbox> {
  const apiKey = resolveE2BApiKey();
  const targetSnapshotId = snapshotId?.trim() || getStoredSnapshotId();

  if (!targetSnapshotId) {
    throw new Error('No snapshotId provided and no stored snapshot available.');
  }

  clearSnapshotDebounceTimer();

  globalSandbox = await Sandbox.create(targetSnapshotId, {
    apiKey,
    timeoutMs: 1_800_000,
  });

  isInitialized = false;
  setStorageItem(SANDBOX_ID_KEY, globalSandbox.sandboxId);
  persistSnapshotMetadata(targetSnapshotId, Date.now());

  await initializeSandboxEnvironment(globalSandbox);

  return globalSandbox;
}

export function getPreferredTemplate(): string | null {
  return resolvePreferredTemplate();
}

export function setPreferredTemplate(
  templateId: string | null,
  options: {
    resetSandbox?: boolean;
  } = {},
): void {
  const normalizedTemplate = templateId?.trim() || null;

  setStorageItem(TEMPLATE_ID_KEY, normalizedTemplate);

  if (options.resetSandbox) {
    setStorageItem(SANDBOX_ID_KEY, null);
    resetConnectionState();
  }
}

export function clearPreferredTemplate(options: { resetSandbox?: boolean } = {}): void {
  setPreferredTemplate(null, options);
}

export async function templateExists(templateName: string): Promise<boolean> {
  return Template.exists(templateName, {
    apiKey: resolveE2BApiKey(),
  });
}

export async function getTemplateTags(templateId: string): Promise<TemplateTag[]> {
  return Template.getTags(templateId, {
    apiKey: resolveE2BApiKey(),
  });
}

export async function assignTemplateTags(targetName: string, tags: string | string[]): Promise<TemplateTagInfo> {
  return Template.assignTags(targetName, tags, {
    apiKey: resolveE2BApiKey(),
  });
}

export async function removeTemplateTags(name: string, tags: string | string[]): Promise<void> {
  await Template.removeTags(name, tags, {
    apiKey: resolveE2BApiKey(),
  });
}

export async function buildTemplateFromSnapshot(
  snapshotId: string,
  templateName: string,
  tags?: string[],
): Promise<TemplateBuildResult> {
  const builder = Template().fromTemplate(snapshotId);

  const build = await Template.build(builder, templateName, {
    apiKey: resolveE2BApiKey(),
    tags,
  });

  return {
    templateName: build.name,
    templateId: build.templateId,
    buildId: build.buildId,
  };
}

export async function pathExists(path: string): Promise<boolean> {
  const result = await runCommandAndWait(`[ -e ${shellEscape(path)} ]`, { timeoutMs: 5000 });
  return result.exitCode === 0;
}

export async function removePath(path: string): Promise<void> {
  const result = await runCommandAndWait(`rm -rf -- ${shellEscape(path)}`, { timeoutMs: 120000 });

  if (result.exitCode !== 0) {
    throw new Error(`Failed to remove path ${path}: ${result.stderr || `exit code ${result.exitCode}`}`);
  }
}
