import { getE2BSandbox, pathExists, removePath } from '~/lib/e2b/sandbox';
import { workbenchStore } from '~/lib/stores/workbench';
import { authStore } from './auth';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('GitService');

const DEFAULT_WORKTREE_PARENT = '.claude/worktrees';

export interface GitStatus {
  filepath: string;
  status: 'added' | 'modified' | 'deleted' | 'untracked' | 'staged';
}

export interface WorktreeSessionMetadata {
  id: string;
  repoRoot: string;
  createdFromCwd: string;
  worktreePath: string;
  branch: string;
  parentDir: string;
  managed: boolean;
  createdAt: number;
}

export interface WorktreeFeatureInfo {
  supported: boolean;
  reason?: string;
  repoRoot?: string;
}

export interface EnterWorktreeResult {
  supported: boolean;
  created: boolean;
  reused: boolean;
  message: string;
  session?: WorktreeSessionMetadata;
}

export interface ExitWorktreeResult {
  supported: boolean;
  exited: boolean;
  removed: boolean;
  discardedChanges: boolean;
  message: string;
  session?: WorktreeSessionMetadata;
  dirtySummary?: string;
}

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface EnterWorktreeOptions {
  name?: string;
  session?: WorktreeSessionMetadata;
  cwd?: string;
}

interface ExitWorktreeOptions {
  action: 'keep' | 'remove';
  discardChanges?: boolean;
  session?: WorktreeSessionMetadata;
}

export async function cloneRepository(repoUrl: string, _repoName: string) {
  const { githubToken } = authStore.get();

  logger.info(`Cloning ${repoUrl} using E2B sandbox...`);

  return cloneE2B(repoUrl, githubToken);
}

async function cloneE2B(repoUrl: string, token?: string) {
  const sandbox = await getE2BSandbox();
  const authUrl = token ? repoUrl.replace('https://', `https://${token}@`) : repoUrl;

  const result = await sandbox.commands.run(`git clone ${authUrl} .`, {
    onStdout: (data) => logger.debug(data),
    onStderr: (data) => logger.error(data),
  });

  if (result.exitCode !== 0) {
    throw new Error(`Git clone failed with exit code ${result.exitCode}`);
  }
}

