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
}: BuilderHeaderProps) {
  const { toggleSidebar, open } = useSidebar();

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-2 px-2 py-1.5 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 overflow-x-auto">
      {/* Left Section: Sidebar Toggle + Project Info */}
      <div className="flex items-center gap-1.5 min-w-0 shrink-0">
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

        <div className="h-4 w-px bg-border" />

        {/* Project Name */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="h-7 px-1.5 gap-1 hover:bg-accent shrink-0"
              onClick={onProjectNameClick}
            >
              {isGeneratingTitle ? (
                <TextShimmer className="truncate max-w-[100px] text-xs font-medium">
                  {projectName}
                </TextShimmer>
              ) : (
                <span className="truncate max-w-[100px] text-xs font-medium">
                  {projectName}
                </span>
              )}
              <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{projectName}</TooltipContent>
        </Tooltip>

        {/* File Count & Sync Status */}
        <Badge
          variant="secondary"
          className="h-6 px-1.5 text-[10px] gap-1 shrink-0"
        >
          <FileCode className="h-2.5 w-2.5" />
          {fileCount}
        </Badge>
        {isSynced && (
          <Badge
            variant="outline"
            className="h-6 px-1.5 text-[10px] gap-1 shrink-0"
          >
            <Check className="h-2.5 w-2.5 text-green-500" />
            Synced
          </Badge>
        )}
      </div>

      {/* Right Section: All Action Buttons in Single Row */}
      <div className="flex items-center gap-0.5 shrink-0 ml-auto">
        {/* Server Controls */}
        {(onServerStart || onServerStop || onServerRestart) && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onServerStart}
                  disabled={serverStatus === "running"}
                  className="h-7 w-7"
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
                  className="h-7 w-7"
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
                  className="h-7 w-7"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Restart</TooltipContent>
            </Tooltip>

            <div className="h-4 w-px bg-border mx-0.5" />
          </>
        )}

        {/* Preview Controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={mobilePreview ? "secondary" : "ghost"}
              onClick={onToggleMobilePreview}
              className="h-7 w-7"
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

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={onShowQR}
              className="h-7 w-7"
            >
              <QrCode className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>QR Code</TooltipContent>
        </Tooltip>

        <div className="h-4 w-px bg-border mx-0.5" />

        {/* Project Actions */}
        {onCreateCheckpoint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={onCreateCheckpoint}
                className="h-7 w-7"
              >
                <History className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Checkpoint</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              onClick={onDownloadZip}
              className="h-7 w-7"
            >
              <Download className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="default"
              onClick={onDeploy}
              disabled={deploying}
              className="h-7 w-7"
            >
              <Rocket className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Deploy</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
