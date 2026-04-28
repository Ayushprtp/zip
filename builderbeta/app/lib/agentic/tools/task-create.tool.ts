/**
 * Task Create Tool — Create and track background tasks
 * Inspired by Claude Code's TaskCreateTool
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';
import { taskManager } from '../tasks/manager';

export interface TaskCreateInput {
  description: string;
  type?: 'agent' | 'skill' | 'shell' | 'background';
}

export const TaskCreateTool: Tool<TaskCreateInput, { taskId: string; description: string }> = {
  name: 'task_create',
  displayName: 'Create Task',
  description: 'Create a tracked background task. Tasks can be monitored from the Agent Panel.',

  inputSchema: {
    type: 'object',
    properties: {
      description: { type: 'string', description: 'Brief description of the task' },
      type: { type: 'string', description: 'Task type: agent, skill, shell, background', enum: ['agent', 'skill', 'shell', 'background'] },
    },
    required: ['description'],
  },

  isReadOnly: false,
  isConcurrencySafe: true,
  category: 'task',
  searchHint: 'create task track background',

  async execute(input: TaskCreateInput, _context: ToolUseContext): Promise<ToolResult<{ taskId: string; description: string }>> {
    const task = taskManager.createTask(input.type || 'background', input.description);
    taskManager.startTask(task.id);
    return { success: true, data: { taskId: task.id, description: task.description } };
  },
};
