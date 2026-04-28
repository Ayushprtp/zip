/**
 * Sleep Tool — Pause agent execution (Kairos feature)
 * Inspired by Claude Code's SleepTool (feature: PROACTIVE / KAIROS)
 *
 * Allows agents to sleep/wait for a specified duration.
 * Useful for proactive agents that need to wait between checks.
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';

export interface SleepInput {
  /** Duration in seconds to sleep */
  duration_seconds: number;
  /** Reason for sleeping (for logging) */
  reason?: string;
}

export const SleepTool: Tool<SleepInput, { slept_seconds: number; interrupted: boolean }> = {
  name: 'sleep',
  displayName: 'Sleep',
  description: `Wait for a specified duration. Use when:
- Waiting for a background process to complete
- Polling for changes at intervals
- The user asks you to sleep or rest
- You're waiting for an external event

Prefer this over \`bash(sleep ...)\` — it doesn't hold a shell process.
Each wake-up costs an API call. Max sleep: 300 seconds.`,

  inputSchema: {
    type: 'object',
    properties: {
      duration_seconds: {
        type: 'number',
        description: 'How long to sleep in seconds (max 300)',
      },
      reason: {
        type: 'string',
        description: 'Why the agent is sleeping (for logging)',
      },
    },
    required: ['duration_seconds'],
  },

  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'utility',
  searchHint: 'sleep wait pause delay timer',

  async execute(input: SleepInput, context: ToolUseContext): Promise<ToolResult<{ slept_seconds: number; interrupted: boolean }>> {
    const duration = Math.min(Math.max(input.duration_seconds, 0), 300);
    const startTime = Date.now();

    console.log(`[Sleep] Sleeping for ${duration}s${input.reason ? ` (${input.reason})` : ''}`);

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const actual = (Date.now() - startTime) / 1000;
        resolve({
          success: true,
          data: { slept_seconds: Math.round(actual * 10) / 10, interrupted: false },
        });
      }, duration * 1000);

      // Support abort signal
      if (context.abortSignal) {
        context.abortSignal.addEventListener('abort', () => {
          clearTimeout(timer);
          const actual = (Date.now() - startTime) / 1000;
          resolve({
            success: true,
            data: { slept_seconds: Math.round(actual * 10) / 10, interrupted: true },
          });
        }, { once: true });
      }
    });
  },
};
