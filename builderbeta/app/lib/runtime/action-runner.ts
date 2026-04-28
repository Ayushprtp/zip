import { map, type MapStore } from 'nanostores';
import { workbenchStore } from '~/lib/stores/workbench';
import { runCommand, scheduleAutoSnapshot, writeFile as writeSandboxFile } from '~/lib/e2b/sandbox';
import { WORK_DIR } from '~/utils/constants';
import { createScopedLogger } from '~/utils/logger';
import { unreachable } from '~/utils/unreachable';
import type { ActionCallbackData } from './message-parser';

const logger = createScopedLogger('ActionRunner');

export type ActionStatus = 'pending' | 'running' | 'complete' | 'aborted' | 'failed';

export interface ActionState {
  id: string;
  type: 'shell' | 'file' | 'terminal';
  content: string;
  status: ActionStatus;
  executed: boolean;
  abortSignal: AbortSignal;
  error?: string;
  filePath?: string;
  workspacePath?: string;
}

type CommandResult = { exitCode: number; stdout: string; stderr: string };
type CommandHandle = { wait: () => Promise<CommandResult> };
type RunCommandResult = CommandResult | CommandHandle;

function isCommandHandle(result: RunCommandResult): result is CommandHandle {
  return typeof (result as CommandHandle).wait === 'function';
}

async function waitForResult(result: RunCommandResult): Promise<CommandResult> {
  if (isCommandHandle(result)) {
    return result.wait();
  }

  return result;
}

function toSandboxAbsolutePath(path: string): string {
  const normalized = path.trim();

  if (!normalized) {
    return WORK_DIR;
  }

  if (normalized.startsWith(WORK_DIR)) {
    return normalized;
  }

  if (normalized.startsWith('/')) {
    return `${WORK_DIR}/${normalized.replace(/^\/+/, '')}`;
  }

  return `${WORK_DIR}/${normalized}`;
}

function toSandboxRelativePath(path: string): string {
  const absolutePath = toSandboxAbsolutePath(path);

  if (absolutePath === WORK_DIR) {
    return '.';
  }

  const withSlash = `${WORK_DIR}/`;

  if (!absolutePath.startsWith(withSlash)) {
    return '.';
  }

  return absolutePath.slice(withSlash.length) || '.';
}

function inferActionWorkspace(action: ActionState): string | undefined {
  if (action.type !== 'file' || !action.filePath) {
    return undefined;
  }

  const absolutePath = toSandboxAbsolutePath(action.filePath);
  const lastSlashIndex = absolutePath.lastIndexOf('/');

  if (lastSlashIndex <= WORK_DIR.length) {
    return WORK_DIR;
  }

  return absolutePath.slice(0, lastSlashIndex);
}

