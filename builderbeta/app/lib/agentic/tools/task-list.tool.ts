/**
 * Task List Tool — List all tracked tasks
 * Inspired by Claude Code's TaskListTool
 */

import type { Tool, ToolResult, ToolUseContext, TaskState } from '../types';
import { taskManager } from '../tasks/manager';

export interface TaskListInput {
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'killed';
}

export const TaskListTool: Tool<TaskListInput, { tasks: TaskState[]; count: number }> = {
  name: 'task_list',
  displayName: 'List Tasks',
  description: 'List all tracked tasks, optionally filtered by status.',

  inputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string', description: 'Filter by status', enum: ['pending', 'running', 'completed', 'failed', 'killed'] },
    },
  },

  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'task',
  searchHint: 'list tasks running background',

  async execute(input: TaskListInput, _context: ToolUseContext): Promise<ToolResult<{ tasks: TaskState[]; count: number }>> {
    const tasks = input.status
      ? taskManager.getTasksByStatus(input.status)
      : taskManager.getAllTasks();
    return { success: true, data: { tasks, count: tasks.length } };
  },
};
