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
  Upload,
  Loader2,
  FolderGit2,
  Plus,
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

  // Quick repo setup state (when no repo is configured)
  const [showQuickSetup, setShowQuickSetup] = useState(false);
  const [quickRepoName, setQuickRepoName] = useState("");
  const [isCreatingRepo, setIsCreatingRepo] = useState(false);
  const [ghUser, setGhUser] = useState<string | null>(null);
  const [ghChecked, setGhChecked] = useState(false);

  // Check if GitHub App is already connected
  useEffect(() => {
    if (!repoOwner && !ghChecked) {
      fetch("/api/github/user")
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error("Not connected");
        })
        .then((data) => {
          setGhUser(data.login || null);
        })
        .catch(() => {
          setGhUser(null);
        })
        .finally(() => setGhChecked(true));
    }
  }, [repoOwner, ghChecked]);

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
      // Refresh commits will happen automatically via effect dependency
    } catch (error) {
      console.error(error);
      toast.error("Failed to commit changes");
    } finally {
      setIsCommitting(false);
    }
  };

  // Quick create repo + initial push
  const handleQuickCreateRepo = useCallback(async () => {
    if (!quickRepoName.trim() || !ghUser) return;

    const cleanName = quickRepoName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_.]/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!cleanName) {
      toast.error("Invalid repository name");
      return;
    }

    setIsCreatingRepo(true);
    try {
      // 1. Create the repo
      const createRes = await fetch("/api/github/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          private: true,
          auto_init: true,
          description: "Created by Flare IDE",
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        if (createRes.status === 422) {
          toast.error(`Repository "${cleanName}" already exists`);
        } else {
          toast.error(err.error || "Failed to create repository");
        }
        return;
      }

      const repo = await createRes.json();
      const owner = repo.owner?.login || ghUser;
      const repoNameCreated = repo.name || cleanName;

      // 2. Save config to localStorage
      const threadId = window.location.pathname.split("/").pop() || "";
      const config = {
        owner,
        repo: repoNameCreated,
        branch: "main",
      };
      localStorage.setItem(
        `flare_repo_config_${threadId}`,
        JSON.stringify(config),
      );

      // 3. Push all sandbox files
      const filesList = currentFiles
        .filter((f) => !f.path.startsWith("/.flare-sh/"))
        .map((f) => ({
          path: f.path.replace(/^\//, ""),
          content: f.content,
        }));

      if (filesList.length > 0) {
        const commitRes = await fetch("/api/github/app/commit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            owner,
            repo: repoNameCreated,
            branch: "main",
            message: "Initial commit from Flare IDE",
            files: filesList,
          }),
        });

        if (!commitRes.ok) {
          toast.warning(
            "Repo created but initial push failed. Try committing manually.",
          );
        }
      }

      toast.success(`Repository "${repoNameCreated}" created & files pushed!`, {
        description: `${owner}/${repoNameCreated}`,
      });

      // Reload page to pick up the new config
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      console.error("Quick repo setup error:", err);
      toast.error(err.message || "Failed to setup repository");
    } finally {
      setIsCreatingRepo(false);
    }
  }, [quickRepoName, ghUser, currentFiles]);

  // If no repo is configured, show setup prompt
  const isGitConfigured = !!repoOwner;

  return (
    <div className="h-full flex flex-col overflow-hidden text-xs">
      {/* Git Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch className="h-3.5 w-3.5 text-orange-400" />
          <span className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground">
            Source Control
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded text-muted-foreground font-mono">
            {branch}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {/* Git Not Configured — Show setup options */}
        {!isGitConfigured && (
          <div className="p-3 space-y-3">
            {/* Show GitHub App status */}
            {ghChecked && ghUser ? (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                <Github className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[11px] text-emerald-500 font-medium">
                  Connected as {ghUser}
                </span>
              </div>
            ) : ghChecked ? (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                <Github className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-[11px] text-amber-500 font-medium">
                  GitHub not connected
                </span>
              </div>
            ) : null}

            {/* Quick repo creation */}
            {ghUser && !showQuickSetup && (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Create a GitHub repository to start tracking your changes. All
                  sandbox files will be uploaded automatically.
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowQuickSetup(true)}
                  className="w-full h-7 text-[11px] gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <Plus className="h-3 w-3" />
                  Create Repository
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    window.location.href = "/builder";
                  }}
                  className="w-full h-7 text-[11px] gap-1.5"
                >
                  <FolderGit2 className="h-3 w-3" />
                  Link Existing Repo
                </Button>
              </div>
            )}

            {/* Quick setup form */}
            {ghUser && showQuickSetup && (
              <div className="space-y-2">
                <label className="text-[10px] font-medium text-muted-foreground">
                  Repository Name
                </label>
                <Input
                  placeholder="my-project"
                  value={quickRepoName}
                  onChange={(e) => setQuickRepoName(e.target.value)}
                  className="h-7 text-[11px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleQuickCreateRepo();
                  }}
                />
                <p className="text-[9px] text-muted-foreground">
                  Will create{" "}
                  <strong>
                    {ghUser}/{quickRepoName || "..."}
                  </strong>{" "}
                  (private) and push {currentFiles.length} files.
                </p>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowQuickSetup(false)}
                    className="flex-1 h-7 text-[11px]"
                    disabled={isCreatingRepo}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleQuickCreateRepo}
                    disabled={isCreatingRepo || !quickRepoName.trim()}
                    className="flex-1 h-7 text-[11px] gap-1 bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {isCreatingRepo ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Upload className="h-3 w-3" />
                        Create & Push
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Not connected to GitHub */}
            {ghChecked && !ghUser && (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Connect your GitHub account to create repositories and commit
                  code directly from the IDE.
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    window.location.href = "/builder";
                  }}
                  className="w-full h-7 text-[11px] gap-1.5"
                >
                  <Github className="h-3 w-3" />
                  Connect GitHub
                </Button>
              </div>
            )}
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
                            {formatDistanceToNow(new Date(commit.date), {
                              addSuffix: true,
                            })}
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
