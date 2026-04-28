/**
 * Todo/Notebook Tool — Structured task tracking within conversations
 * Inspired by Claude Code's TodoWriteTool and NotebookEditTool
 *
 * Provides structured todo list management for tracking work items
 * within the current session.
 */

import type { Tool, ToolResult, ToolUseContext } from '../types';
import { generateId } from '../executor';

// ─── In-memory todo store ────────────────────────────────────────────

interface TodoItem {
  id: string;
  subject: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  owner?: string;
  createdAt: number;
  updatedAt: number;
  blockedBy: string[];
}

const todoItems = new Map<string, TodoItem>();

// ─── TodoWrite ───────────────────────────────────────────────────────

export interface TodoWriteInput {
  /** Action to perform */
  action: 'create' | 'update' | 'delete' | 'list';
  /** Todo ID (for update/delete) */
  id?: string;
  /** Task subject/title */
  subject?: string;
  /** Task description */
  description?: string;
  /** Task status */
  status?: 'pending' | 'in_progress' | 'completed' | 'blocked';
  /** Task priority */
  priority?: 'low' | 'medium' | 'high' | 'critical';
  /** Who owns this task */
  owner?: string;
  /** IDs of tasks that block this one */
  blocked_by?: string[];
}

export interface TodoWriteOutput {
  action: string;
  item?: TodoItem;
  items?: TodoItem[];
  deleted?: boolean;
}

export const TodoWriteTool: Tool<TodoWriteInput, TodoWriteOutput> = {
  name: 'todo_write',
  displayName: 'Todo List',
  description: `Manage a structured todo list for tracking work items.

Actions:
- **create**: Create a new todo item
- **update**: Update an existing item's status, priority, or description
- **delete**: Remove a todo item
- **list**: List all todo items

Use this to track complex multi-step tasks, coordinate work between agents,
and maintain a clear record of what's done and what's remaining.`,

  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', description: 'Action: create, update, delete, list', enum: ['create', 'update', 'delete', 'list'] },
      id: { type: 'string', description: 'Todo ID (for update/delete)' },
      subject: { type: 'string', description: 'Todo subject/title' },
      description: { type: 'string', description: 'Todo description' },
      status: { type: 'string', description: 'Status', enum: ['pending', 'in_progress', 'completed', 'blocked'] },
      priority: { type: 'string', description: 'Priority', enum: ['low', 'medium', 'high', 'critical'] },
      owner: { type: 'string', description: 'Task owner' },
      blocked_by: { type: 'array', description: 'IDs of blocking tasks' },
    },
    required: ['action'],
  },

  isReadOnly: false,
  isConcurrencySafe: true,
  category: 'planning',
  searchHint: 'todo list task tracking plan organize',

  async execute(input: TodoWriteInput, _context: ToolUseContext): Promise<ToolResult<TodoWriteOutput>> {
    switch (input.action) {
      case 'create': {
        if (!input.subject) {
          return { success: false, data: { action: 'create' }, error: 'Subject is required for create' };
        }
        const item: TodoItem = {
          id: `todo-${generateId()}`,
          subject: input.subject,
          description: input.description || '',
          status: input.status || 'pending',
          priority: input.priority || 'medium',
          owner: input.owner,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          blockedBy: input.blocked_by || [],
        };
        todoItems.set(item.id, item);
        return { success: true, data: { action: 'create', item } };
      }

      case 'update': {
        if (!input.id) {
          return { success: false, data: { action: 'update' }, error: 'ID is required for update' };
        }
        const existing = todoItems.get(input.id);
        if (!existing) {
          return { success: false, data: { action: 'update' }, error: `Todo '${input.id}' not found` };
        }
        if (input.subject) existing.subject = input.subject;
        if (input.description) existing.description = input.description;
        if (input.status) existing.status = input.status;
        if (input.priority) existing.priority = input.priority;
        if (input.owner !== undefined) existing.owner = input.owner;
        if (input.blocked_by) existing.blockedBy = input.blocked_by;
        existing.updatedAt = Date.now();
        return { success: true, data: { action: 'update', item: existing } };
      }

      case 'delete': {
        if (!input.id) {
          return { success: false, data: { action: 'delete' }, error: 'ID is required for delete' };
        }
        const deleted = todoItems.delete(input.id);
        return { success: deleted, data: { action: 'delete', deleted }, error: deleted ? undefined : `Todo '${input.id}' not found` };
      }

      case 'list': {
        const items = Array.from(todoItems.values())
          .sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          });
        return { success: true, data: { action: 'list', items } };
      }

      default:
        return { success: false, data: { action: input.action }, error: `Unknown action '${input.action}'` };
    }
  },
};
