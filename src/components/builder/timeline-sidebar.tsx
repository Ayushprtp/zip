/**
 * TimelineSidebar - Displays project checkpoint history
 * Shows all checkpoints in chronological order with timestamps and labels
 */

"use client";

import type { Checkpoint } from "@/types/builder";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";

export interface TimelineSidebarProps {
  checkpoints: Checkpoint[];
  currentCheckpointIndex: number;
  onCheckpointSelect: (checkpoint: Checkpoint) => void;
  className?: string;
}

export function TimelineSidebar({
  checkpoints,
  currentCheckpointIndex,
  onCheckpointSelect,
  className = "",
}: TimelineSidebarProps) {
  if (checkpoints.length === 0) {
    return (
      <div className={`flex flex-col h-full p-4 ${className}`}>
        <h2 className="text-lg font-semibold mb-4">Timeline</h2>
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p className="text-sm text-center">
            No checkpoints yet.
            <br />
            Checkpoints will appear here as you make changes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">Timeline</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {checkpoints.length} checkpoint{checkpoints.length !== 1 ? "s" : ""}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {checkpoints.map((checkpoint, index) => (
            <CheckpointCard
              key={checkpoint.id}
              checkpoint={checkpoint}
              isActive={index === currentCheckpointIndex}
              onClick={() => onCheckpointSelect(checkpoint)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

interface CheckpointCardProps {
  checkpoint: Checkpoint;
  isActive: boolean;
  onClick: () => void;
}

function CheckpointCard({
  checkpoint,
  isActive,
  onClick,
}: CheckpointCardProps) {
  const formattedTime = formatTimestamp(checkpoint.timestamp);
  const formattedDate = formatDate(checkpoint.timestamp);

  return (
    <Card
      className={`p-3 cursor-pointer transition-colors hover:bg-accent ${
        isActive ? "border-primary bg-accent" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{checkpoint.label}</h3>
          {checkpoint.description && (
            <p className="text-xs text-muted-foreground mt-1">
              {checkpoint.description}
            </p>
          )}
        </div>
        {isActive && (
          <div className="flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-primary" />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
        <time dateTime={new Date(checkpoint.timestamp).toISOString()}>
          {formattedTime}
        </time>
        <span>•</span>
        <span>{formattedDate}</span>
      </div>
    </Card>
  );
}

/**
 * Formats a timestamp to a human-readable time string
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Formats a timestamp to a human-readable date string
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return "just now";
  } else if (diffMins < 60) {
    return `${diffMins} min${diffMins !== 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}