export async function getGitStatus(): Promise<GitStatus[]> {
  try {
    const filesStore = workbenchStore.filesStore;

    if (!filesStore) {
      return [];
    }

    const files = filesStore.files.get();
    const modifications = filesStore.getFileModifications();
    const statuses: GitStatus[] = [];

    if (modifications) {
      for (const [filePath] of Object.entries(modifications)) {
        const cleanPath = filePath.replace(/^\/home\/project\//, '');
        statuses.push({
          filepath: cleanPath,
          status: 'modified',
        });
      }
    }

    if (statuses.length === 0) {
      for (const [path, dirent] of Object.entries(files)) {
        if (dirent?.type === 'file') {
          const cleanPath = path.replace(/^\/home\/project\//, '');

          if (cleanPath.includes('node_modules') || cleanPath.startsWith('.')) {
            continue;
          }

          statuses.push({
            filepath: cleanPath,
            status: 'added',
          });
        }
      }
    }

    return statuses;
  } catch (error) {
    logger.error('Failed to get git status:', error);
    return [];
  }
}

export async function gitCommit(message: string) {
  const sandbox = await getE2BSandbox();
  await sandbox.commands.run(`git add . && git commit -m "${message}"`);
}

export async function gitPush() {
  const sandbox = await getE2BSandbox();
  await sandbox.commands.run('git push');
}

export async function gitPull() {
  const sandbox = await getE2BSandbox();
  await sandbox.commands.run('git pull');
}

export async function getWorktreeFeatureInfo(cwd = '/home/project'): Promise<WorktreeFeatureInfo> {
  try {
    const gitVersion = await runShellCommand('git --version', cwd, 10_000);
    if (gitVersion.exitCode !== 0) {
      return { supported: false, reason: 'git binary is not available in this runtime.' };
    }

    const inRepo = await runGitCommand(cwd, 'rev-parse --is-inside-work-tree', 10_000);
    if (inRepo.exitCode !== 0 || inRepo.stdout.trim() !== 'true') {
      return { supported: false, reason: 'Current runtime is not inside a git repository.' };
    }

    const listWorktrees = await runGitCommand(cwd, 'worktree list --porcelain', 10_000);
    if (listWorktrees.exitCode !== 0) {
      return {
        supported: false,
        reason: `git worktree is not supported or disabled in this runtime: ${trimError(listWorktrees.stderr)}`,
      };
    }

    const repoRoot = await getRepoRoot(cwd);
    return { supported: true, repoRoot };
  } catch (error: any) {
    return { supported: false, reason: `Runtime check failed: ${error?.message || 'unknown error'}` };
  }
}

export async function enterWorktreeSession(options: EnterWorktreeOptions = {}): Promise<EnterWorktreeResult> {
  const cwd = options.cwd || '/home/project';
  const featureInfo = await getWorktreeFeatureInfo(cwd);

  if (!featureInfo.supported || !featureInfo.repoRoot) {
    return {
      supported: false,
      created: false,
      reused: false,
      message: featureInfo.reason || 'git worktree is unavailable in this runtime.',
    };
  }

  if (options.session?.managed) {
    const exists = await pathExists(options.session.worktreePath);
    if (exists) {
      return {
        supported: true,
        created: false,
        reused: true,
        message: 'Active worktree session already exists. Reusing current session metadata.',
        session: options.session,
      };
    }
  }

  const repoRoot = featureInfo.repoRoot;
  const id = sanitizeWorktreeName(options.name) || generateSessionId();
  const branch = buildBranchName(id);
  const parentDir = `${repoRoot}/${DEFAULT_WORKTREE_PARENT}`;
  const worktreePath = `${parentDir}/${id}`;

  const ensureParent = await runShellCommand(`mkdir -p ${shellEscape(parentDir)}`, repoRoot, 30_000);
  if (ensureParent.exitCode !== 0) {
    throw new Error(`Unable to create worktree parent directory: ${trimError(ensureParent.stderr)}`);
  }

  const create = await runGitCommand(repoRoot, `worktree add -b ${shellEscape(branch)} ${shellEscape(worktreePath)} HEAD`, 120_000);
  if (create.exitCode !== 0) {
    throw new Error(`Failed to create worktree: ${trimError(create.stderr)}`);
  }

  const session: WorktreeSessionMetadata = {
    id,
    repoRoot,
    createdFromCwd: cwd,
    worktreePath,
    branch,
    parentDir,
    managed: true,
    createdAt: Date.now(),
  };

  return {
    supported: true,
    created: true,
    reused: false,
    message: 'Created isolated worktree session.',
    session,
  };
}

export async function exitWorktreeSession(options: ExitWorktreeOptions): Promise<ExitWorktreeResult> {
  const cwd = options.session?.repoRoot || '/home/project';
  const featureInfo = await getWorktreeFeatureInfo(cwd);

  if (!featureInfo.supported) {
    return {
      supported: false,
      exited: false,
      removed: false,
      discardedChanges: false,
      message: featureInfo.reason || 'git worktree is unavailable in this runtime.',
      session: options.session,
    };
  }

  if (!options.session?.managed) {
    return {
      supported: true,
      exited: false,
      removed: false,
      discardedChanges: false,
      message: 'No active managed worktree session found.',
    };
  }

  if (options.action === 'keep') {
    return {
      supported: true,
      exited: true,
      removed: false,
      discardedChanges: false,
      message: 'Exited worktree session and kept worktree directory on disk.',
      session: options.session,
    };
  }

  const dirtySummary = await getWorktreeDirtySummary(options.session.worktreePath);

  if (dirtySummary && options.discardChanges !== true) {
    return {
      supported: true,
      exited: false,
      removed: false,
      discardedChanges: false,
      message: 'Refusing to remove worktree because it contains uncommitted changes. Set discard_changes=true to proceed.',
      session: options.session,
      dirtySummary,
    };
  }

  const forceFlag = options.discardChanges ? '--force' : '';
  const removeResult = await runGitCommand(
    options.session.repoRoot,
    `worktree remove ${forceFlag} ${shellEscape(options.session.worktreePath)}`.trim(),
    120_000,
  );

  if (removeResult.exitCode !== 0) {
    const exists = await pathExists(options.session.worktreePath);

    if (exists && options.discardChanges) {
      await removePath(options.session.worktreePath);
    } else {
      throw new Error(`Failed to remove worktree: ${trimError(removeResult.stderr)}`);
    }
  }

  await runGitCommand(options.session.repoRoot, `branch -D ${shellEscape(options.session.branch)}`, 30_000);

  return {
    supported: true,
    exited: true,
    removed: true,
    discardedChanges: options.discardChanges === true,
    message: 'Removed worktree session and deleted managed branch.',
    session: options.session,
    dirtySummary: dirtySummary || undefined,
  };
}

async function getRepoRoot(cwd: string): Promise<string> {
  const result = await runGitCommand(cwd, 'rev-parse --show-toplevel', 10_000);

  if (result.exitCode !== 0) {
    throw new Error(`Unable to resolve git repository root: ${trimError(result.stderr)}`);
  }

  return result.stdout.trim();
}

async function getWorktreeDirtySummary(worktreePath: string): Promise<string> {
  const status = await runGitCommand(worktreePath, 'status --porcelain', 10_000);

  if (status.exitCode !== 0) {
    return `Unable to inspect worktree status: ${trimError(status.stderr)}`;
  }

  const summary = status.stdout.trim();
  return summary.length > 0 ? summary : '';
}

async function runGitCommand(cwd: string, args: string, timeoutMs = 120_000): Promise<CommandResult> {
  return runShellCommand(`git -C ${shellEscape(cwd)} ${args}`, cwd, timeoutMs);
}

async function runShellCommand(command: string, cwd: string, timeoutMs = 120_000): Promise<CommandResult> {
  const sandbox = await getE2BSandbox();
  const escapedCwd = shellEscape(cwd);
  const result = await sandbox.commands.run(`cd ${escapedCwd} && ${command}`, { timeoutMs });

  return {
    exitCode: result.exitCode ?? 0,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function sanitizeWorktreeName(name?: string): string {
  if (!name) {
    return '';
  }

  const cleaned = name.trim().replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 64);
  return cleaned.replace(/^-+/, '').replace(/-+$/, '');
}

function buildBranchName(name: string): string {
  const stem = sanitizeWorktreeName(name) || generateSessionId();
  return `claude-worktree/${stem}`;
}

function generateSessionId(): string {
  return `wt-${Math.random().toString(36).slice(2, 10)}`;
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function trimError(stderr: string): string {
  const text = stderr.trim();
  return text.length > 0 ? text : 'unknown git error';
}
