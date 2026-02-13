/**
 * Git Auto-Commit Service (Client-Side)
 *
 * After each AI chat cycle that produces file changes, this service
 * calls our Next.js API routes which use the Flare-SH GitHub App's
 * installation token to commit changes.
 *
 * Architecture:
 *   Client (this file) → POST /api/github/app/commit → Server → GitHub API
 *
 * The client NEVER touches the GitHub App private key or installation token directly.
 * All git operations go through our server-side API routes.
 */

"use client";

import { useState, useCallback, useRef, useEffect } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Checkpoint {
  id: string;
  sha: string;
  url: string;
  message: string;
  timestamp: number;
  filesChanged: string[];
}

export interface GitRepoConfig {
  owner: string;
  repo: string;
  branch: string;
  installationId?: number; // optional — server uses cookie if not provided
}

interface CommitResponse {
  sha: string;
  url: string;
  message: string;
  error?: string;
}

// ─── Service ───────────────────────────────────────────────────────────────

export class GitAutoCommitService {
  private config: GitRepoConfig;
  private checkpoints: Checkpoint[] = [];
  private storageKey: string;

  constructor(config: GitRepoConfig) {
    this.config = config;
    this.storageKey = `flare_checkpoints_${config.owner}_${config.repo}_${config.branch}`;
    this.loadCheckpoints();
  }

  /**
   * Commit files to the repo through our API.
   */
  async commitFiles(
    files: Array<{ path: string; content: string }>,
    message: string,
  ): Promise<Checkpoint> {
    const response = await fetch("/api/github/app/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner: this.config.owner,
        repo: this.config.repo,
        branch: this.config.branch,
        files,
        message,
        installationId: this.config.installationId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Commit failed (${response.status})`);
    }

    const result: CommitResponse = await response.json();

    const checkpoint: Checkpoint = {
      id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sha: result.sha,
      url: result.url,
      message,
      timestamp: Date.now(),
      filesChanged: files.map((f) => f.path),
    };

    this.checkpoints.unshift(checkpoint);
    this.saveCheckpoints();

    return checkpoint;
  }

  /**
   * Rollback the branch to a specific checkpoint.
   */
  async rollback(checkpointId: string): Promise<void> {
    const checkpoint = this.checkpoints.find((cp) => cp.id === checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    const response = await fetch("/api/github/app/rollback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner: this.config.owner,
        repo: this.config.repo,
        branch: this.config.branch,
        targetSha: checkpoint.sha,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Rollback failed (${response.status})`,
      );
    }

    // Remove checkpoints after the rollback target
    const idx = this.checkpoints.findIndex((cp) => cp.id === checkpointId);
    if (idx >= 0) {
      this.checkpoints = this.checkpoints.slice(idx);
      this.saveCheckpoints();
    }
  }

  /**
   * Create a new branch (e.g., for feature work or AI experiments).
   */
  async createBranch(branchName: string, baseBranch?: string): Promise<void> {
    const response = await fetch("/api/github/app/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner: this.config.owner,
        repo: this.config.repo,
        branchName,
        baseBranch: baseBranch || this.config.branch,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Create branch failed (${response.status})`,
      );
    }
  }

  getCheckpoints(): Checkpoint[] {
    return [...this.checkpoints];
  }

  getConfig(): GitRepoConfig {
    return { ...this.config };
  }

  // ─── Persistence ──────────────────────────────────────────────────────

  private loadCheckpoints() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.checkpoints = JSON.parse(stored);
      }
    } catch {
      this.checkpoints = [];
    }
  }

  private saveCheckpoints() {
    try {
      // Keep only last 100 checkpoints
      const toSave = this.checkpoints.slice(0, 100);
      localStorage.setItem(this.storageKey, JSON.stringify(toSave));
    } catch {
      // localStorage full or unavailable
    }
  }
}

// ─── React Hook ────────────────────────────────────────────────────────────

interface UseGitAutoCommitOptions {
  /** Repo config. Null/undefined = disabled. */
  repoConfig: GitRepoConfig | null;
  /** Master switch */
  enabled?: boolean;
}

export function useGitAutoCommit({
  repoConfig,
  enabled = true,
}: UseGitAutoCommitOptions) {
  const serviceRef = useRef<GitAutoCommitService | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isConfigured = Boolean(enabled && repoConfig);

  // Initialize / update service when config changes
  useEffect(() => {
    if (repoConfig && enabled) {
      serviceRef.current = new GitAutoCommitService(repoConfig);
      setCheckpoints(serviceRef.current.getCheckpoints());
    } else {
      serviceRef.current = null;
      setCheckpoints([]);
    }
  }, [
    repoConfig?.owner,
    repoConfig?.repo,
    repoConfig?.branch,
    repoConfig?.installationId,
    enabled,
  ]);

  /**
   * Commit files and create a checkpoint.
   */
  const commitAndPush = useCallback(
    async (
      files: Array<{ path: string; content: string }>,
      message: string,
    ): Promise<Checkpoint | null> => {
      if (!serviceRef.current) return null;

      setIsCommitting(true);
      setError(null);

      try {
        const checkpoint = await serviceRef.current.commitFiles(files, message);
        setCheckpoints(serviceRef.current.getCheckpoints());
        return checkpoint;
      } catch (err: any) {
        const msg = err.message || "Commit failed";
        setError(msg);
        console.error("[GitAutoCommit] Commit error:", msg);
        return null;
      } finally {
        setIsCommitting(false);
      }
    },
    [],
  );

  /**
   * Rollback to a specific checkpoint.
   */
  const rollback = useCallback(
    async (checkpointId: string): Promise<boolean> => {
      if (!serviceRef.current) return false;

      setIsCommitting(true);
      setError(null);

      try {
        await serviceRef.current.rollback(checkpointId);
        setCheckpoints(serviceRef.current.getCheckpoints());
        return true;
      } catch (err: any) {
        const msg = err.message || "Rollback failed";
        setError(msg);
        console.error("[GitAutoCommit] Rollback error:", msg);
        return false;
      } finally {
        setIsCommitting(false);
      }
    },
    [],
  );

  return {
    isCommitting,
    isConfigured,
    checkpoints,
    error,
    commitAndPush,
    rollback,
  };
}
