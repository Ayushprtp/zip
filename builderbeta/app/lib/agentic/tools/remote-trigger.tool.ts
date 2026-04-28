/**
 * Remote Trigger Tool — Call the Claude Code remote-trigger API.
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';

export type RemoteTriggerAction = 'list' | 'get' | 'create' | 'update' | 'run';

export interface RemoteTriggerInput {
  action: RemoteTriggerAction;
  trigger_id?: string;
  body?: Record<string, unknown>;
}

export interface RemoteTriggerOutput {
  action: RemoteTriggerAction;
  trigger_id?: string;
  status: number;
  data?: unknown;
}

interface RemoteTriggerRouteResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

function validateInput(input: RemoteTriggerInput): string | undefined {
  if (!input || !input.action) {
    return 'Missing required field: action';
  }

  if (!['list', 'get', 'create', 'update', 'run'].includes(input.action)) {
    return `Unsupported remote trigger action: ${String(input.action)}`;
  }

  if ((input.action === 'get' || input.action === 'update' || input.action === 'run') && !input.trigger_id) {
    return `trigger_id is required for action '${input.action}'`;
  }

  if ((input.action === 'create' || input.action === 'update') && (!input.body || typeof input.body !== 'object')) {
    return `body is required for action '${input.action}'`;
  }

  return undefined;
}

async function callRemoteTriggerRoute(
  input: RemoteTriggerInput,
  context: ToolUseContext,
): Promise<{ status: number; payload: RemoteTriggerRouteResponse }> {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'remote_trigger',
      sessionId: context.sessionId,
      remoteTrigger: {
        action: input.action,
        trigger_id: input.trigger_id,
        body: input.body,
      },
    }),
    signal: context.abortSignal,
  });

  let payload: RemoteTriggerRouteResponse;

  try {
    payload = (await response.json()) as RemoteTriggerRouteResponse;
  } catch {
    payload = {
      success: false,
      error: `Failed to parse /api/tasks remote_trigger response (status ${response.status})`,
    };
  }

  return { status: response.status, payload };
}

export const RemoteTriggerTool: Tool<RemoteTriggerInput, RemoteTriggerOutput> = {
  name: 'remote_trigger',
  displayName: 'Remote Trigger',
  description: `Call the Claude Code remote-trigger API via the authenticated backend route.

Supported actions:
- list → GET /v1/code/triggers
- get → GET /v1/code/triggers/{trigger_id}
- create → POST /v1/code/triggers
- update → POST /v1/code/triggers/{trigger_id}
- run → POST /v1/code/triggers/{trigger_id}/run`,

  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['list', 'get', 'create', 'update', 'run'],
        description: 'Remote trigger API action to execute',
      },
      trigger_id: {
        type: 'string',
        description: 'Trigger ID (required for get/update/run)',
      },
      body: {
        type: 'object',
        description: 'Request body payload for create/update actions',
      },
    },
    required: ['action'],
  },

  isReadOnly: false,
  isConcurrencySafe: true,
  category: 'scheduling',
  searchHint: 'remote trigger schedule automation claude api trigger run',

  async execute(input: RemoteTriggerInput, context: ToolUseContext): Promise<ToolResult<RemoteTriggerOutput>> {
    const validationError = validateInput(input);

    if (validationError) {
      return {
        success: false,
        data: {
          action: input.action,
          trigger_id: input.trigger_id,
          status: 400,
        },
        error: validationError,
      };
    }

    try {
      const { status, payload } = await callRemoteTriggerRoute(input, context);

      if (!payload.success) {
        return {
          success: false,
          data: {
            action: input.action,
            trigger_id: input.trigger_id,
            status,
            data: payload.data,
          },
          error: payload.error || `Remote trigger action '${input.action}' failed`,
        };
      }

      return {
        success: true,
        data: {
          action: input.action,
          trigger_id: input.trigger_id,
          status,
          data: payload.data,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        data: {
          action: input.action,
          trigger_id: input.trigger_id,
          status: 0,
        },
        error: error?.message || `Remote trigger action '${input.action}' failed`,
      };
    }
  },
};
