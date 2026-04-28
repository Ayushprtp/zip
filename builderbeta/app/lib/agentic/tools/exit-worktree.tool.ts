import type { Tool, ToolResult, ToolUseContext } from '../types';
import {
  exitWorktreeSession,
  type ExitWorktreeResult,
  type WorktreeSessionMetadata,
} from '~/lib/runtime/git-service';

const WORKTREE_STATE_KEY = 'worktree:active_session';

export interface ExitWorktreeInput {
  action: 'keep' | 'remove';
  discard_changes?: boolean;
}

export interface ExitWorktreeOutput {
  supported: boolean;
  exited: boolean;
  removed: boolean;
  discardedChanges: boolean;
  message: string;
  session?: WorktreeSessionMetadata;
  dirtySummary?: string;
  runtimeNote: string;
}

export const ExitWorktreeTool: Tool<ExitWorktreeInput, ExitWorktreeOutput> = {
  name: 'exit_worktree',
  displayName: 'Exit Worktree',
  description: `Exit a managed worktree session.

Action 'keep' preserves the worktree and branch. Action 'remove' deletes the worktree and branch, but refuses destructive removal when dirty unless discard_changes=true.`,

  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['keep', 'remove'],
        description: 'Whether to keep or remove the managed worktree session.',
      },
      discard_changes: {
        type: 'boolean',
        description: 'Required true to remove a dirty worktree session.',
      },
    },
    required: ['action'],
  },

  isReadOnly: false,
  isConcurrencySafe: false,
  category: 'git',
  searchHint: 'worktree exit keep remove discard changes',

  async execute(input: ExitWorktreeInput, context: ToolUseContext): Promise<ToolResult<ExitWorktreeOutput>> {
    const session = context.loadState?.<WorktreeSessionMetadata>(WORKTREE_STATE_KEY);

    let result: ExitWorktreeResult;

    try {
      result = await exitWorktreeSession({
        action: input.action,
        discardChanges: input.discard_changes,
        session,
      });
    } catch (error: any) {
      return {
        success: false,
        data: {
          supported: false,
          exited: false,
          removed: false,
          discardedChanges: false,
          message: error?.message || 'Failed to exit worktree session.',
          runtimeNote:
            'Flare runtime stores worktree metadata only; callers should route subsequent operations to their chosen working directory.',
        },
        error: error?.message || 'Failed to exit worktree session.',
      };
    }

    if (result.exited && (input.action === 'keep' || result.removed)) {
      context.persistState?.(WORKTREE_STATE_KEY, undefined);
    }

    const output: ExitWorktreeOutput = {
      supported: result.supported,
      exited: result.exited,
      removed: result.removed,
      discardedChanges: result.discardedChanges,
      message: result.message,
      session: result.session,
      dirtySummary: result.dirtySummary,
      runtimeNote:
        'Flare runtime stores worktree metadata only; callers should route subsequent operations to their chosen working directory.',
    };

    return {
      success: result.supported && result.exited,
      data: output,
      error: result.supported && result.exited ? undefined : result.message,
    };
  },
};
