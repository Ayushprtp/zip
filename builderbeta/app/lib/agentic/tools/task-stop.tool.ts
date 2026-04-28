/**
 * Task Stop Tool — Stop a running task or agent
 * Inspired by Claude Code's TaskStopTool
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';
import { taskManager } from '../tasks/manager';

export interface TaskStopInput {
  task_id: string;
}

export const TaskStopTool: Tool<TaskStopInput, { taskId: string; stopped: boolean }> = {
  name: 'task_stop',
  displayName: 'Stop Task',
  description: 'Stop a running task or agent. The task will be marked as killed.',

  inputSchema: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'The task ID to stop' },
    },
    required: ['task_id'],
  },

  isReadOnly: false,
  isConcurrencySafe: true,
  category: 'task',
  searchHint: 'stop kill cancel task agent',

  async execute(input: TaskStopInput, _context: ToolUseContext): Promise<ToolResult<{ taskId: string; stopped: boolean }>> {
    const task = taskManager.getTask(input.task_id);
    if (!task) {
      return { success: false, data: { taskId: input.task_id, stopped: false }, error: `Task '${input.task_id}' not found` };
    }

    if (task.status !== 'running' && task.status !== 'pending') {
      return { success: false, data: { taskId: input.task_id, stopped: false }, error: `Task is already ${task.status}` };
    }

    taskManager.killTask(input.task_id);
    return { success: true, data: { taskId: input.task_id, stopped: true } };
  },
};
