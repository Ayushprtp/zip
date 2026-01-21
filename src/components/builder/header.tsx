/**
 * Header Component - Control header for the AI Builder IDE
 * Provides mode toggle, server controls, library settings, and deploy button
 */

"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProject, useProjectActions } from "@/lib/builder/project-context";
import type { LibraryType, LayoutMode } from "@/types/builder";
import {
  MessageSquare,
  Code2,
  Play,
  Square,
  RotateCw,
  Settings,
  Rocket,
} from "lucide-react";

// ============================================================================
// Server Status Indicator
// ============================================================================

interface ServerStatusIndicatorProps {
  status: "stopped" | "booting" | "running" | "error";
}

function ServerStatusIndicator({ status }: ServerStatusIndicatorProps) {
  const colors = {
    stopped: "bg-red-500",
    booting: "bg-yellow-500",
    running: "bg-green-500",
    error: "bg-red-500",
  };

  const labels = {
    stopped: "Stopped",
    booting: "Booting",
    running: "Running",
    error: "Error",
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${colors[status]}`} />
      <span className="text-sm text-muted-foreground">{labels[status]}</span>
    </div>
  );
}

// ============================================================================
// Mode Toggle
// ============================================================================

interface ModeToggleProps {
  mode: LayoutMode;
  onModeChange: (mode: LayoutMode) => void;
}

function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-md border p-1">
      <Button
        variant={mode === "chat" ? "default" : "ghost"}
        size="sm"
        onClick={() => onModeChange("chat")}
        className="gap-2"
      >
        <MessageSquare className="h-4 w-4" />
        Chat
      </Button>
      <Button
        variant={mode === "builder" ? "default" : "ghost"}
        size="sm"
        onClick={() => onModeChange("builder")}
        className="gap-2"
      >
        <Code2 className="h-4 w-4" />
        Builder
      </Button>
    </div>
  );
}

// ============================================================================
// Server Controls
// ============================================================================

interface ServerControlsProps {
  status: "stopped" | "booting" | "running" | "error";
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
}

function ServerControls({
  status,
  onStart,
  onStop,
  onRestart,
}: ServerControlsProps) {
  const isRunning = status === "running";
  const isBooting = status === "booting";
  const isStopped = status === "stopped" || status === "error";

  return (
    <div className="flex items-center gap-2">
      <ServerStatusIndicator status={status} />
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onStart}
          disabled={isRunning || isBooting}
          className="gap-2"
        >
          <Play className="h-4 w-4" />
          Start
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onStop}
          disabled={isStopped}
          className="gap-2"
        >
          <Square className="h-4 w-4" />
          Stop
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onRestart}
          disabled={isStopped}
          className="gap-2"
        >
          <RotateCw className="h-4 w-4" />
          Restart
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Library Settings
// ============================================================================

interface LibrarySettingsProps {
  currentLibrary: LibraryType;
  onLibraryChange: (library: LibraryType) => void;
}

function LibrarySettings({
  currentLibrary,
  onLibraryChange,
}: LibrarySettingsProps) {
  const libraries: { value: LibraryType; label: string }[] = [
    { value: "shadcn", label: "Shadcn UI" },
    { value: "daisyui", label: "DaisyUI" },
    { value: "material-ui", label: "Material UI" },
    { value: "tailwind", label: "Pure Tailwind" },
  ];

  const currentLabel =
    libraries.find((lib) => lib.value === currentLibrary)?.label ||
    "Select Library";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          {currentLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>UI Library</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {libraries.map((library) => (
          <DropdownMenuItem
            key={library.value}
            onClick={() => onLibraryChange(library.value)}
            className={currentLibrary === library.value ? "bg-accent" : ""}
          >
            {library.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================================
// Deploy Button
// ============================================================================

interface DeployButtonProps {
  onDeploy: () => void;
  disabled?: boolean;
}

function DeployButton({ onDeploy, disabled }: DeployButtonProps) {
  return (
    <Button
      variant="default"
      size="sm"
      onClick={onDeploy}
      disabled={disabled}
      className="gap-2"
    >
      <Rocket className="h-4 w-4" />
      Deploy Live
    </Button>
  );
}

// ============================================================================
// Main Header Component
// ============================================================================

interface HeaderProps {
  onDeploy?: () => void;
  onServerStart?: () => void;
  onServerStop?: () => void;
  onServerRestart?: () => void;
}

export function Header({
  onDeploy,
  onServerStart,
  onServerStop,
  onServerRestart,
}: HeaderProps) {
  const { state } = useProject();
  const actions = useProjectActions();

  const handleModeChange = (mode: LayoutMode) => {
    actions.setMode(mode);
  };

  const handleLibraryChange = (library: LibraryType) => {
    actions.setLibraryPreference(library);
  };

  const handleStart = () => {
    if (onServerStart) {
      onServerStart();
    } else {
      // Default behavior: update status to booting, then running
      actions.updateServerStatus("booting");
      setTimeout(() => {
        actions.updateServerStatus("running");
      }, 1000);
    }
  };

  const handleStop = () => {
    if (onServerStop) {
      onServerStop();
    } else {
      // Default behavior: update status to stopped
      actions.updateServerStatus("stopped");
    }
  };

  const handleRestart = () => {
    if (onServerRestart) {
      onServerRestart();
    } else {
      // Default behavior: stop then start
      actions.updateServerStatus("booting");
      setTimeout(() => {
        actions.updateServerStatus("running");
      }, 1000);
    }
  };

  const handleDeploy = () => {
    if (onDeploy) {
      onDeploy();
    } else {
      // Default behavior: show alert (deployment not implemented yet)
      alert("Deployment feature coming soon!");
    }
  };

  return (
    <header className="flex items-center justify-between border-b bg-background px-4 py-2">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">AI Builder IDE</h1>
        <ModeToggle mode={state.mode} onModeChange={handleModeChange} />
      </div>

      <div className="flex items-center gap-4">
        <ServerControls
          status={state.serverStatus}
          onStart={handleStart}
          onStop={handleStop}
          onRestart={handleRestart}
        />
        <LibrarySettings
          currentLibrary={state.libraryPreference}
          onLibraryChange={handleLibraryChange}
        />
        <DeployButton onDeploy={handleDeploy} />
      </div>
    </header>
  );
}
