"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Template } from "@/hooks/useBuilderEngine";

interface Checkpoint {
  id: string;
  files: Record<string, string>;
  template: Template;
  timestamp: number;
  label?: string;
}

interface ProjectContextValue {
  checkpoints: Checkpoint[];
  addCheckpoint: (
    files: Record<string, string>,
    template: Template,
    label?: string,
  ) => void;
  restoreCheckpoint: (id: string) => Checkpoint | undefined;
  clearCheckpoints: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);

  const addCheckpoint = (
    files: Record<string, string>,
    template: Template,
    label?: string,
  ) => {
    const checkpoint: Checkpoint = {
      id: crypto.randomUUID(),
      files,
      template,
      timestamp: Date.now(),
      label,
    };
    setCheckpoints((prev) => [...prev, checkpoint].slice(-50));
  };

  const restoreCheckpoint = (id: string) =>
    checkpoints.find((c) => c.id === id);

  const clearCheckpoints = () => setCheckpoints([]);

  return (
    <ProjectContext.Provider
      value={{
        checkpoints,
        addCheckpoint,
        restoreCheckpoint,
        clearCheckpoints,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
