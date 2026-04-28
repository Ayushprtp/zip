/**
 * Task Output Tool — Retrieve task output logs
 * Inspired by Claude Code's TaskOutputTool
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';
import { taskManager } from '../tasks/manager';

export interface TaskOutputInput {
  task_id: string;
  offset?: number;
  limit?: number;
}

export interface TaskOutputData {
  taskId: string;
  status: string;
  output: string[];
  totalLines: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export const TaskOutputTool: Tool<TaskOutputInput, TaskOutputData> = {
  name: 'task_output',
  displayName: 'Get Task Output',
  description: 'Get output logs for a tracked task, optionally paginated by offset/limit.',

  inputSchema: {
    type: 'object',
    properties: {
      task_id: { type: 'string', description: 'The task ID to read output from' },
      offset: { type: 'number', description: 'Number of output lines to skip (default: 0)' },
      limit: { type: 'number', description: 'Maximum output lines to return (default: 200, max: 2000)' },
    },
    required: ['task_id'],
  },

  isReadOnly: true,
  isConcurrencySafe: true,
  category: 'task',
  searchHint: 'task output logs stream read background task lines',

  async execute(input: TaskOutputInput, _context: ToolUseContext): Promise<ToolResult<TaskOutputData>> {
    const task = taskManager.getTask(input.task_id);

    if (!task) {
      return {
        success: false,
        data: {
          taskId: input.task_id,
          status: 'not_found',
          output: [],
          totalLines: 0,
          offset: 0,
          limit: 0,
          hasMore: false,
        },
        error: `Task '${input.task_id}' not found`,
      };
    }

    const offset = Math.max(0, Math.floor(input.offset ?? 0));
    const requestedLimit = Math.max(1, Math.floor(input.limit ?? 200));
    const limit = Math.min(requestedLimit, 2000);

    const output = task.output.slice(offset, offset + limit);
    const totalLines = task.output.length;
    const hasMore = offset + output.length < totalLines;

    return {
      success: true,
      data: {
        taskId: task.id,
        status: task.status,
        output,
        totalLines,
        offset,
        limit,
        hasMore,
      },
    };
  },
};
