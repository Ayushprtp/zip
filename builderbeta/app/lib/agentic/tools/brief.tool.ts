/**
 * Brief Tool — Toggle verbose/brief output mode
 * Inspired by Claude Code's BriefTool
 *
 * Allows the agent to switch between brief and verbose output modes.
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';

let briefMode = false;

export function isBriefMode(): boolean {
  return briefMode;
}

export const BriefTool: Tool<{ mode: 'brief' | 'verbose' }, { mode: string; previous: string }> = {
  name: 'brief',
  displayName: 'Output Mode',
  description: `Switch between brief and verbose output modes.
- **brief**: Minimal output — just results, no explanations
- **verbose**: Full output with explanations and context

Use brief mode when running many operations to reduce noise.`,

  inputSchema: {
    type: 'object',
    properties: {
      mode: { type: 'string', description: 'Output mode', enum: ['brief', 'verbose'] },
    },
    required: ['mode'],
  },

  isReadOnly: false,
  isConcurrencySafe: true,
  category: 'utility',
  searchHint: 'brief verbose output mode quiet',

  async execute(input: { mode: 'brief' | 'verbose' }, _context: ToolUseContext): Promise<ToolResult<{ mode: string; previous: string }>> {
    const previous = briefMode ? 'brief' : 'verbose';
    briefMode = input.mode === 'brief';
    return {
      success: true,
      data: { mode: input.mode, previous },
    };
  },
};
