"use client";

import { useSidebar } from "ui/sidebar";
import {
  ChevronDown,
  PanelLeftOpen,
  PanelLeftClose,
  Download,
  Rocket,
  History,
  Play,
  Square,
  RotateCcw,
  Terminal,
  AlertTriangle,
  SquareTerminal,
  Globe,
  Wifi,
  Share2,
  Pencil,
  Code2,
  Eye,
  Columns2,
} from "lucide-react";
import { Button } from "ui/button";
import { TextShimmer } from "ui/text-shimmer";
import { useRemoteDevStore } from "@/stores/remote-dev-store";
import { useState, useRef, useEffect } from "react";

type ViewMode = "code" | "preview" | "split";

interface BuilderHeaderProps {
  projectName: string;
  isGeneratingTitle?: boolean;
  onDownloadZip: () => void;
  onDeploy: () => void;
  onShowQR: () => void;
  onToggleMobilePreview: () => void;
  onCreateCheckpoint?: () => void;
  mobilePreview: boolean;
  deploying: boolean;
  isExporting?: boolean;
  onProjectNameClick?: () => void;
  fileCount?: number;
  isSynced?: boolean;
  onServerStart?: () => void;
  onServerStop?: () => void;
  onServerRestart?: () => void;
  serverStatus?: "idle" | "running" | "booting" | "error";
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  showConsole?: boolean;
  onToggleConsole?: () => void;
  showTerminal?: boolean;
  onToggleTerminal?: () => void;
  showReport?: boolean;
  onToggleReport?: () => void;
  showSSH?: boolean;
  onToggleSSH?: () => void;
  bottomPanel?: "none" | "console" | "terminal" | "report" | "ssh";
  builderMode?: "default";
  onBuilderModeChange?: (mode: "default") => void;
  /** Whether the deployment panel is open */
  showDeployPanel?: boolean;
  /** Toggle the deployment panel open/closed */
  onToggleDeployPanel?: () => void;
  onRenameProject?: (newName: string) => void;
  onShareProject?: () => void;
}

