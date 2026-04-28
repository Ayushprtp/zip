import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolUseContext } from './types';

const {
  mockGetPermissionPolicyConfig,
  mockEvaluatePermissionPolicy,
  mockGetTool,
  mockAddActiveToolCall,
  mockCompleteActiveToolCall,
} = vi.hoisted(() => ({
  mockGetPermissionPolicyConfig: vi.fn(),
  mockEvaluatePermissionPolicy: vi.fn(),
  mockGetTool: vi.fn(),
  mockAddActiveToolCall: vi.fn(),
  mockCompleteActiveToolCall: vi.fn(),
}));

vi.mock('~/lib/stores/settings', () => ({
  getPermissionPolicyConfig: mockGetPermissionPolicyConfig,
}));

vi.mock('./permissions/policy', () => ({
  evaluatePermissionPolicy: mockEvaluatePermissionPolicy,
}));

vi.mock('./registry', () => ({
  agenticRegistry: {
    getTool: mockGetTool,
  },
}));

vi.mock('./stores', () => ({
  addActiveToolCall: mockAddActiveToolCall,
  completeActiveToolCall: mockCompleteActiveToolCall,
}));

import { executeTool } from './executor';

const baseContext: ToolUseContext = {
  workDir: '/home/project',
};

describe('executeTool', () => {
  beforeEach(() => {
    mockGetPermissionPolicyConfig.mockReset();
    mockEvaluatePermissionPolicy.mockReset();
    mockGetTool.mockReset();
    mockAddActiveToolCall.mockReset();
    mockCompleteActiveToolCall.mockReset();
  });

  it('executes tool immediately when policy allows', async () => {
    const toolExecute = vi.fn().mockResolvedValue({ success: true, data: { ok: true } });

    mockGetTool.mockImplementation((name: string) => (name === 'bash' ? { execute: toolExecute } : undefined));

    mockEvaluatePermissionPolicy.mockReturnValue({
      decision: 'allow',
      allowed: true,
      reasonCode: 'MODE_DONT_ASK_ALLOW',
      reason: 'Allowed by mode.',
    });

    const result = await executeTool('bash', { command: 'pwd' }, baseContext);

    expect(result).toEqual({ success: true, data: { ok: true } });
    expect(toolExecute).toHaveBeenCalledWith({ command: 'pwd' }, baseContext, undefined);
    expect(mockAddActiveToolCall).toHaveBeenCalledTimes(1);
    expect(mockCompleteActiveToolCall).toHaveBeenCalledWith(
      expect.any(String),
      { success: true, data: { ok: true } },
      true,
    );
  });

  it('requests approval for ask decisions and executes when approved', async () => {
    const askExecute = vi.fn().mockResolvedValue({
      success: true,
      data: {
        answers: [{ questionId: 'tool_approval', selectedOption: 'Allow' }],
      },
    });

    const targetExecute = vi.fn().mockResolvedValue({ success: true, data: { changed: true } });

    mockGetTool.mockImplementation((name: string) => {
      if (name === 'ask_user_question') {
        return { execute: askExecute };
      }

      if (name === 'file_write') {
        return { execute: targetExecute };
      }

      return undefined;
    });

    mockEvaluatePermissionPolicy.mockReturnValue({
      decision: 'ask',
      allowed: false,
      reasonCode: 'MODE_DEFAULT_MUTATION_ASK',
      reason: 'Needs user approval.',
    });

    const result = await executeTool('file_write', { path: '/tmp/a.txt', content: 'x' }, baseContext);

    expect(result).toEqual({ success: true, data: { changed: true } });
    expect(askExecute).toHaveBeenCalledTimes(1);
    expect(askExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Tool approval required',
        questions: [expect.objectContaining({ id: 'tool_approval', options: ['Allow', 'Deny'] })],
      }),
      baseContext,
      undefined,
    );
    expect(targetExecute).toHaveBeenCalledTimes(1);
    expect(mockAddActiveToolCall).toHaveBeenCalledTimes(1);
  });

  it('blocks execution when ask approval is denied', async () => {
    const askExecute = vi.fn().mockResolvedValue({
      success: true,
      data: {
        answers: [{ questionId: 'tool_approval', selectedOption: 'Deny' }],
      },
    });

    const targetExecute = vi.fn();

    mockGetTool.mockImplementation((name: string) => {
      if (name === 'ask_user_question') {
        return { execute: askExecute };
      }

      if (name === 'file_write') {
        return { execute: targetExecute };
      }

      return undefined;
    });

    mockEvaluatePermissionPolicy.mockReturnValue({
      decision: 'ask',
      allowed: false,
      reasonCode: 'MODE_DEFAULT_MUTATION_ASK',
      reason: 'Needs user approval.',
    });

    await expect(executeTool('file_write', { path: '/tmp/a.txt' }, baseContext)).rejects.toThrow(
      /was not approved/,
    );

    expect(targetExecute).not.toHaveBeenCalled();
    expect(mockAddActiveToolCall).not.toHaveBeenCalled();
  });

  it('blocks execution immediately for deny decisions', async () => {
    const askExecute = vi.fn();
    const targetExecute = vi.fn();

    mockGetTool.mockImplementation((name: string) => {
      if (name === 'ask_user_question') {
        return { execute: askExecute };
      }

      if (name === 'file_write') {
        return { execute: targetExecute };
      }

      return undefined;
    });

    mockEvaluatePermissionPolicy.mockReturnValue({
      decision: 'deny',
      allowed: false,
      reasonCode: 'RULE_MATCH_DENY',
      reason: 'Denied by explicit rule.',
    });

    await expect(executeTool('file_write', { path: '/tmp/a.txt' }, baseContext)).rejects.toThrow(
      /denied by policy/,
    );

    expect(askExecute).not.toHaveBeenCalled();
    expect(targetExecute).not.toHaveBeenCalled();
  });
});
