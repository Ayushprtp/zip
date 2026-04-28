/**
 * Skill Tool — Execute skills (slash commands) from within the chat
 */

import type { Tool, ToolResult, ToolUseContext, ToolCallProgress } from '../types';
import { agenticRegistry } from '../registry';
import { runAgent } from '../agents/runner';
import { taskManager } from '../tasks/manager';
import { addAgent, updateAgent } from '../stores';

export interface SkillToolInput {
  /** Skill name (without /) */
  skill_name: string;
  /** Arguments to pass to the skill */
  arguments?: string;
}

export interface SkillToolOutput {
  skillName: string;
  result?: string;
  error?: string;
}

export const SkillTool: Tool<SkillToolInput, SkillToolOutput> = {
  name: 'skill',
  displayName: 'Invoke Skill',
  description: `Invoke a built-in skill (slash command).

## Available Skills
- **/commit** — Create a git commit with proper message
- **/test** — Run the test suite
- **/deploy** — Build and deploy the application
- **/refactor** — Refactor code for quality
- **/debug** — Diagnose and fix errors
- **/review** — Code review recent changes
- **/install** — Install dependencies`,

  inputSchema: {
    type: 'object',
    properties: {
      skill_name: {
        type: 'string',
        description: 'The skill to invoke (e.g., "commit", "test", "deploy")',
      },
      arguments: {
        type: 'string',
        description: 'Arguments to pass to the skill',
      },
    },
    required: ['skill_name'],
  },

  isReadOnly: false,
  isConcurrencySafe: false,
  category: 'skill',
  searchHint: 'skill command slash invoke commit test deploy',

  async execute(
    input: SkillToolInput,
    context: ToolUseContext,
    onProgress?: ToolCallProgress,
  ): Promise<ToolResult<SkillToolOutput>> {
    const { skill_name, arguments: args } = input;

    const skill = agenticRegistry.getSkill(skill_name);
    if (!skill) {
      return {
        success: false,
        data: { skillName: skill_name, error: `Unknown skill '${skill_name}'` },
        error: `Unknown skill '${skill_name}'. Available: ${agenticRegistry.getAllSkills().map(s => s.name).join(', ')}`,
      };
    }

    // Generate the skill prompt (support both static and dynamic)
    const prompt = skill.getPrompt
      ? skill.getPrompt(args || '')
      : (skill.prompt || '') + (args ? `\n\n## User Input\n\n${args}` : '');

    // Determine which agent type to use
    const agentType = skill.agentType || 'coder';
    const agentDef = agenticRegistry.getAgent(agentType);

    if (!agentDef) {
      return {
        success: false,
        data: { skillName: skill_name, error: `Agent type '${agentType}' not found` },
        error: `Agent type '${agentType}' not found`,
      };
    }

    const env = typeof process !== 'undefined' ? process.env : {};
    const apiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || '';
    const apiBaseUrl = env.OPENAI_API_BASE_URL || 'https://api.flare.tech/v1';

    try {
      const task = taskManager.createTask('skill', `/${skill_name} ${args || ''}`);
      taskManager.startTask(task.id);

      const agentState = await runAgent({
        agentDefinition: agentDef,
        prompt,
        description: `Skill: /${skill_name}`,
        model: context.model || 'claude-sonnet-4-20250514',
        sandboxContext: context,
        apiKey,
        apiBaseUrl,
        isBackground: false,
        abortSignal: context.abortSignal,
        onProgress: (event) => {
          if (event.type === 'agent:started') addAgent(event.agent);
          if (event.type === 'agent:complete') updateAgent(event.agent.id, event.agent);
        },
      });

      if (agentState.status === 'completed') {
        taskManager.completeTask(task.id, agentState.result);
      } else {
        taskManager.failTask(task.id, agentState.error || 'Skill failed');
      }

      return {
        success: agentState.status === 'completed',
        data: {
          skillName: skill_name,
          result: agentState.result,
          error: agentState.error,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        data: { skillName: skill_name, error: error.message },
        error: `Skill '${skill_name}' failed: ${error.message}`,
      };
    }
  },
};
