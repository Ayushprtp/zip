"use client";

import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Play,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  ListChecks,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TaskPlan, TaskItem } from "@/lib/builder/flare-chat-storage";

interface TaskPlanViewerProps {
  plan: TaskPlan;
  onStartTask: (task: TaskItem) => void;
  onStartAll: () => void;
  isExecuting?: boolean;
  executingTaskId?: string | null;
}

function StatusIcon({ status }: { status: TaskItem["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
    case "in-progress":
      return (
        <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
      );
    case "failed":
      return <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />;
  }
}

function TaskNode({
  task,
  depth,
  onStartTask,
  isExecuting,
  executingTaskId,
}: {
  task: TaskItem;
  depth: number;
  onStartTask: (task: TaskItem) => void;
  isExecuting?: boolean;
  executingTaskId?: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const isThisExecuting = executingTaskId === task.id;
  const canStart = task.status === "pending" && !isExecuting;

  return (
    <div className="group">
      {/* Task Row */}
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors ${
          isThisExecuting
            ? "bg-blue-500/10 border-l-2 border-blue-400"
            : task.status === "completed"
              ? "bg-emerald-500/5"
              : ""
        }`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
      >
        {/* Expand/Collapse for subtasks */}
        {hasSubtasks ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 rounded hover:bg-muted/60 text-muted-foreground"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-[18px]" />
        )}

        <StatusIcon status={task.status} />

        {/* Task number */}
        <span className="text-[11px] font-mono text-violet-400 font-semibold shrink-0 min-w-[32px]">
          {task.label}
        </span>

        {/* Task description */}
        <span
          className={`text-[12px] flex-1 leading-tight ${
            task.status === "completed"
              ? "text-muted-foreground line-through"
              : "text-foreground"
          }`}
        >
          {task.description}
        </span>

        {/* Start button */}
        {canStart && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity bg-violet-500/10 hover:bg-violet-500/20 text-violet-400"
            onClick={() => onStartTask(task)}
          >
            <Play className="h-3 w-3 mr-1" />
            Start
          </Button>
        )}

        {isThisExecuting && (
          <span className="text-[10px] text-blue-400 font-medium flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Running...
          </span>
        )}
      </div>

      {/* Subtasks */}
      {hasSubtasks && expanded && (
        <div className="border-l border-border/30 ml-4">
          {task.subtasks!.map((subtask) => (
            <TaskNode
              key={subtask.id}
              task={subtask}
              depth={depth + 1}
              onStartTask={onStartTask}
              isExecuting={isExecuting}
              executingTaskId={executingTaskId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TaskPlanViewer({
  plan,
  onStartTask,
  onStartAll,
  isExecuting,
  executingTaskId,
}: TaskPlanViewerProps) {
  const totalTasks = countTasks(plan.tasks);
  const completedTasks = countCompletedTasks(plan.tasks);
  const progress =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 border-b px-4 py-3 bg-muted/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-foreground">
              {plan.title}
            </h3>
          </div>
          <Button
            size="sm"
            disabled={isExecuting || completedTasks === totalTasks}
            onClick={onStartAll}
            className="h-7 px-3 text-[11px] bg-violet-600 hover:bg-violet-500 text-white gap-1.5"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            {isExecuting ? "Running..." : "Start All Tasks"}
          </Button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">
            {completedTasks}/{totalTasks}
          </span>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {plan.tasks.map((task) => (
          <TaskNode
            key={task.id}
            task={task}
            depth={0}
            onStartTask={onStartTask}
            isExecuting={isExecuting}
            executingTaskId={executingTaskId}
          />
        ))}
      </div>
    </div>
  );
}

function countTasks(tasks: TaskItem[]): number {
  let count = 0;
  for (const t of tasks) {
    count += 1;
    if (t.subtasks) count += countTasks(t.subtasks);
  }
  return count;
}

function countCompletedTasks(tasks: TaskItem[]): number {
  let count = 0;
  for (const t of tasks) {
    if (t.status === "completed") count += 1;
    if (t.subtasks) count += countCompletedTasks(t.subtasks);
  }
  return count;
}
