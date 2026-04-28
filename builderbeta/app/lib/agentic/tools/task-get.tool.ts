/**
 * Task Get Tool — Query task status
 * Inspired by Claude Code's TaskGetTool
 */

import type { Tool, ToolResult, ToolUseContext, TaskState } from '../types';
import { taskManager } from '../tasks/manager';

export interface TaskGetInput {
  task_id: string;
}

export const TaskGetTool: Tool<TaskGetInput, TaskState | { error: string }> = {
  name: 'task_get',
  displayName: 'Get Task',
  description: 'Get the current status of a tracked task.',

  inputSchema: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'The task ID to query' },
    },
    required: ['task_id'],
  },

  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'task',
  searchHint: 'get task status progress',

  async execute(input: TaskGetInput, _context: ToolUseContext): Promise<ToolResult<TaskState | { error: string }>> {
    const task = taskManager.getTask(input.task_id);
    if (!task) {
      return { success: false, data: { error: `Task '${input.task_id}' not found` }, error: `Task not found` };
    }
    return { success: true, data: task };
  },
};
