/**
 * Task Manager
 * Tracks background tasks (agents, shell commands, skills) with status updates.
 * Inspired by Claude Code's Task system.
 */

import type { TaskState, TaskType, TaskStatus, AgentState } from '../types';
import { generateId } from '../executor';

class TaskManager {
  private tasks: Map<string, TaskState> = new Map();
  private listeners: Set<(event: TaskEvent) => void> = new Set();

  /**
   * Create a new task.
   */
  createTask(type: TaskType, description: string, agentId?: string): TaskState {
    const task: TaskState = {
      id: generateId(),
      type,
      status: 'pending',
      description,
      agentId,
      startTime: Date.now(),
      output: [],
      notified: false,
    };

    this.tasks.set(task.id, task);
    this.emit({ type: 'task:created', task });
    return task;
  }

  /**
   * Update task status.
   */
  updateTask(taskId: string, update: Partial<TaskState>): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    Object.assign(task, update);

    if (update.status && isTerminal(update.status)) {
      task.endTime = Date.now();
    }

    this.emit({ type: 'task:updated', task });
  }

  /**
   * Append output to a task.
   */
  appendOutput(taskId: string, line: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.output.push(line);
    this.emit({ type: 'task:output', taskId, line });
  }

  /**
   * Mark task as running.
   */
  startTask(taskId: string): void {
    this.updateTask(taskId, { status: 'running' });
  }

  /**
   * Mark task as completed.
   */
  completeTask(taskId: string, result?: string): void {
    if (result) this.appendOutput(taskId, result);
    this.updateTask(taskId, { status: 'completed' });
  }

  /**
   * Mark task as failed.
   */
  failTask(taskId: string, error: string): void {
    this.appendOutput(taskId, `Error: ${error}`);
    this.updateTask(taskId, { status: 'failed' });
  }

  /**
   * Kill a running task.
   */
  killTask(taskId: string): void {
    this.updateTask(taskId, { status: 'killed' });
  }

  /**
   * Get a task by ID.
   */
  getTask(taskId: string): TaskState | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks.
   */
  getAllTasks(): TaskState[] {
    return [...this.tasks.values()];
  }

  /**
   * Get tasks by status.
   */
  getTasksByStatus(status: TaskStatus): TaskState[] {
    return [...this.tasks.values()].filter(t => t.status === status);
  }

  /**
   * Get running tasks.
   */
  getRunningTasks(): TaskState[] {
    return this.getTasksByStatus('running');
  }

  /**
   * Get unnotified completed tasks.
   */
  getUnnotifiedTasks(): TaskState[] {
    return [...this.tasks.values()].filter(
      t => isTerminal(t.status) && !t.notified,
    );
  }

  /**
   * Mark a task as notified.
   */
  markNotified(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.notified = true;
    }
  }

  /**
   * Create a task from an agent state.
   */
  createAgentTask(agent: AgentState): TaskState {
    return this.createTask('agent', agent.description, agent.id);
  }

  /**
   * Subscribe to task events.
   */
  subscribe(listener: (event: TaskEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: TaskEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('[TaskManager] Listener error:', e);
      }
    }
  }

  /**
   * Clean up old completed tasks (keep last 50).
   */
  cleanup(): void {
    const completed = [...this.tasks.values()]
      .filter(t => isTerminal(t.status))
      .sort((a, b) => (b.endTime ?? 0) - (a.endTime ?? 0));

    if (completed.length > 50) {
      for (const task of completed.slice(50)) {
        this.tasks.delete(task.id);
      }
    }
  }
}

export type TaskEvent =
  | { type: 'task:created'; task: TaskState }
  | { type: 'task:updated'; task: TaskState }
  | { type: 'task:output'; taskId: string; line: string };

function isTerminal(status: TaskStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'killed';
}

/** Singleton task manager */
export const taskManager = new TaskManager();