export function BuilderHeader({
  projectName,
  isGeneratingTitle = false,
  onDownloadZip,
  onDeploy,
  onShowQR: _onShowQR,
  onToggleMobilePreview: _onToggleMobilePreview,
  onCreateCheckpoint,
  mobilePreview: _mobilePreview,
  isExporting,
  onProjectNameClick: _onProjectNameClick,
  fileCount: _fileCount = 0,
  isSynced: _isSynced = true,
  onServerStart,
  onServerStop,
  onServerRestart,
  serverStatus = "running",
  viewMode,
  onViewModeChange,
  showConsole: _showConsole,
  onToggleConsole,
  showTerminal: _showTerminal,
  onToggleTerminal,
  showReport: _showReport,
  onToggleReport,
  showSSH: _showSSH,
  onToggleSSH,
  bottomPanel,
  showDeployPanel,
  onToggleDeployPanel,
  onRenameProject,
  onShareProject,
}: BuilderHeaderProps) {
  const { toggleSidebar, open } = useSidebar();
  const remoteConnected = useRemoteDevStore(
    (s) => s.connectionStatus === "connected",
  );
  const executionContext = useRemoteDevStore((s) => s.executionContext);
  const activeConnection = useRemoteDevStore((s) => s.activeConnection);

  // Project dropdown state
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(projectName);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        projectMenuRef.current &&
        !projectMenuRef.current.contains(e.target as Node)
      ) {
        setShowProjectMenu(false);
        setIsRenaming(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus rename input when activated
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = () => {
    if (renameValue.trim() && renameValue !== projectName) {
      onRenameProject?.(renameValue.trim());
    }
    setIsRenaming(false);
    setShowProjectMenu(false);
  };

  return (
    <header className="sticky top-0 z-50 flex items-center gap-1 px-2 py-1.5 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 overflow-x-auto">
      {/* Sidebar Toggle */}
      <Button
        variant="ghost"
        size="icon"
        aria-label={open ? "Hide Sidebar" : "Show Sidebar"}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleSidebar();
        }}
        data-testid="sidebar-toggle"
        data-state={open ? "open" : "closed"}
        className="h-7 w-7 shrink-0"
      >
        {open ? (
          <PanelLeftClose className="h-3.5 w-3.5" />
        ) : (
          <PanelLeftOpen className="h-3.5 w-3.5" />
        )}
      </Button>

      <div className="h-4 w-px bg-border shrink-0" />

      {/* Project Name with Dropdown */}
      <div className="relative" ref={projectMenuRef}>
        <Button
          variant="ghost"
          className="h-7 px-1.5 gap-1 hover:bg-accent shrink-0 min-w-0"
          onClick={() => setShowProjectMenu(!showProjectMenu)}
        >
          {isGeneratingTitle ? (
            <TextShimmer className="truncate max-w-[120px] text-xs font-medium">
              {projectName}
            </TextShimmer>
          ) : (
            <span className="truncate max-w-[120px] text-xs font-medium">
              {projectName}
            </span>
          )}
          <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
        </Button>

        {/* Project Dropdown Menu */}
        {showProjectMenu && (
          <div className="absolute top-full left-0 mt-1 w-56 py-1 bg-popover border border-border rounded-lg shadow-xl z-50 animate-in slide-in-from-top-2 duration-150">
            {isRenaming ? (
              <div className="px-3 py-2">
                <label className="text-[10px] text-muted-foreground uppercase font-medium mb-1 block">
                  Rename Project
                </label>
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameSubmit();
                    if (e.key === "Escape") {
                      setIsRenaming(false);
                      setRenameValue(projectName);
                    }
                  }}
                  className="w-full h-7 px-2 text-xs bg-muted/50 border border-border/50 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500/40"
                />
                <div className="flex gap-1 mt-1.5">
                  <button
                    onClick={handleRenameSubmit}
                    className="flex-1 px-2 py-1 text-[10px] bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsRenaming(false);
                      setRenameValue(projectName);
                    }}
                    className="flex-1 px-2 py-1 text-[10px] bg-muted text-muted-foreground rounded hover:bg-muted/80 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => {
                    setRenameValue(projectName);
                    setIsRenaming(true);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-[11px] hover:bg-muted/60 transition-colors text-foreground"
                >
                  <Pencil className="h-3 w-3" />
                  Rename Project
                </button>
                <button
                  onClick={() => {
                    onShareProject?.();
                    setShowProjectMenu(false);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-[11px] hover:bg-muted/60 transition-colors text-foreground"
                >
                  <Share2 className="h-3 w-3" />
                  Share Project
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* View Mode Toggle */}
      {viewMode && onViewModeChange && (
        <>
          <div className="h-4 w-px bg-border shrink-0 mx-2" />
          <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/50">
            <Button
              variant={viewMode === "code" ? "secondary" : "ghost"}
              size="icon"
              className="h-6 w-6 rounded-md"
              onClick={() => onViewModeChange("code")}
              title="Code View"
            >
              <Code2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "split" ? "secondary" : "ghost"}
              size="icon"
              className="h-6 w-6 rounded-md"
              onClick={() => onViewModeChange("split")}
              title="Split View"
            >
              <Columns2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "preview" ? "secondary" : "ghost"}
              size="icon"
              className="h-6 w-6 rounded-md"
              onClick={() => onViewModeChange("preview")}
              title="Preview View"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}

      <div className="flex-1 min-w-2 shrink" />

      {/* Server Controls — DON'T TOUCH these buttons */}
      {(onServerStart || onServerStop || onServerRestart) && (
        <>
          <div className="h-4 w-px bg-border shrink-0" />

          <Button
            size="icon"
            variant="ghost"
            onClick={onServerStart}
            disabled={serverStatus === "running"}
            className="h-7 w-7 shrink-0"
          >
            <Play className="h-3 w-3" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={onServerStop}
            disabled={serverStatus === "idle"}
            className="h-7 w-7 shrink-0"
          >
            <Square className="h-3 w-3" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={onServerRestart}
            className="h-7 w-7 shrink-0"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </>
      )}

      {/* Console Toggle */}
      {onToggleConsole !== undefined && (
        <>
          <div className="h-4 w-px bg-border shrink-0" />

          <Button
            size="icon"
            variant={bottomPanel === "console" ? "secondary" : "ghost"}
            onClick={onToggleConsole}
            className="h-7 w-7 shrink-0"
            title="Console"
          >
            <Terminal className="h-3 w-3" />
          </Button>
        </>
      )}

      {/* Terminal Toggle */}
      {onToggleTerminal !== undefined && (
        <Button
          size="icon"
          variant={bottomPanel === "terminal" ? "secondary" : "ghost"}
          onClick={onToggleTerminal}
          className="h-7 w-7 shrink-0"
          title="Terminal"
        >
          <SquareTerminal className="h-3 w-3" />
        </Button>
      )}

      {/* Report Toggle */}
      {onToggleReport !== undefined && (
        <Button
          size="icon"
          variant={bottomPanel === "report" ? "secondary" : "ghost"}
          onClick={onToggleReport}
          className="h-7 w-7 shrink-0"
          title="Report & Status"
        >
          <AlertTriangle className="h-3 w-3" />
        </Button>
      )}

      {/* SSH Toggle */}
      {onToggleSSH !== undefined && (
        <Button
          size="icon"
          variant={bottomPanel === "ssh" ? "secondary" : "ghost"}
          onClick={onToggleSSH}
          className="h-7 w-7 shrink-0 relative"
          title={
            remoteConnected
              ? `Remote: ${activeConnection?.name || activeConnection?.host} (${executionContext})`
              : "SSH Remote"
          }
        >
          {remoteConnected ? (
            <Wifi className="h-3 w-3 text-green-500" />
          ) : (
            <Globe className="h-3 w-3" />
          )}
          {remoteConnected && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 border border-background" />
          )}
        </Button>
      )}

      <div className="h-4 w-px bg-border shrink-0" />

      {/* Checkpoint */}
      {onCreateCheckpoint && (
        <Button
          size="icon"
          variant="ghost"
          onClick={onCreateCheckpoint}
          className="h-7 w-7 shrink-0"
        >
          <History className="h-3 w-3" />
        </Button>
      )}

      {/* Download */}

      <Button
        size="icon"
        variant="outline"
        onClick={onDownloadZip}
        disabled={isExporting}
        className="h-7 w-7 shrink-0"
      >
        {isExporting ? (
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        ) : (
          <Download className="h-3 w-3" />
        )}
      </Button>

      {/* Deploy Panel Toggle */}

      <Button
        size="icon"
        variant={showDeployPanel ? "secondary" : "default"}
        onClick={onToggleDeployPanel || onDeploy}
        className="h-7 w-7 shrink-0"
      >
        <Rocket className="h-3 w-3" />
      </Button>
    </header>
  );
}
