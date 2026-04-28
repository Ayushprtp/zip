/**
 * Send Message Tool — Continue a paused/completed agent with a follow-up message
 * Inspired by Claude Code's SendMessageTool for coordinator mode.
 *
 * In coordinator mode, the coordinator can send follow-up messages to
 * worker agents via their agent ID.
 */

import type { Tool, ToolResult, ToolUseContext, ToolCallProgress } from '../types';
import { agentsStore, addAgent, updateAgent } from '../stores';
import { hasAgentContinuation, resumeAgentWithMessage } from '../agents/runner';

export interface SendMessageInput {
  /** The agent ID to send the message to */
  to: string;
  /** The message/instruction to send */
  message: string;
}

export interface SendMessageOutput {
  agentId: string;
  delivered: boolean;
  status?: string;
  result?: string;
  error?: string;
}

export const SendMessageTool: Tool<SendMessageInput, SendMessageOutput> = {
  name: 'send_message',
  displayName: 'Send Message',
  description: `Send a follow-up message to an existing worker agent.
Use this to:
- Continue a worker with new instructions after it reports findings
- Correct a worker that made a mistake
- Ask a worker to do additional work in its existing context

The agent must have been previously spawned via the agent tool.`,

  inputSchema: {
    type: 'object',
    properties: {
      to: {
        type: 'string',
        description: 'The agent ID to send the message to (from the agent tool\'s result)',
      },
      message: {
        type: 'string',
        description: 'The message or instruction to send to the agent',
      },
    },
    required: ['to', 'message'],
  },

  isReadOnly: false,
  isConcurrencySafe: true,
  category: 'agent',
  searchHint: 'send message continue agent worker coordinator',

  async execute(
    input: SendMessageInput,
    _context: ToolUseContext,
    onProgress?: ToolCallProgress,
  ): Promise<ToolResult<SendMessageOutput>> {
    const { to, message } = input;
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      return {
        success: false,
        data: {
          agentId: to,
          delivered: false,
          error: 'Message cannot be empty',
        },
        error: 'Message cannot be empty',
      };
    }

    // Check if the agent exists
    const agents = agentsStore.get();
    const agent = agents[to];

    if (!agent) {
      return {
        success: false,
        data: { agentId: to, delivered: false, error: `Agent '${to}' not found` },
        error: `Agent '${to}' not found. Check the agent ID from the agent tool's result.`,
      };
    }

    if (!hasAgentContinuation(to)) {
      const reason = agent.status === 'running'
        ? `Agent '${to}' is still running and cannot accept follow-up messages until it reaches a resumable state.`
        : `Agent '${to}' has no resumable continuation state.`;

      return {
        success: false,
        data: { agentId: to, delivered: false, status: agent.status, error: reason },
        error: reason,
      };
    }

    try {
      const resumedAgent = await resumeAgentWithMessage({
        agentId: to,
        message: trimmedMessage,
        onProgress: (event) => {
          if (event.type === 'agent:started') {
            addAgent(event.agent);
          } else if (event.type === 'agent:complete') {
            updateAgent(event.agent.id, event.agent);
          } else if (event.type === 'agent:message') {
            onProgress?.({
              toolUseId: '',
              type: 'agent_status',
              data: { agentId: event.agentId, message: event.message },
            });
          } else if (event.type === 'agent:tool_start') {
            onProgress?.({
              toolUseId: '',
              type: 'agent_status',
              data: { agentId: event.agentId, toolCall: event.toolCall },
            });
          } else if (event.type === 'agent:tool_complete') {
            onProgress?.({
              toolUseId: '',
              type: 'agent_status',
              data: { agentId: event.agentId, toolCall: event.toolCall },
            });
          }
        },
      });

      return {
        success: resumedAgent.status === 'completed',
        data: {
          agentId: to,
          delivered: resumedAgent.status === 'completed',
          status: resumedAgent.status,
          result: resumedAgent.result,
          error: resumedAgent.error,
        },
        error: resumedAgent.error,
      };
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to resume agent';

      return {
        success: false,
        data: {
          agentId: to,
          delivered: false,
          error: errorMessage,
        },
        error: errorMessage,
      };
    }
  },
};
