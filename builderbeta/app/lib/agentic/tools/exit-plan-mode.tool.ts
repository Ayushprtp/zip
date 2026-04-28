/**
 * Exit Plan Mode Tool
 * Leaves planning mode and records allowed prompt-permission metadata.
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';
import {
  exitPlanningMode,
  getLastPlanModePermissionMetadata,
  getRuntimeModeState,
  type PlanModePermissionMetadata,
} from '~/lib/stores/modes';

export interface ExitPlanModeInput {
  allowed_prompt_permissions?: string[];
  source?: string;
  note?: string;
}

export interface ExitPlanModeOutput {
  mode: 'planning' | 'auto';
  permissionMode: string;
  isPlanning: boolean;
  previousMode: 'planning' | 'auto';
  changed: boolean;
  permissionMetadataRecorded: boolean;
  permissionMetadata?: PlanModePermissionMetadata;
}

export const ExitPlanModeTool: Tool<ExitPlanModeInput, ExitPlanModeOutput> = {
  name: 'exit_plan_mode',
  displayName: 'Exit Plan Mode',
  description: `Transition the runtime out of planning mode.

Optionally records allowed prompt-permissions metadata for downstream
execution and auditing decisions after planning completes.`,

  inputSchema: {
    type: 'object',
    properties: {
      allowed_prompt_permissions: {
        type: 'array',
        description: 'Optional list of allowed prompt permission identifiers to persist on exit.',
        items: { type: 'string' },
      },
      source: {
        type: 'string',
        description: 'Optional source of this mode transition (agent/tool/user).',
      },
      note: {
        type: 'string',
        description: 'Optional operator note attached to recorded permission metadata.',
      },
    },
  },

  isReadOnly: false,
  isConcurrencySafe: true,
  category: 'planning',
  searchHint: 'exit leave plan planning mode permissions metadata',

  async execute(input: ExitPlanModeInput, _context: ToolUseContext): Promise<ToolResult<ExitPlanModeOutput>> {
    const previous = getRuntimeModeState();

    const metadataInput = input.allowed_prompt_permissions
      ? {
          allowedPromptPermissions: input.allowed_prompt_permissions,
          source: input.source,
          note: input.note,
        }
      : undefined;

    const next = exitPlanningMode(metadataInput);

    const permissionMetadata = getLastPlanModePermissionMetadata() ?? undefined;

    return {
      success: true,
      data: {
        mode: next.nativeMode,
        permissionMode: next.permissionMode,
        isPlanning: next.isPlanning,
        previousMode: previous.nativeMode,
        changed: previous.nativeMode !== next.nativeMode,
        permissionMetadataRecorded: Boolean(permissionMetadata),
        permissionMetadata,
      },
    };
  },
};
