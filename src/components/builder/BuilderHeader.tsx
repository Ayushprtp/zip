"use client";

import { useSidebar } from "ui/sidebar";
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
  AlertTriangle,
  SquareTerminal,
  Globe,
  Wifi,
} from "lucide-react";
import { Button } from "ui/button";
import { TextShimmer } from "ui/text-shimmer";
import { Badge } from "ui/badge";
import { useRemoteDevStore } from "@/stores/remote-dev-store";

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
  isExporting,
  onProjectNameClick,
  fileCount = 0,
  isSynced = true,
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
}: BuilderHeaderProps) {
  const { toggleSidebar, open } = useSidebar();
  const remoteConnected = useRemoteDevStore(
    (s) => s.connectionStatus === "connected",
  );
  const executionContext = useRemoteDevStore((s) => s.executionContext);
  const activeConnection = useRemoteDevStore((s) => s.activeConnection);

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

      {/* Project Name */}

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

      {/* Mobile/Desktop Toggle */}

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

      {/* QR Code */}

      <Button
        size="icon"
        variant="ghost"
        onClick={onShowQR}
        className="h-7 w-7 shrink-0"
      >
        <QrCode className="h-3 w-3" />
      </Button>

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
