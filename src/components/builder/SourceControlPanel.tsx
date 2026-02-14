"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";
import {
  GitBranch,
  RotateCcw,
  Clock,
  ChevronRight,
  ChevronDown,
  FileCode,
  CheckCircle2,
  Github,
  Loader2,
  Plus,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface SourceControlPanelProps {
  files: Record<string, string>;
  repoOwner?: string;
  repoName?: string;
  branch?: string;
  onCommitAndPush?: (
    message: string,
    files?: Array<{ path: string; content: string }>,
  ) => Promise<void>;
}

export function SourceControlPanel({
  files: _originalFiles,
  repoOwner,
  repoName,
  branch = "main",
  onCommitAndPush,
}: SourceControlPanelProps) {
  const { sandpack } = useSandpack();
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);

  // Visibility toggles
  const [showChanges, setShowChanges] = useState(true);
  const [showHistory, setShowHistory] = useState(true);
  const [showBranches, setShowBranches] = useState(false);

  // Branch management
  const [newBranchName, setNewBranchName] = useState("");
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [branches, setBranches] = useState<
    Array<{ name: string; current: boolean }>
  >([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // Helper to get files from Sandpack state
  const currentFiles = useMemo(() => {
    return Object.entries(sandpack.files)
      .filter(
        ([path]) =>
          !path.startsWith("/.flare-sh/") ||
          path.startsWith("/.flare-sh/chats/"),
      )
      .map(([path, fileData]) => ({
        path,
        content: typeof fileData === "string" ? fileData : fileData.code,
      }));
  }, [sandpack.files]);

  const [commits, setCommits] = useState<
    Array<{
      sha: string;
      message: string;
      date: string;
      author: string;
    }>
  >([]);
  const [loadingCommits, setLoadingCommits] = useState(false);

  // Load commits
  useEffect(() => {
    if (repoOwner && repoName) {
      setLoadingCommits(true);
      fetch(`/api/github/commits?owner=${repoOwner}&repo=${repoName}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setCommits(data);
        })
        .catch(() => {})
        .finally(() => setLoadingCommits(false));
    }
  }, [repoOwner, repoName, isCommitting]);

  // Load branches when section is opened
  useEffect(() => {
    if (showBranches && repoOwner && repoName && branches.length === 0) {
      loadBranches();
    }
  }, [showBranches, repoOwner, repoName]);

  const loadBranches = useCallback(async () => {
    if (!repoOwner || !repoName) return;
    setLoadingBranches(true);
    try {
      const res = await fetch(
        `/api/github/app/branches?owner=${repoOwner}&repo=${repoName}`,
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.branches)) {
          setBranches(
            data.branches.map((b: any) => ({
              name: b.name,
              current: b.name === branch,
            })),
          );
        }
      }
    } catch {
      // silent
    } finally {
      setLoadingBranches(false);
    }
  }, [repoOwner, repoName, branch]);

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    if (!onCommitAndPush) {
      toast.error("Git integration not configured");
      return;
    }

    setIsCommitting(true);
    try {
      await onCommitAndPush(commitMessage.trim(), currentFiles);
      setCommitMessage("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to commit changes");
    } finally {
      setIsCommitting(false);
    }
  };

  const handleCreateBranch = useCallback(async () => {
    if (!newBranchName.trim() || !repoOwner || !repoName) return;

    const cleanName = newBranchName
      .trim()
      .replace(/[^a-zA-Z0-9\-_./]/g, "-")
      .replace(/-+/g, "-");

    setIsCreatingBranch(true);
    try {
      const res = await fetch("/api/github/app/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: repoOwner,
          repo: repoName,
          branchName: cleanName,
          baseBranch: branch,
        }),
      });

      if (res.ok) {
        toast.success(`Branch "${cleanName}" created`);
        setNewBranchName("");
        setBranches((prev) => [
          ...prev,
          { name: cleanName, current: false },
        ]);
      } else if (res.status === 422) {
        toast.info(`Branch "${cleanName}" already exists`);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to create branch");
      }
    } catch {
      toast.error("Failed to create branch");
    } finally {
      setIsCreatingBranch(false);
    }
  }, [newBranchName, repoOwner, repoName, branch]);

  const isGitConfigured = !!repoOwner;

  return (
    <div className="h-full flex flex-col overflow-hidden text-xs">
      {/* Git Info Bar */}
      <div className="flex items-center justify-end px-3 py-1.5 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground font-mono">
            {branch}
          </span>
          {isGitConfigured && (
            <a
              href={`https://github.com/${repoOwner}/${repoName}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              title="Open on GitHub"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {/* Repo info when configured */}
        {isGitConfigured && (
          <div className="px-3 py-2 border-b border-border/20">
            <div className="flex items-center gap-2">
              <Github className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-[11px] text-muted-foreground truncate">
                {repoOwner}/{repoName}
              </span>
            </div>
          </div>
        )}

        {/* Git NOT configured — tell user it's already set up */}
        {!isGitConfigured && (
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20">
              <Github className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[11px] text-amber-500 font-medium">
                No repository linked
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Go back to the project setup to connect a GitHub repository.
            </p>
          </div>
        )}

        {/* Commit Input Area — only when repo is configured */}
        {isGitConfigured && (
          <div className="p-3 border-b border-border/20">
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Message (e.g. 'feat: add user login')"
              className="w-full h-16 bg-muted/30 border border-border/30 rounded-md p-2 text-[11px] resize-none focus:outline-none focus:ring-1 focus:ring-orange-500/40 focus:border-orange-500/40 placeholder:text-muted-foreground/40 mb-2"
            />
            <Button
              size="sm"
              onClick={handleCommit}
              disabled={
                isCommitting || !commitMessage.trim() || !onCommitAndPush
              }
              className="w-full h-7 text-[11px] bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50"
            >
              {isCommitting ? (
                <>
                  <RotateCcw className="mr-1.5 h-3 w-3 animate-spin" />
                  Committing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1.5 h-3 w-3" />
                  Commit & Push
                </>
              )}
            </Button>
          </div>
        )}

        {/* Changes Section */}
        <div>
          <button
            onClick={() => setShowChanges(!showChanges)}
            className="w-full flex items-center px-2 py-1 bg-muted/20 hover:bg-muted/30 transition-colors"
          >
            {showChanges ? (
              <ChevronDown className="h-3 w-3 mr-1 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 mr-1 text-muted-foreground" />
            )}
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">
              Changes
            </span>
            <span className="ml-auto text-[10px] bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded-full">
              {currentFiles.length}
            </span>
          </button>

          {showChanges && (
            <div className="py-1">
              {currentFiles.slice(0, 50).map((file) => (
                <div
                  key={file.path}
                  className="flex items-center gap-2 px-3 py-1 hover:bg-muted/30 cursor-default group"
                  title={file.path}
                >
                  <FileCode className="h-3 w-3 text-muted-foreground/60" />
                  <span className="text-[11px] truncate flex-1">
                    {file.path.split("/").pop()}
                  </span>
                  <span className="text-[10px] text-muted-foreground/40 group-hover:text-muted-foreground/60">
                    M
                  </span>
                </div>
              ))}
              {currentFiles.length > 50 && (
                <div className="px-3 py-1 text-[10px] text-muted-foreground italic">
                  + {currentFiles.length - 50} more files
                </div>
              )}
            </div>
          )}
        </div>

        {/* Branches Section — only when git is configured */}
        {isGitConfigured && (
          <div>
            <button
              onClick={() => setShowBranches(!showBranches)}
              className="w-full flex items-center px-2 py-1 bg-muted/20 hover:bg-muted/30 transition-colors mt-1"
            >
              {showBranches ? (
                <ChevronDown className="h-3 w-3 mr-1 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 mr-1 text-muted-foreground" />
              )}
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                Branches
              </span>
            </button>

            {showBranches && (
              <div className="p-2 space-y-2">
                {/* Create new branch */}
                <div className="flex gap-1.5">
                  <Input
                    placeholder="new-branch-name"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    className="h-6 text-[10px]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateBranch();
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateBranch}
                    disabled={isCreatingBranch || !newBranchName.trim()}
                    className="h-6 px-2 text-[10px] gap-1"
                  >
                    {isCreatingBranch ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <Plus className="h-2.5 w-2.5" />
                    )}
                  </Button>
                </div>
                <p className="text-[9px] text-muted-foreground">
                  New branch from{" "}
                  <strong className="text-foreground">{branch}</strong>
                </p>

                {/* Branch list */}
                {loadingBranches ? (
                  <div className="flex items-center gap-1 py-1 text-[10px] text-muted-foreground">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    Loading...
                  </div>
                ) : (
                  branches.map((b) => (
                    <div
                      key={b.name}
                      className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/30"
                    >
                      <GitBranch className="h-3 w-3 text-muted-foreground/60" />
                      <span
                        className={`text-[11px] flex-1 truncate ${
                          b.current ? "font-semibold text-orange-400" : ""
                        }`}
                      >
                        {b.name}
                      </span>
                      {b.current && (
                        <span className="text-[9px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">
                          current
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Commits History Section */}
        {repoOwner && repoName && (
          <div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center px-2 py-1 bg-muted/20 hover:bg-muted/30 transition-colors mt-1"
            >
              {showHistory ? (
                <ChevronDown className="h-3 w-3 mr-1 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3 w-3 mr-1 text-muted-foreground" />
              )}
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                Commits
              </span>
            </button>

            {showHistory && (
              <div className="py-1">
                {loadingCommits && commits.length === 0 ? (
                  <div className="px-4 py-2 text-[10px] text-muted-foreground italic">
                    Loading history...
                  </div>
                ) : commits.length === 0 ? (
                  <div className="px-4 py-2 text-[10px] text-muted-foreground italic">
                    No commits yet
                  </div>
                ) : (
                  <div className="relative pl-4 ml-2 border-l border-border/20 space-y-3 py-2">
                    {commits.map((commit) => (
                      <div key={commit.sha} className="relative group">
                        <div className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full bg-orange-400/40 group-hover:bg-orange-400 ring-2 ring-background transition-colors" />
                        <div className="text-[11px] font-medium leading-tight mb-0.5">
                          {commit.message}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {(() => {
                              try {
                                const d = new Date(commit.date);
                                if (isNaN(d.getTime())) return "recently";
                                return formatDistanceToNow(d, { addSuffix: true });
                              } catch { return "recently"; }
                            })()}
                          </span>
                          <span>•</span>
                          <span className="font-mono text-[9px] opacity-70">
                            {commit.sha.substring(0, 7)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
