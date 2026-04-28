import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WORK_DIR } from '~/utils/constants';
import type { ActionCallbackData } from './message-parser';

const {
  mockRunCommand,
  mockScheduleAutoSnapshot,
  mockWriteFile,
  mockTerminalsGet,
  mockCaptureOutput,
  mockStreamFileAction,
  selectedFileStore,
} = vi.hoisted(() => {
  let selectedFile: string | undefined;

  return {
    mockRunCommand: vi.fn(),
    mockScheduleAutoSnapshot: vi.fn(),
    mockWriteFile: vi.fn(),
    mockTerminalsGet: vi.fn(),
    mockCaptureOutput: vi.fn(),
    mockStreamFileAction: vi.fn(),
    selectedFileStore: {
      get: vi.fn(() => selectedFile),
      set: (value: string | undefined) => {
        selectedFile = value;
      },
    },
  };
});

vi.mock('~/lib/e2b/sandbox', () => ({
  runCommand: mockRunCommand,
  scheduleAutoSnapshot: mockScheduleAutoSnapshot,
  writeFile: mockWriteFile,
}));

vi.mock('~/lib/stores/workbench', () => ({
  workbenchStore: {
    terminalStore: {
      terminals: {
        get: mockTerminalsGet,
      },
      captureOutput: mockCaptureOutput,
    },
    streamFileAction: mockStreamFileAction,
    selectedFile: selectedFileStore,
  },
}));

import { ActionRunner } from './action-runner';

function createFileActionData(content: string, filePath = 'package.json', actionId = 'file-action-1'): ActionCallbackData {
  return {
    artifactId: 'artifact-1',
    messageId: 'message-1',
    actionId,
    action: {
      type: 'file',
      filePath,
      content,
    },
  };
}

function createShellActionData(content: string, actionId = 'shell-action-1'): ActionCallbackData {
  return {
    artifactId: 'artifact-1',
    messageId: 'message-1',
    actionId,
    action: {
      type: 'shell',
      content,
    },
  };
}

