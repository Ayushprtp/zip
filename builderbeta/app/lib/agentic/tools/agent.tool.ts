/**
 * Agent Tool — Spawn sub-agents from within the chat
 * This tool allows the LLM to spawn specialized sub-agents.
 * Inspired by Claude Code's AgentTool.
 */

import type {
  Tool,
  ToolResult,
  ToolUseContext,
  ToolCallProgress,
} from "../types";
import { agenticRegistry } from "../registry";
import { runAgent, type AgentProgressEvent } from "../agents/runner";
import { taskManager } from "../tasks/manager";
import { addAgent, updateAgent } from "../stores";

export interface AgentToolInput {
  /** The type of agent to spawn (coder, explorer, reviewer, etc.) */
  agent_type: string;
  /** The task/prompt to give to the agent */
  prompt: string;
  /** Brief description of what this agent is doing */
  description?: string;
}

export interface AgentToolOutput {
  agentId: string;
  agentType: string;
  status: string;
  result?: string;
  error?: string;
  toolCallsCount: number;
  durationMs: number;
}

export const AgentTool: Tool<AgentToolInput, AgentToolOutput> = {
  name: "agent",
  displayName: "Spawn Agent",
  description: `Spawn a specialized sub-agent to handle a task.

## Available Agent Types
- **coder**: Full-stack implementation — writes, edits, refactors code
- **explorer**: Research — investigates codebases, reads files, gathers information
- **reviewer**: Code review — runs tests, finds issues, validates quality
- **architect**: Planning — analyzes architecture, designs solutions
- **debugger**: Debugging — diagnoses errors, traces issues, applies fixes
- **worker**: General-purpose delegated execution worker
- **proactive**: Background monitor/scheduler (Kairos)
- **planner**: Task decomposition and structured planning
- **swarm_lead**: Multi-agent team orchestration and coordination
- **browser**: Autonomous browser workflows with URL approval boundaries

## When to Use
- Complex tasks that require multiple file reads/writes
- Tasks that benefit from a focused, specialized approach
- Parallel work: spawn multiple agents for independent subtasks

## Important
- Agents start with ZERO context about the project — brief them thoroughly
- Include specific file paths, goals, and success criteria in the prompt
- The agent will use its tools autonomously and return a result`,

  inputSchema: {
    type: "object",
    properties: {
      agent_type: {
        type: "string",
        description:
          "Type of agent: coder, explorer, reviewer, architect, debugger, worker, proactive, planner, swarm_lead, browser",
        enum: [
          "coder",
          "explorer",
          "reviewer",
          "architect",
          "debugger",
          "worker",
          "proactive",
          "planner",
          "swarm_lead",
          "browser",
        ],
      },
      prompt: {
        type: "string",
        description:
          'Detailed task description for the agent. Include file paths, goals, and what "done" looks like.',
      },
      description: {
        type: "string",
        description: "Brief description of the task (shown in the UI)",
      },
    },
    required: ["agent_type", "prompt"],
  },

  isReadOnly: false,
  isConcurrencySafe: true, // Multiple agents can run in parallel
  category: "agent",
  searchHint: "spawn agent worker subagent delegate task",

  async execute(
    input: AgentToolInput,
    context: ToolUseContext,
    onProgress?: ToolCallProgress,
  ): Promise<ToolResult<AgentToolOutput>> {
    const { agent_type, prompt, description } = input;

    // Find the agent definition
    const agentDef = agenticRegistry.getAgent(agent_type);
    if (!agentDef) {
      return {
        success: false,
        data: {
          agentId: "",
          agentType: agent_type,
          status: "failed",
          error: `Unknown agent type '${agent_type}'. Available: ${agenticRegistry
            .getAllAgents()
            .map((a) => a.agentType)
            .join(", ")}`,
          toolCallsCount: 0,
          durationMs: 0,
        },
        error: `Unknown agent type '${agent_type}'`,
      };
    }

    // Get API credentials from environment
    const env = typeof process !== "undefined" ? process.env : {};
    const apiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || "";
    const apiBaseUrl =
      env.OPENAI_API_BASE_URL || "https://api.flare-sh.tech/v1";

    try {
      const taskDesc =
        description || `${agentDef.displayName}: ${prompt.substring(0, 80)}...`;
      const task = taskManager.createTask("agent", taskDesc);
      taskManager.startTask(task.id);

      const agentState = await runAgent({
        agentDefinition: agentDef,
        prompt,
        description: taskDesc,
        model: context.model || "claude-sonnet-4-20250514",
        sandboxContext: context,
        apiKey,
        apiBaseUrl,
        parentAgentId: context.parentAgentId,
        isBackground: false,
        abortSignal: context.abortSignal,
        onProgress: (event: AgentProgressEvent) => {
          // Update stores
          if (event.type === "agent:started") {
            addAgent(event.agent);
          } else if (event.type === "agent:complete") {
            updateAgent(event.agent.id, event.agent);
          } else if (event.type === "agent:message") {
            onProgress?.({
              toolUseId: "",
              type: "agent_status",
              data: { agentId: event.agentId, message: event.message },
            });
          } else if (event.type === "agent:tool_start") {
            onProgress?.({
              toolUseId: "",
              type: "agent_status",
              data: { agentId: event.agentId, toolCall: event.toolCall },
            });
          }
        },
      });

      // Update task
      if (agentState.status === "completed") {
        taskManager.completeTask(task.id, agentState.result);
      } else {
        taskManager.failTask(task.id, agentState.error || "Agent failed");
      }

      return {
        success: agentState.status === "completed",
        data: {
          agentId: agentState.id,
          agentType: agentState.agentType,
          status: agentState.status,
          result: agentState.result,
          error: agentState.error,
          toolCallsCount: agentState.toolCalls.length,
          durationMs: (agentState.endTime ?? Date.now()) - agentState.startTime,
        },
        error: agentState.error,
      };
    } catch (error: any) {
      return {
        success: false,
        data: {
          agentId: "",
          agentType: agent_type,
          status: "failed",
          error: error.message,
          toolCallsCount: 0,
          durationMs: 0,
        },
        error: `Failed to run agent: ${error.message}`,
      };
    }
  },
};
