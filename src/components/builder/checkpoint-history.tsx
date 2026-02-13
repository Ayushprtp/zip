/**
 * Checkpoint History Panel
 *
 * Displays a vertical timeline of automated checkpoints (git commits).
 * Each checkpoint represents an AI-generated code change.
 * Users can:
 *   - See which files were changed per checkpoint
 *   - Roll back to any previous checkpoint
 *   - View the commit on GitHub
 */

"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  GitCommitHorizontal,
  RotateCcw,
  ExternalLink,
  Clock,
  FileCode2,
  Bot,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type { Checkpoint } from "@/lib/builder/git-auto-commit";

// ─── Types ─────────────────────────────────────────────────────────────────

interface CheckpointHistoryProps {
  checkpoints: Checkpoint[];
  onRollback: (checkpointId: string) => Promise<any>;
  isRollingBack?: boolean;
  repoOwner?: string;
  repoName?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function CheckpointHistory({
  checkpoints,
  onRollback,
  isRollingBack = false,
  repoOwner,
  repoName,
}: CheckpointHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [confirmRollbackId, setConfirmRollbackId] = useState<string | null>(
    null,
  );

  const reversed = [...checkpoints].reverse();

  const handleRollback = useCallback(
    async (id: string) => {
      if (confirmRollbackId !== id) {
        setConfirmRollbackId(id);
        return;
      }

      setRollingBackId(id);
      try {
        await onRollback(id);
        setConfirmRollbackId(null);
      } finally {
        setRollingBackId(null);
      }
    },
    [confirmRollbackId, onRollback],
  );

  if (checkpoints.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-10 h-10 rounded-xl bg-muted/50 border border-border/40 flex items-center justify-center mb-3">
          <GitCommitHorizontal className="h-5 w-5 text-muted-foreground/60" />
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          No checkpoints yet
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1 max-w-[180px]">
          AI changes will be auto-committed as checkpoints you can roll back to.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 shrink-0">
        <h3 className="text-xs font-semibold flex items-center gap-1.5">
          <GitCommitHorizontal className="h-3.5 w-3.5 text-violet-400" />
          Checkpoints
        </h3>
        <span className="text-[10px] text-muted-foreground">
          {checkpoints.length}
        </span>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        <div className="relative py-2">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-6 bottom-6 w-px bg-border/50" />

          {reversed.map((checkpoint, index) => {
            const isExpanded = expandedId === checkpoint.id;
            const isLatest = index === 0;
            const isRollingBackThis = rollingBackId === checkpoint.id;
            const isConfirming = confirmRollbackId === checkpoint.id;

            return (
              <div key={checkpoint.id} className="relative px-3 py-1.5">
                <div
                  className={`flex items-start gap-2.5 group cursor-pointer rounded-md px-1.5 py-1.5 transition-colors ${
                    isExpanded ? "bg-muted/40" : "hover:bg-muted/20"
                  }`}
                  onClick={() =>
                    setExpandedId(isExpanded ? null : checkpoint.id)
                  }
                >
                  {/* Timeline dot */}
                  <div className="relative z-10 mt-0.5 shrink-0">
                    <div
                      className={`w-4 h-4 rounded-full flex items-center justify-center ${
                        isLatest
                          ? "bg-gradient-to-br from-violet-500 to-indigo-500 shadow-sm shadow-violet-500/30"
                          : "bg-muted border border-border/60"
                      }`}
                    >
                      <Bot
                        className={`h-2.5 w-2.5 ${isLatest ? "text-white" : "text-muted-foreground"}`}
                      />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {isExpanded ? (
                        <ChevronDown className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-[11px] font-medium truncate">
                        {checkpoint.message}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(checkpoint.timestamp)}
                      </span>
                      <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                        <FileCode2 className="h-2.5 w-2.5" />
                        {checkpoint.filesChanged.length} file
                        {checkpoint.filesChanged.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="mt-2 space-y-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                        {/* Files */}
                        <div className="space-y-0.5">
                          {checkpoint.filesChanged.map((file) => (
                            <div
                              key={file}
                              className="flex items-center gap-1.5 text-[9px] text-muted-foreground"
                            >
                              <FileCode2 className="h-2.5 w-2.5 text-emerald-500/60" />
                              <span className="truncate">
                                {file.startsWith("/") ? file.slice(1) : file}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 pt-1">
                          {!isLatest && (
                            <Button
                              size="sm"
                              variant={isConfirming ? "destructive" : "outline"}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRollback(checkpoint.id);
                              }}
                              disabled={isRollingBack}
                              className="h-6 text-[10px] px-2"
                            >
                              {isRollingBackThis ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : isConfirming ? (
                                <AlertCircle className="mr-1 h-3 w-3" />
                              ) : (
                                <RotateCcw className="mr-1 h-3 w-3" />
                              )}
                              {isConfirming ? "Confirm Rollback" : "Rollback"}
                            </Button>
                          )}

                          {isLatest && (
                            <div className="flex items-center gap-1 text-[9px] text-emerald-500">
                              <CheckCircle2 className="h-3 w-3" />
                              Current
                            </div>
                          )}

                          {repoOwner && repoName && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(
                                  `https://github.com/${repoOwner}/${repoName}/commit/${checkpoint.sha}`,
                                  "_blank",
                                );
                              }}
                              className="h-6 text-[10px] px-2"
                            >
                              <ExternalLink className="mr-1 h-3 w-3" />
                              View
                            </Button>
                          )}
                        </div>

                        {/* SHA */}
                        <p className="text-[8px] text-muted-foreground/50 font-mono">
                          {checkpoint.sha.slice(0, 7)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
