"use client";

import {
  Wifi,
  Server,
  GitBranch,
  FolderOpen,
  Cpu,
  HardDrive,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRemoteDevStore } from "@/stores/remote-dev-store";

interface RemoteStatusBarProps {
  className?: string;
}

export function RemoteStatusBar({ className }: RemoteStatusBarProps) {
  const {
    connectionStatus,
    activeConnection,
    executionContext,
    workingDirectory,
    gitStatus,
    systemInfo,
    isHealthy,
    setExecutionContext,
    refreshSystemInfo,
    refreshGitStatus,
  } = useRemoteDevStore();

  const isConnected = connectionStatus === "connected";

  if (!isConnected) return null;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1 border-t text-[10px] bg-muted/30 overflow-x-auto ${className || ""}`}
    >
      {/* Connection indicator */}
      <div className="flex items-center gap-1 shrink-0">
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            isHealthy ? "bg-green-500 animate-pulse" : "bg-yellow-500"
          }`}
        />
        <Wifi className="h-3 w-3 text-green-600" />
        <span className="font-medium text-foreground">
          {activeConnection?.name ||
            `${activeConnection?.username}@${activeConnection?.host}`}
        </span>
      </div>

      <span className="text-muted-foreground">|</span>

      {/* Execution context toggle */}
      <button
        type="button"
        onClick={() =>
          setExecutionContext(
            executionContext === "remote" ? "sandbox" : "remote",
          )
        }
        className="flex items-center gap-1 shrink-0 hover:text-foreground text-muted-foreground transition-colors"
        title="Toggle execution context"
      >
        {executionContext === "remote" ? (
          <>
            <ToggleRight className="h-3 w-3 text-green-500" />
            <span className="text-green-600 font-bold uppercase">Remote</span>
          </>
        ) : (
          <>
            <ToggleLeft className="h-3 w-3 text-blue-500" />
            <span className="text-blue-600 font-bold uppercase">Sandbox</span>
          </>
        )}
      </button>

      <span className="text-muted-foreground">|</span>

      {/* Working directory */}
      <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
        <FolderOpen className="h-3 w-3" />
        <span className="max-w-[150px] truncate" title={workingDirectory}>
          {workingDirectory}
        </span>
      </div>

      {/* Git info */}
      {gitStatus?.isRepo && (
        <>
          <span className="text-muted-foreground">|</span>
          <div className="flex items-center gap-1 shrink-0 text-muted-foreground">
            <GitBranch className="h-3 w-3 text-purple-500" />
            <span className="text-purple-600">{gitStatus.branch}</span>
            {(gitStatus.modified?.length || 0) > 0 && (
              <span className="text-yellow-600">
                ~{gitStatus.modified?.length}
              </span>
            )}
            {(gitStatus.staged?.length || 0) > 0 && (
              <span className="text-green-600">
                +{gitStatus.staged?.length}
              </span>
            )}
            {(gitStatus.untracked?.length || 0) > 0 && (
              <span className="text-muted-foreground">
                ?{gitStatus.untracked?.length}
              </span>
            )}
          </div>
        </>
      )}

      {/* System info */}
      {systemInfo && (
        <>
          <span className="text-muted-foreground">|</span>
          <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
            <span className="flex items-center gap-0.5" title="OS">
              <Server className="h-2.5 w-2.5" />
              {systemInfo.os}
            </span>
            {systemInfo.arch && (
              <span className="flex items-center gap-0.5" title="Architecture">
                <Cpu className="h-2.5 w-2.5" />
                {systemInfo.arch}
              </span>
            )}
            {systemInfo.diskUsage && (
              <span className="flex items-center gap-0.5" title="Disk usage">
                <HardDrive className="h-2.5 w-2.5" />
                {systemInfo.diskUsage.percentage}
              </span>
            )}
          </div>
        </>
      )}

      <div className="flex-1" />

      {/* Refresh */}
      <Button
        size="icon"
        variant="ghost"
        onClick={() => {
          refreshSystemInfo();
          refreshGitStatus();
        }}
        className="h-4 w-4 shrink-0"
        title="Refresh status"
      >
        <RefreshCw className="h-2.5 w-2.5" />
      </Button>
    </div>
  );
}
