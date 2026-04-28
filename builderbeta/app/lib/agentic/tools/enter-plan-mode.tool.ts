/**
 * Enter Plan Mode Tool
 * Switches runtime mode into planning mode and returns current mode state.
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';
import { enterPlanningMode, getRuntimeModeState } from '~/lib/stores/modes';

export interface EnterPlanModeInput {
  reason?: string;
}

export interface EnterPlanModeOutput {
  mode: 'planning' | 'auto';
  permissionMode: string;
  isPlanning: boolean;
  previousMode: 'planning' | 'auto';
  changed: boolean;
  reason?: string;
}

export const EnterPlanModeTool: Tool<EnterPlanModeInput, EnterPlanModeOutput> = {
  name: 'enter_plan_mode',
  displayName: 'Enter Plan Mode',
  description: `Transition the runtime into planning mode.

Planning mode is designed for architecture and decomposition tasks.
Use this before planning-focused work where mutating tools should be constrained.`,

  inputSchema: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description: 'Optional reason for entering planning mode (for traceability).',
      },
    },
  },

  isReadOnly: false,
  isConcurrencySafe: true,
  category: 'planning',
  searchHint: 'plan planning mode architect architecture',

  async execute(input: EnterPlanModeInput, _context: ToolUseContext): Promise<ToolResult<EnterPlanModeOutput>> {
    const previous = getRuntimeModeState();
    const next = enterPlanningMode();

    return {
      success: true,
      data: {
        mode: next.nativeMode,
        permissionMode: next.permissionMode,
        isPlanning: next.isPlanning,
        previousMode: previous.nativeMode,
        changed: previous.nativeMode !== next.nativeMode,
        reason: input.reason,
      },
    };
  },
};
