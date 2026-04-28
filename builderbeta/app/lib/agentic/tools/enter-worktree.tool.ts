import type { Tool, ToolResult, ToolUseContext } from '../types';
import {
  enterWorktreeSession,
  type EnterWorktreeResult,
  type WorktreeSessionMetadata,
} from '~/lib/runtime/git-service';

const WORKTREE_STATE_KEY = 'worktree:active_session';

export interface EnterWorktreeInput {
  name?: string;
}

export interface EnterWorktreeOutput {
  supported: boolean;
  created: boolean;
  reused: boolean;
  message: string;
  session?: WorktreeSessionMetadata;
  runtimeNote: string;
}

export const EnterWorktreeTool: Tool<EnterWorktreeInput, EnterWorktreeOutput> = {
  name: 'enter_worktree',
  displayName: 'Enter Worktree',
  description: `Create or reuse an isolated git worktree session.

This runtime cannot process-level switch CWD like a native CLI, so the tool stores managed worktree session metadata and returns the target path/branch for downstream commands.`,

  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Optional worktree name (letters, digits, dots, underscores, dashes).',
      },
    },
  },

  isReadOnly: false,
  isConcurrencySafe: false,
  category: 'git',
  searchHint: 'worktree enter create isolated branch session',

  async execute(input: EnterWorktreeInput, context: ToolUseContext): Promise<ToolResult<EnterWorktreeOutput>> {
    const existingSession = context.loadState?.<WorktreeSessionMetadata>(WORKTREE_STATE_KEY);

    let result: EnterWorktreeResult;

    try {
      result = await enterWorktreeSession({
        name: input.name,
        session: existingSession,
        cwd: context.workDir || '/home/project',
      });
    } catch (error: any) {
      return {
        success: false,
        data: {
          supported: false,
          created: false,
          reused: false,
          message: error?.message || 'Failed to create worktree session.',
          runtimeNote:
            'Flare runtime stores worktree metadata only; callers should use the returned worktree path explicitly for subsequent operations.',
        },
        error: error?.message || 'Failed to create worktree session.',
      };
    }

    if (result.session) {
      context.persistState?.(WORKTREE_STATE_KEY, result.session);
    }

    const output: EnterWorktreeOutput = {
      supported: result.supported,
      created: result.created,
      reused: result.reused,
      message: result.message,
      session: result.session,
      runtimeNote:
        'Flare runtime stores worktree metadata only; callers should use the returned worktree path explicitly for subsequent operations.',
    };

    return {
      success: result.supported && (result.created || result.reused),
      data: output,
      error: result.supported ? undefined : result.message,
    };
  },
};
