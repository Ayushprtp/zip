"use client";

import { useState, useCallback } from "react";
import {
  Rocket,
  FolderOpen,
  Check,
  Loader2,
  PackagePlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useRemoteDevStore } from "@/stores/remote-dev-store";
import type { RemoteProjectTemplate } from "@/types/builder/remote";
import { REMOTE_PROJECT_TEMPLATES } from "@/types/builder/remote";

interface RemoteProjectInitializerProps {
  onClose?: () => void;
}

export function RemoteProjectInitializer({
  onClose,
}: RemoteProjectInitializerProps) {
  const {
    connectionStatus,
    workingDirectory,
    initializeProject,
    changeDirectory,
  } = useRemoteDevStore();

  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [projectPath, setProjectPath] = useState(workingDirectory);
  const [projectName, setProjectName] = useState("my-project");
  const [initializing, setInitializing] = useState(false);
  const [completed, setCompleted] = useState(false);

  const isConnected = connectionStatus === "connected";

  const handleInitialize = useCallback(async () => {
    if (!selectedTemplate) {
      toast.error("Select a project template");
      return;
    }

    if (!projectName.trim()) {
      toast.error("Enter a project name");
      return;
    }

    setInitializing(true);
    try {
      const fullPath = `${projectPath}/${projectName}`.replace(/\/+/g, "/");
      await initializeProject(selectedTemplate, fullPath);
      await changeDirectory(fullPath);
      setCompleted(true);
      toast.success(`Project initialized at ${fullPath}`);
    } catch (err: unknown) {
      toast.error(
        `Failed to initialize: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setInitializing(false);
    }
  }, [
    selectedTemplate,
    projectPath,
    projectName,
    initializeProject,
    changeDirectory,
  ]);

  if (!isConnected) {
    return (
      <div className="p-4 text-center text-muted-foreground text-xs">
        Connect to a remote server first
      </div>
    );
  }

  if (completed) {
    return (
      <div className="p-4 text-center space-y-2">
        <Check className="h-8 w-8 text-green-500 mx-auto" />
        <p className="text-sm font-medium text-foreground">Project created!</p>
        <p className="text-xs text-muted-foreground">
          Working directory switched to{" "}
          <code className="text-[10px] bg-muted px-1 py-0.5 rounded">
            {projectPath}/{projectName}
          </code>
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={onClose}
          className="h-7 text-xs mt-2"
        >
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5" />
          Initialize Remote Project
        </h3>
        {onClose && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-5 w-5"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Template selection */}
      <div>
        <label className="text-[10px] text-muted-foreground font-medium mb-1 block">
          Project Template
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            Object.entries(REMOTE_PROJECT_TEMPLATES) as [
              RemoteProjectTemplate,
              (typeof REMOTE_PROJECT_TEMPLATES)[RemoteProjectTemplate],
            ][]
          ).map(([id, tmpl]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedTemplate(id)}
              className={`flex flex-col p-2 rounded border text-left transition-colors ${
                selectedTemplate === id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <span className="text-[11px] font-medium text-foreground">
                {tmpl.name}
              </span>
              <span className="text-[9px] text-muted-foreground mt-0.5">
                {tmpl.description}
              </span>
              {tmpl.requiredTools.length > 0 && (
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {tmpl.requiredTools.map((tool) => (
                    <span
                      key={tool}
                      className="px-1 py-0 text-[7px] rounded bg-muted text-muted-foreground"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Project path */}
      <div>
        <label className="text-[10px] text-muted-foreground font-medium">
          Parent Directory
        </label>
        <div className="relative">
          <FolderOpen className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            className="w-full h-7 pl-7 pr-2 text-xs bg-background border rounded font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Project name */}
      <div>
        <label className="text-[10px] text-muted-foreground font-medium">
          Project Name
        </label>
        <div className="relative">
          <PackagePlus className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="my-project"
            className="w-full h-7 pl-7 pr-2 text-xs bg-background border rounded font-mono focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <p className="text-[9px] text-muted-foreground mt-0.5">
          Full path: {projectPath}/{projectName}
        </p>
      </div>

      {/* Initialize */}
      <Button
        size="sm"
        variant="default"
        onClick={handleInitialize}
        disabled={initializing || !selectedTemplate}
        className="w-full h-8 text-xs gap-1"
      >
        {initializing ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            Initializing...
          </>
        ) : (
          <>
            <Rocket className="h-3 w-3" />
            Initialize Project
          </>
        )}
      </Button>
    </div>
  );
}
