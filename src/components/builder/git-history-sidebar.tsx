/**
 * Git History Sidebar Component
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GitCommit,
  GitBranch,
  Clock,
  User,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { CommitInfo } from "@/lib/builder/git-service";

interface GitHistorySidebarProps {
  onLoadHistory: () => Promise<CommitInfo[]>;
  onCheckout: (commitHash: string) => Promise<void>;
  onReset: (commitHash: string) => Promise<void>;
}

export function GitHistorySidebar({
  onLoadHistory,
  onCheckout,
  onReset,
}: GitHistorySidebarProps) {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const history = await onLoadHistory();
      setCommits(history);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (commitHash: string) => {
    setLoading(true);
    try {
      await onCheckout(commitHash);
      setSelectedCommit(commitHash);
    } catch (err) {
      console.error("Checkout failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (commitHash: string) => {
    if (!confirm("This will permanently reset to this commit. Continue?")) {
      return;
    }

    setLoading(true);
    try {
      await onReset(commitHash);
      await loadHistory();
    } catch (err) {
      console.error("Reset failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col border-l">
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold">
            <GitBranch className="h-4 w-4" />
            Git History
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadHistory}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-2 p-4">
          {commits.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              No commits yet
            </p>
          ) : (
            commits.map((commit) => (
              <div
                key={commit.oid}
                className={`rounded-lg border p-3 transition-colors ${
                  selectedCommit === commit.oid
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <GitCommit className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-tight">
                        {commit.message}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{commit.author}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(commit.timestamp, {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">
                        {commit.oid.substring(0, 7)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCheckout(commit.oid)}
                      disabled={loading}
                    >
                      Preview
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReset(commit.oid)}
                      disabled={loading}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
