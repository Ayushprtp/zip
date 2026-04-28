/**
 * Task Update Tool — Update task status and output
 * Inspired by Claude Code's TaskUpdateTool
 */

import type { Tool, ToolResult, ToolUseContext, TaskStatus } from '../types';
import { taskManager } from '../tasks/manager';

export interface TaskUpdateInput {
  task_id: string;
  status?: TaskStatus;
  output?: string;
  progress?: number;
}

export const TaskUpdateTool: Tool<TaskUpdateInput, { taskId: string; status: string }> = {
  name: 'task_update',
  displayName: 'Update Task',
  description: 'Update a tracked task\'s status, progress, or append output.',

  inputSchema: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'The task ID to update' },
      status: { type: 'string', description: 'New status', enum: ['pending', 'running', 'completed', 'failed', 'killed'] },
      output: { type: 'string', description: 'Output text to append' },
      progress: { type: 'number', description: 'Progress percentage (0-100)' },
    },
    required: ['task_id'],
  },

  isReadOnly: false,
  isConcurrencySafe: true,
  category: 'task',
  searchHint: 'update task status progress',

  async execute(input: TaskUpdateInput, _context: ToolUseContext): Promise<ToolResult<{ taskId: string; status: string }>> {
    const task = taskManager.getTask(input.task_id);
    if (!task) {
      return { success: false, data: { taskId: input.task_id, status: 'not_found' }, error: `Task '${input.task_id}' not found` };
    }

    if (input.output) taskManager.appendOutput(input.task_id, input.output);
    if (input.progress !== undefined) taskManager.updateTask(input.task_id, { progress: input.progress });

    if (input.status === 'completed') taskManager.completeTask(input.task_id);
    else if (input.status === 'failed') taskManager.failTask(input.task_id, input.output || 'Failed');
    else if (input.status === 'killed') taskManager.killTask(input.task_id);
    else if (input.status) taskManager.updateTask(input.task_id, { status: input.status });

    return { success: true, data: { taskId: input.task_id, status: input.status || task.status } };
  },
};
