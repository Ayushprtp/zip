"use client";

import { useSidebar } from "ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import {
  ChevronDown,
  PanelLeftOpen,
  PanelLeftClose,
  Download,
  Smartphone,
  Monitor,
  Rocket,
  QrCode,
  History,
  Play,
  Square,
  RotateCcw,
  Check,
  FileCode,
  Terminal,
  Code2,
  Eye,
  Columns2,
} from "lucide-react";
import { Button } from "ui/button";
import { TextShimmer } from "ui/text-shimmer";
import { Badge } from "ui/badge";

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
  onProjectNameClick?: () => void;
  fileCount?: number;
  isSynced?: boolean;
  onServerStart?: () => void;
  onServerStop?: () => void;
  onServerRestart?: () => void;
  serverStatus?: "idle" | "running" | "booting";
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
  showConsole?: boolean;
  onToggleConsole?: () => void;
}

export function BuilderHeader({
  projectName,
  isGeneratingTitle = false,
  onDownloadZip,
  onDeploy,
  onShowQR,
  onToggleMobilePreview,
  onCreateCheckpoint,
  mobilePreview,
  deploying,
  onProjectNameClick,
  fileCount = 0,
  isSynced = true,
  onServerStart,
  onServerStop,
  onServerRestart,
  serverStatus = "running",
  viewMode,
  onViewModeChange,
  showConsole,
  onToggleConsole,
}: BuilderHeaderProps) {
  const { toggleSidebar, open } = useSidebar();

  return (
    <header className="sticky top-0 z-50 flex items-center gap-1 px-2 py-1.5 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 overflow-x-auto">
      {/* Sidebar Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
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
        </TooltipTrigger>
        <TooltipContent align="start" side="bottom">
          {open ? "Hide" : "Show"} Sidebar
        </TooltipContent>
      </Tooltip>

      <div className="h-4 w-px bg-border shrink-0" />

      {/* Project Name */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className="h-7 px-1.5 gap-1 hover:bg-accent shrink-0 min-w-0"
            onClick={onProjectNameClick}
          >
            {isGeneratingTitle ? (
              <TextShimmer className="truncate max-w-[80px] text-xs font-medium">
                {projectName}
              </TextShimmer>
            ) : (
              <span className="truncate max-w-[80px] text-xs font-medium">
                {projectName}
              </span>
            )}
            <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{projectName}</TooltipContent>
      </Tooltip>

      {/* File Count */}
      <Badge
        variant="secondary"
        className="h-6 px-1.5 text-[10px] gap-0.5 shrink-0"
      >
        <FileCode className="h-2.5 w-2.5" />
        {fileCount}
      </Badge>

      {/* Sync Status */}
      {isSynced && (
        <Badge
          variant="outline"
          className="h-6 px-1.5 text-[10px] gap-0.5 shrink-0"
        >
          <Check className="h-2.5 w-2.5 text-green-500" />
        </Badge>
      )}

      {/* View Mode Tabs */}
      {viewMode !== undefined && onViewModeChange && (
        <>
          <div className="h-4 w-px bg-border shrink-0" />
          <div className="flex gap-0.5 bg-muted/50 border rounded-md p-0.5 shrink-0">
            <Button
              size="sm"
              variant={viewMode === "code" ? "secondary" : "ghost"}
              onClick={() => onViewModeChange("code")}
              className="h-6 px-1.5 text-[10px]"
            >
              <Code2 className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === "preview" ? "secondary" : "ghost"}
              onClick={() => onViewModeChange("preview")}
              className="h-6 px-1.5 text-[10px]"
            >
              <Eye className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === "split" ? "secondary" : "ghost"}
              onClick={() => onViewModeChange("split")}
              className="h-6 px-1.5 text-[10px]"
            >
              <Columns2 className="h-3 w-3" />
            </Button>
          </div>
        </>
      )}

      <div className="flex-1 min-w-2 shrink" />

      {/* Server Controls */}
      {(onServerStart || onServerStop || onServerRestart) && (
        <>
          <div className="h-4 w-px bg-border shrink-0" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={onServerStart}
                disabled={serverStatus === "running"}
                className="h-7 w-7 shrink-0"
              >
                <Play className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Start</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={onServerStop}
                disabled={serverStatus === "idle"}
                className="h-7 w-7 shrink-0"
              >
                <Square className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Stop</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={onServerRestart}
                className="h-7 w-7 shrink-0"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Restart</TooltipContent>
          </Tooltip>
        </>
      )}

      {/* Console Toggle */}
      {onToggleConsole !== undefined && (
        <>
          <div className="h-4 w-px bg-border shrink-0" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={showConsole ? "secondary" : "ghost"}
                onClick={onToggleConsole}
                className="h-7 w-7 shrink-0"
              >
                <Terminal className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Terminal</TooltipContent>
          </Tooltip>
        </>
      )}

      <div className="h-4 w-px bg-border shrink-0" />

      {/* Mobile/Desktop Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant={mobilePreview ? "secondary" : "ghost"}
            onClick={onToggleMobilePreview}
            className="h-7 w-7 shrink-0"
          >
            {mobilePreview ? (
              <Smartphone className="h-3 w-3" />
            ) : (
              <Monitor className="h-3 w-3" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {mobilePreview ? "Desktop" : "Mobile"}
        </TooltipContent>
      </Tooltip>

      {/* QR Code */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            onClick={onShowQR}
            className="h-7 w-7 shrink-0"
          >
            <QrCode className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>QR Code</TooltipContent>
      </Tooltip>

      <div className="h-4 w-px bg-border shrink-0" />

      {/* Checkpoint */}
      {onCreateCheckpoint && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={onCreateCheckpoint}
              className="h-7 w-7 shrink-0"
            >
              <History className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Checkpoint</TooltipContent>
        </Tooltip>
      )}

      {/* Download */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            onClick={onDownloadZip}
            className="h-7 w-7 shrink-0"
          >
            <Download className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export</TooltipContent>
      </Tooltip>

      {/* Deploy */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="default"
            onClick={onDeploy}
            disabled={deploying}
            className="h-7 w-7 shrink-0"
          >
            <Rocket className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Deploy</TooltipContent>
      </Tooltip>
    </header>
  );
}
