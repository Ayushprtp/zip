/**
 * GitHub Integration Hook
 */

"use client";

import { useState, useCallback } from "react";
import { VirtualFileSystemService } from "./virtual-fs-service";
import { GitService } from "./git-service";
import { GitSyncService } from "./git-sync-service";

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  clone_url: string;
  private: boolean;
}

export interface GitHubUser {
  login: string;
  name: string;
  email: string;
  avatar_url: string;
}

export function useGitHubIntegration() {
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [vfs] = useState(() => new VirtualFileSystemService());
  const [git] = useState(() => new GitService(vfs));
  const [syncService] = useState(
    () =>
      new GitSyncService(git, vfs, {
        autoCommit: true,
        autoPush: false,
        commitInterval: 60000,
        conflictResolution: "manual",
      }),
  );

  const connectGitHub = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);

    try {
      // Store token
      await fetch("/api/github/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      // Get user info
      const userRes = await fetch("/api/github/user");
      const userData = await userRes.json();

      if (userData.error) {
        throw new Error(userData.error);
      }

      setUser(userData.user);
      setIsConnected(true);

      // Load repos
      await loadRepos();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnectGitHub = useCallback(async () => {
    setLoading(true);
    try {
      await fetch("/api/github/auth", { method: "DELETE" });
      setIsConnected(false);
      setUser(null);
      setRepos([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRepos = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/github/repos");
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setRepos(data.repos);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createRepo = useCallback(
    async (name: string, description?: string, isPrivate = true) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/github/repos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, isPrivate }),
        });

        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }

        await loadRepos();
        return data.repo;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadRepos],
  );

  const initializeRepo = useCallback(
    async (files: Record<string, string>, repoUrl: string, token: string) => {
      setLoading(true);
      setError(null);

      try {
        // Initialize VFS
        await vfs.initialize();
        await vfs.syncFromProjectFiles(files);

        // Initialize Git
        await git.init({
          name: user?.name || "Builder User",
          email: user?.email || "builder@example.com",
        });

        // Add remote
        await git.addRemote("origin", repoUrl);

        // Initial commit
        await git.add(".");
        const commitHash = await git.commit("Initial commit from AI Builder");

        // Push to GitHub
        await git.push("origin", "main", token);

        return commitHash;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [vfs, git, user],
  );

  const syncToGitHub = useCallback(
    async (files: Record<string, string>, message: string, token: string) => {
      setLoading(true);
      setError(null);

      try {
        const commitHash = await syncService.manualSync(files, message, token);
        return commitHash;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [syncService],
  );

  const getCommitHistory = useCallback(async () => {
    try {
      const commits = await git.log(50);
      return commits;
    } catch (err: any) {
      setError(err.message);
      return [];
    }
  }, [git]);

  const checkStatus = useCallback(async () => {
    try {
      const isInit = await git.isInitialized();
      if (!isInit) return null;

      const hasChanges = await git.hasChanges();
      const currentBranch = await git.getCurrentBranch();

      return {
        hasChanges,
        currentBranch,
      };
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [git]);

  return {
    isConnected,
    user,
    repos,
    loading,
    error,
    connectGitHub,
    disconnectGitHub,
    loadRepos,
    createRepo,
    initializeRepo,
    syncToGitHub,
    getCommitHistory,
    checkStatus,
    vfs,
    git,
    syncService,
  };
}