function inferCommandWorkspace(command: string): string | undefined {
  const trimmed = command.trim();

  if (!trimmed) {
    return undefined;
  }

  const cdMatch = trimmed.match(/^cd\s+([^;&\n]+)(?:\s*(?:&&|;).*)?$/);

  if (!cdMatch?.[1]) {
    return undefined;
  }

  const target = cdMatch[1].trim().replace(/^['"]|['"]$/g, '');

  if (!target) {
    return undefined;
  }

  return toSandboxAbsolutePath(target);
}

function prependCommandCwd(command: string, cwd: string): string {
  const trimmed = command.trim();

  if (!trimmed) {
    return command;
  }

  if (/^cd\s+/.test(trimmed)) {
    return trimmed;
  }

  const normalizedCwd = toSandboxAbsolutePath(cwd);

  if (normalizedCwd === WORK_DIR) {
    return trimmed;
  }

  return `cd ${toSandboxRelativePath(normalizedCwd)} && ${trimmed}`;
}

function getFileName(path: string): string {
  const normalized = path.trim().replace(/\/+$/, '');
  const lastSlashIndex = normalized.lastIndexOf('/');

  if (lastSlashIndex < 0) {
    return normalized;
  }

  return normalized.slice(lastSlashIndex + 1);
}

const PROJECT_ROOT_MARKERS = new Set([
  'package.json',
  'pnpm-workspace.yaml',
  'yarn.lock',
  'package-lock.json',
  'bun.lockb',
  'Cargo.toml',
  'go.mod',
  'pyproject.toml',
  'requirements.txt',
  'Pipfile',
  'Gemfile',
  'composer.json',
]);

function isProjectRootMarkerPath(path: string): boolean {
  return PROJECT_ROOT_MARKERS.has(getFileName(path));
}

function inferWorkspaceFromEarlierFileActions(actions: Record<string, ActionState>, actionId: string): string | undefined {
  let fallbackWorkspace: string | undefined;
  let markerWorkspace: string | undefined;

  for (const [id, action] of Object.entries(actions)) {
    if (id === actionId) {
      break;
    }

    if (action.type !== 'file' || !action.filePath || action.status === 'failed') {
      continue;
    }

    const actionWorkspace = inferActionWorkspace(action);

    if (!actionWorkspace) {
      continue;
    }

    fallbackWorkspace = actionWorkspace;

    if (isProjectRootMarkerPath(action.filePath)) {
      markerWorkspace = actionWorkspace;
    }
  }

  return markerWorkspace || fallbackWorkspace;
}

export class ActionRunner {
  actions: MapStore<Record<string, ActionState>> = map({});
  #currentExecutionPromise: Promise<void> = Promise.resolve();

  addAction(data: ActionCallbackData) {
    const { actionId } = data;
    const actions = this.actions.get();

    if (actions[actionId]) {
      return;
    }

    this.actions.setKey(actionId, {
      ...data.action,
      id: actionId,
      status: 'pending',
      executed: false,
      abortSignal: new AbortController().signal,
    });
  }

  async runAction(data: ActionCallbackData, files: FileMap) {
    const { actionId } = data;
    const action = this.actions.get()[actionId];

    if (!action || action.executed) {
      return;
    }

    if (data.action.type === 'file') {
      this.#updateAction(actionId, {
        content: data.action.content,
        filePath: data.action.filePath,
      });
    }

    this.#updateAction(actionId, { executed: true });

    this.#currentExecutionPromise = this.#currentExecutionPromise
      .then(async () => {
        return this.#executeAction(actionId, data);
      })
      .catch((error) => {
        logger.error('Action failed:', error);
      });

    return this.#currentExecutionPromise;
  }

  async #executeAction(actionId: string, data: ActionCallbackData) {
    const action = this.actions.get()[actionId];

    if (!action) {
      unreachable('Action not found during execution');
    }

    this.#updateAction(actionId, { status: 'running' });

    try {
      switch (action.type) {
        case 'shell': {
          await this.#runShellAction(actionId, action);
          break;
        }
        case 'file': {
          await this.#runFileAction(action, data);
          break;
        }
        case 'terminal': {
          await this.#runTerminalAction(actionId, action);
          break;
        }
      }

      const currentAction = this.actions.get()[actionId];
      const shouldMarkComplete = currentAction?.status !== 'failed';

      if (shouldMarkComplete) {
        this.#updateAction(actionId, { status: action.abortSignal.aborted ? 'aborted' : 'complete' });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Action failed';
      this.#updateAction(actionId, { status: 'failed', error: errorMessage });
      throw error;
    }
  }

  #updateAction(id: string, update: Partial<ActionState>) {
    const action = this.actions.get()[id];

    if (action) {
      this.actions.setKey(id, { ...action, ...update });
    }
  }

  #getActiveWorkspaceForAction(actionId: string): string {
    const actions = this.actions.get();
    const action = actions[actionId];

    if (!action) {
      return WORK_DIR;
    }

    const explicitWorkspace = action.workspacePath;

    if (explicitWorkspace) {
      return toSandboxAbsolutePath(explicitWorkspace);
    }

    const commandWorkspace = action.type === 'shell' ? inferCommandWorkspace(action.content) : undefined;

    if (commandWorkspace) {
      return commandWorkspace;
    }

    const earlierFileWorkspace = inferWorkspaceFromEarlierFileActions(actions, actionId);

    if (earlierFileWorkspace) {
      return earlierFileWorkspace;
    }

    const selectedFile = workbenchStore.selectedFile.get();

    if (selectedFile) {
      return inferActionWorkspace({ type: 'file', filePath: selectedFile } as ActionState) || WORK_DIR;
    }

    return WORK_DIR;
  }

  async #runShellAction(actionId: string, action: ActionState) {
    try {
      const terminalList = workbenchStore.terminalStore.terminals.get();
      const e2bTerminalIndex = terminalList.findIndex((t) => t.terminal);
      const outputTerminalIndex = e2bTerminalIndex >= 0 ? e2bTerminalIndex : 0;
      const e2bTerminal = e2bTerminalIndex >= 0 ? terminalList[e2bTerminalIndex] : undefined;
      const workspace = this.#getActiveWorkspaceForAction(actionId);
      const commandToRun = prependCommandCwd(action.content, workspace);

      if (e2bTerminal?.terminal) {
        e2bTerminal.terminal.write(`${commandToRun}\r\n`);
      }

      const runsInBackground = action.content.includes('dev') || action.content.includes('start');
      const runResult = await runCommand(commandToRun, {
        background: runsInBackground,
        timeoutMs: runsInBackground ? 0 : 600_000,
        onStdout: (data) => {
          logger.debug(`[Shell] ${data}`);
          workbenchStore.terminalStore.captureOutput(outputTerminalIndex, data);

          if (e2bTerminal?.terminal) {
            e2bTerminal.terminal.write(data + '\r\n');
          }
        },
        onStderr: (data) => {
          logger.error(`[Shell Error] ${data}`);
          workbenchStore.terminalStore.captureOutput(outputTerminalIndex, data);

          if (e2bTerminal?.terminal) {
            e2bTerminal.terminal.write(`\x1b[31m${data}\x1b[0m\r\n`);
          }
        },
      });

      scheduleAutoSnapshot(runsInBackground ? 'shell_background_start' : 'shell_command');

      if (!runsInBackground) {
        const result = await waitForResult(runResult);

        if (result.exitCode !== 0) {
          const stderr = result.stderr?.trim();
          const errorMessage = stderr
            ? `Command failed with exit code ${result.exitCode}: ${stderr}`
            : `Command failed with exit code ${result.exitCode}`;

          this.#updateAction(actionId, { status: 'failed', error: errorMessage });
          throw new Error(errorMessage);
        }
      }
    } catch (error) {
      logger.error('Shell action failed', error);
      throw error;
    }
  }

  async #runFileAction(action: ActionState, data: ActionCallbackData) {
    if (action.type !== 'file' || !action.filePath) {
      return;
    }

    await writeSandboxFile(action.filePath, action.content);
    workbenchStore.streamFileAction(data);
    scheduleAutoSnapshot('stream_file_action');
  }

  async #runTerminalAction(actionId: string, action: ActionState) {
    // Terminal input logic
  }
}

export type FileMap = Record<string, { type: 'file' | 'folder'; content?: string }>;
