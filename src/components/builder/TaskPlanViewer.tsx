"use client";

import { useState, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  ListChecks,
  PlayCircle,
  Lock,
  Zap,
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
  parentStarted,
}: {
  task: TaskItem;
  depth: number;
  onStartTask: (task: TaskItem) => void;
  isExecuting?: boolean;
  executingTaskId?: string | null;
  parentStarted: boolean;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const isThisExecuting = executingTaskId === task.id;

  // A task can only be started if:
  // 1. It's pending
  // 2. Nothing else is executing
  // 3. Its parent is started or it's a top-level task
  const canStart = task.status === "pending" && !isExecuting && parentStarted;

  // Whether this task is started (for child task dependency)
  const thisStarted =
    task.status === "in-progress" || task.status === "completed";

  // Count subtask progress
  const subtaskProgress = useMemo(() => {
    if (!hasSubtasks) return null;
    const total = countTasks(task.subtasks!);
    const completed = countCompletedTasks(task.subtasks!);
    return { total, completed };
  }, [hasSubtasks, task.subtasks]);

  // Depth-based accent colors
  const depthColors = [
    "border-l-violet-500/50",
    "border-l-blue-500/50",
    "border-l-cyan-500/50",
    "border-l-emerald-500/50",
    "border-l-amber-500/50",
  ];
  const accentColor = depthColors[depth % depthColors.length];

  return (
    <div>
      {/* Task Row */}
      <div
        className={`group flex items-center gap-2 py-2 px-3 rounded-lg transition-all duration-200 ${
          isThisExecuting
            ? "bg-blue-500/10 border border-blue-500/20 shadow-sm shadow-blue-500/5"
            : task.status === "completed"
              ? "bg-emerald-500/5 border border-emerald-500/10"
              : task.status === "failed"
                ? "bg-red-500/5 border border-red-500/10"
                : !parentStarted && depth > 0
                  ? "opacity-50 border border-transparent"
                  : "hover:bg-muted/40 border border-transparent hover:border-border/30"
        }`}
        style={{ marginLeft: `${depth * 16}px` }}
      >
        {/* Expand/Collapse for subtasks */}
        {hasSubtasks ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-0.5 rounded-md hover:bg-muted/60 text-muted-foreground transition-colors"
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

        {/* Task label/number badge */}
        <span
          className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md shrink-0 ${
            task.status === "completed"
              ? "bg-emerald-500/15 text-emerald-400"
              : task.status === "in-progress"
                ? "bg-blue-500/15 text-blue-400"
                : "bg-violet-500/15 text-violet-400"
          }`}
        >
          {task.label}
        </span>

        {/* Task description */}
        <span
          className={`text-[12px] flex-1 leading-snug ${
            task.status === "completed"
              ? "text-muted-foreground line-through opacity-70"
              : task.status === "in-progress"
                ? "text-foreground font-medium"
                : !parentStarted && depth > 0
                  ? "text-muted-foreground"
                  : "text-foreground"
          }`}
        >
          {task.description}
        </span>

        {/* Subtask progress chip */}
        {subtaskProgress && subtaskProgress.total > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground font-medium shrink-0">
            {subtaskProgress.completed}/{subtaskProgress.total}
          </span>
        )}

        {/* Lock icon when parent not started */}
        {!parentStarted && depth > 0 && task.status === "pending" && (
          <Lock className="h-3 w-3 text-muted-foreground/40 shrink-0" />
        )}

        {/* Start button */}
        {canStart && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10px] opacity-0 group-hover:opacity-100 transition-all duration-200 bg-gradient-to-r from-violet-500/10 to-blue-500/10 hover:from-violet-500/20 hover:to-blue-500/20 text-violet-400 hover:text-violet-300 gap-1 rounded-md"
            onClick={() => onStartTask(task)}
          >
            <Zap className="h-3 w-3" />
            Start
          </Button>
        )}

        {/* Not startable tooltip when parent is not started */}
        {!parentStarted &&
          depth > 0 &&
          task.status === "pending" &&
          !isExecuting && (
            <span className="text-[9px] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity italic shrink-0">
              Start parent first
            </span>
          )}

        {isThisExecuting && (
          <span className="text-[10px] text-blue-400 font-medium flex items-center gap-1 animate-pulse">
            <Loader2 className="h-3 w-3 animate-spin" />
            Running...
          </span>
        )}
      </div>

      {/* Subtasks */}
      {hasSubtasks && expanded && (
        <div className={`border-l-2 ${accentColor} ml-4 mt-0.5 space-y-0.5`}>
          {task.subtasks!.map((subtask) => (
            <TaskNode
              key={subtask.id}
              task={subtask}
              depth={depth + 1}
              onStartTask={onStartTask}
              isExecuting={isExecuting}
              executingTaskId={executingTaskId}
              parentStarted={thisStarted}
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
      <div className="shrink-0 border-b px-4 py-3 bg-gradient-to-r from-muted/30 via-violet-500/5 to-muted/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center">
              <ListChecks className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground leading-tight">
                {plan.title}
              </h3>
              <span className="text-[10px] text-muted-foreground">
                {totalTasks} tasks · {completedTasks} done
              </span>
            </div>
          </div>
          <Button
            size="sm"
            disabled={isExecuting || completedTasks === totalTasks}
            onClick={onStartAll}
            className="h-8 px-4 text-[11px] bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white gap-1.5 rounded-lg shadow-lg shadow-violet-500/20"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Running...
              </>
            ) : completedTasks === totalTasks ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                All Done!
              </>
            ) : (
              <>
                <PlayCircle className="h-3.5 w-3.5" />
                Start All Tasks
              </>
            )}
          </Button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 via-blue-500 to-emerald-400 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground font-bold tabular-nums min-w-[36px] text-right">
            {progress}%
          </span>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {plan.tasks.map((task) => (
          <TaskNode
            key={task.id}
            task={task}
            depth={0}
            onStartTask={onStartTask}
            isExecuting={isExecuting}
            executingTaskId={executingTaskId}
            parentStarted={true}
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