describe('ActionRunner', () => {
  beforeEach(() => {
    mockRunCommand.mockReset();
    mockScheduleAutoSnapshot.mockReset();
    mockWriteFile.mockReset();
    mockTerminalsGet.mockReset();
    mockCaptureOutput.mockReset();
    mockStreamFileAction.mockReset();
    selectedFileStore.set(undefined);
    selectedFileStore.get.mockReset();
    selectedFileStore.get.mockImplementation(() => undefined);

    mockTerminalsGet.mockReturnValue([{ terminal: null }]);
    mockRunCommand.mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
    mockWriteFile.mockResolvedValue(undefined);
  });

  it('writes finalized file action content to sandbox', async () => {
    const runner = new ActionRunner();
    const openData = createFileActionData('');
    const closeData = createFileActionData('{"name":"space-invaders"}');

    runner.addAction(openData);
    await runner.runAction(closeData, {});

    expect(mockWriteFile).toHaveBeenCalledWith('package.json', '{"name":"space-invaders"}');
    expect(mockStreamFileAction).toHaveBeenCalledWith(closeData);
    expect(mockScheduleAutoSnapshot).toHaveBeenCalledWith('stream_file_action');
  });

  it('executes queued file write before shell command', async () => {
    const runner = new ActionRunner();
    const openFileData = createFileActionData('');
    const closeFileData = createFileActionData('{"name":"space-invaders"}');
    const shellData = createShellActionData('npm run dev');

    runner.addAction(openFileData);
    runner.addAction(shellData);

    const filePromise = runner.runAction(closeFileData, {});
    const shellPromise = runner.runAction(shellData, {});

    await Promise.all([filePromise, shellPromise]);

    expect(mockWriteFile).toHaveBeenCalledWith('package.json', '{"name":"space-invaders"}');
    expect(mockRunCommand).toHaveBeenCalledWith(
      'npm run dev',
      expect.objectContaining({
        background: true,
      }),
    );

    const writeCallOrder = mockWriteFile.mock.invocationCallOrder[0];
    const runCallOrder = mockRunCommand.mock.invocationCallOrder[0];

    expect(writeCallOrder).toBeLessThan(runCallOrder);
  });

  it('runs shell command from directory inferred from earlier file action', async () => {
    const runner = new ActionRunner();
    const openFileData = createFileActionData('', 'apps/demo/package.json', 'file-action-1');
    const closeFileData = createFileActionData('{"name":"demo"}', 'apps/demo/package.json', 'file-action-1');
    const shellData = createShellActionData('npm install', 'shell-action-1');

    runner.addAction(openFileData);
    runner.addAction(shellData);

    await runner.runAction(closeFileData, {});
    await runner.runAction(shellData, {});

    expect(mockRunCommand).toHaveBeenCalledWith(
      'cd apps/demo && npm install',
      expect.objectContaining({
        background: false,
        timeoutMs: 600000,
      }),
    );
  });

  it('keeps shell command unchanged when command already starts with cd', async () => {
    const runner = new ActionRunner();
    selectedFileStore.set(`${WORK_DIR}/apps/demo/src/index.ts`);
    selectedFileStore.get.mockImplementation(() => `${WORK_DIR}/apps/demo/src/index.ts`);
    const shellData = createShellActionData('cd apps/demo && npm run dev');

    runner.addAction(shellData);
    await runner.runAction(shellData, {});

    expect(mockRunCommand).toHaveBeenCalledWith(
      'cd apps/demo && npm run dev',
      expect.objectContaining({
        background: true,
      }),
    );
  });

  it('uses selected file workspace when no prior file actions exist', async () => {
    const runner = new ActionRunner();
    selectedFileStore.set(`${WORK_DIR}/apps/playground/src/main.ts`);
    selectedFileStore.get.mockImplementation(() => `${WORK_DIR}/apps/playground/src/main.ts`);
    const shellData = createShellActionData('pnpm test');

    runner.addAction(shellData);
    await runner.runAction(shellData, {});

    expect(mockRunCommand).toHaveBeenCalledWith(
      'cd apps/playground/src && pnpm test',
      expect.objectContaining({
        background: false,
      }),
    );
  });

  it('prefers project root marker workspace over later source file workspace', async () => {
    const runner = new ActionRunner();
    const rootOpen = createFileActionData('', 'apps/demo/package.json', 'file-action-root');
    const rootClose = createFileActionData('{"name":"demo"}', 'apps/demo/package.json', 'file-action-root');
    const nestedOpen = createFileActionData('', 'apps/demo/src/main.ts', 'file-action-src');
    const nestedClose = createFileActionData('export const x = 1;', 'apps/demo/src/main.ts', 'file-action-src');
    const shellData = createShellActionData('pnpm dev', 'shell-action-1');

    runner.addAction(rootOpen);
    runner.addAction(nestedOpen);
    runner.addAction(shellData);

    await runner.runAction(rootClose, {});
    await runner.runAction(nestedClose, {});
    await runner.runAction(shellData, {});

    expect(mockRunCommand).toHaveBeenCalledWith(
      'cd apps/demo && pnpm dev',
      expect.objectContaining({
        background: true,
      }),
    );
  });

  it('uses extended timeout for foreground shell command', async () => {
    const runner = new ActionRunner();
    const shellData = createShellActionData('npm install');

    runner.addAction(shellData);
    await runner.runAction(shellData, {});

    expect(mockRunCommand).toHaveBeenCalledWith(
      'npm install',
      expect.objectContaining({
        background: false,
        timeoutMs: 600000,
      }),
    );
  });

  it('marks shell action as failed and preserves failure state', async () => {
    const runner = new ActionRunner();
    const shellData = createShellActionData('npm install');

    mockRunCommand.mockResolvedValueOnce({
      exitCode: 1,
      stdout: '',
      stderr: 'ERR_PNPM_FETCH_404',
    });

    runner.addAction(shellData);
    await runner.runAction(shellData, {});

    const state = runner.actions.get()[shellData.actionId];

    expect(state.status).toBe('failed');
    expect(state.error).toContain('exit code 1');
    expect(state.error).toContain('ERR_PNPM_FETCH_404');
  });
});
