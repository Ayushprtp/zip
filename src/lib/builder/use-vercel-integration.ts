/**
 * Vercel Integration Hook
 */

"use client";

import { useState, useCallback } from "react";

export interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
}

export interface VercelDeployment {
  id: string;
  url: string;
  state: "BUILDING" | "READY" | "ERROR" | "CANCELED";
  created: number;
  readyState: string;
}

export function useVercelIntegration() {
  const [isConnected, setIsConnected] = useState(false);
  const [projects, setProjects] = useState<VercelProject[]>([]);
  const [deployments, setDeployments] = useState<VercelDeployment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectVercel = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);

    try {
      await fetch("/api/vercel/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      setIsConnected(true);
      await loadProjects();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnectVercel = useCallback(async () => {
    setLoading(true);
    try {
      await fetch("/api/vercel/auth", { method: "DELETE" });
      setIsConnected(false);
      setProjects([]);
      setDeployments([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/vercel/projects");
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setProjects(data.projects);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(
    async (
      name: string,
      gitRepository: { type: "github"; repo: string },
      options?: {
        framework?: string;
        buildCommand?: string;
        outputDirectory?: string;
      },
    ) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/vercel/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            gitRepository,
            ...options,
          }),
        });

        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }

        await loadProjects();
        return data.project;
      } catch (err: any) {
        setError(err.message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadProjects],
  );

  const loadDeployments = useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/vercel/deployments?projectId=${projectId}`,
      );
      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setDeployments(data.deployments);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const triggerDeployment = useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/vercel/deployments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      return data.deployment;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch("/api/vercel/auth");
      const data = await res.json();
      setIsConnected(data.hasToken);
      return data.hasToken;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  return {
    isConnected,
    projects,
    deployments,
    loading,
    error,
    connectVercel,
    disconnectVercel,
    loadProjects,
    createProject,
    loadDeployments,
    triggerDeployment,
    checkConnection,
  };
}
