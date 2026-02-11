"use client";

import { useState, useCallback } from "react";
import JSZip from "jszip";

export type Template =
  | "react"
  | "nextjs"
  | "vite-react"
  | "vanilla"
  | "static"
  | "httpchain";
export type ServerStatus = "idle" | "booting" | "running" | "error";

interface BuilderState {
  files: Record<string, string>;
  template: Template;
  status: ServerStatus;
  history: Array<{ files: Record<string, string>; timestamp: number }>;
}

export function useBuilderEngine(initialTemplate: Template = "react") {
  const [state, setState] = useState<BuilderState>({
    files: {},
    template: initialTemplate,
    status: "running",
    history: [],
  });

  const setFiles = useCallback((files: Record<string, string>) => {
    setState((prev) => ({
      ...prev,
      files,
      history: [
        ...prev.history,
        { files: prev.files, timestamp: Date.now() },
      ].slice(-20),
    }));
  }, []);

  const updateFile = useCallback((path: string, content: string) => {
    setState((prev) => ({
      ...prev,
      files: { ...prev.files, [path]: content },
    }));
  }, []);

  const setTemplate = useCallback((template: Template) => {
    setState((prev) => ({ ...prev, template, files: {} }));
  }, []);

  const setStatus = useCallback((status: ServerStatus) => {
    setState((prev) => ({ ...prev, status }));
  }, []);

  const rollbackTo = useCallback((index: number) => {
    setState((prev) => {
      const snapshot = prev.history[index];
      if (!snapshot) return prev;
      return { ...prev, files: snapshot.files };
    });
  }, []);

  const downloadZip = useCallback(async () => {
    const zip = new JSZip();
    for (const [path, content] of Object.entries(state.files)) {
      zip.file(path.replace(/^\//, ""), content);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "project.zip";
    a.click();
    URL.revokeObjectURL(url);
  }, [state.files]);

  // Auto-detect template from files
  const detectTemplate = useCallback(
    (files: Record<string, string>): Template => {
      if (Object.keys(files).some((f) => f.includes("next.config")))
        return "nextjs";
      if (Object.keys(files).some((f) => f.includes("vite.config")))
        return "vite-react";
      if (
        Object.keys(files).some((f) => f.endsWith(".jsx") || f.endsWith(".tsx"))
      )
        return "react";
      return "static";
    },
    [],
  );

  return {
    files: state.files,
    template: state.template,
    status: state.status,
    history: state.history,
    setFiles,
    updateFile,
    setTemplate,
    setStatus,
    rollbackTo,
    downloadZip,
    detectTemplate,
  };
}
