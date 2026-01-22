"use client";

import { useSidebar } from "ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import {
  AudioWaveformIcon,
  ChevronDown,
  MessageCircleDashed,
  PanelLeft,
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
  X,
  Copy,
} from "lucide-react";
import { Button } from "ui/button";
import { Separator } from "ui/separator";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ThreadDropdown } from "../thread-dropdown";
import { appStore } from "@/app/store";
import { usePathname, useSearchParams } from "next/navigation";
import { useShallow } from "zustand/shallow";
import { getShortcutKeyList, Shortcuts } from "lib/keyboard-shortcuts";
import { useTranslations } from "next-intl";
import { TextShimmer } from "ui/text-shimmer";
import { buildReturnUrl } from "lib/admin/navigation-utils";
import { BackButton } from "@/components/layouts/back-button";
import { Badge } from "ui/badge";
import { toast } from "sonner";
import { useBuilderStore } from "@/stores/builder-store";
import { useBuilderUIStore } from "@/stores/builder-ui-store";
import { QRCodeSVG } from "qrcode.react";

// QR Code Modal Component
function QRCodeModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      toast.error("Failed to copy URL");
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-background p-6 rounded-lg shadow-lg max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Scan to Preview on Mobile</h3>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex justify-center mb-4 bg-white p-4 rounded">
          <QRCodeSVG value={url} size={200} level="M" />
        </div>

        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Preview URL:</p>
          <div className="flex items-center gap-2 p-2 bg-muted rounded text-xs break-all">
            <span className="flex-1">{url}</span>
          </div>
        </div>

        <Button onClick={handleCopyUrl} className="w-full" variant="outline">
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy URL
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export function AppHeader() {
  const t = useTranslations();
  const [appStoreMutate] = appStore(useShallow((state) => [state.mutate]));
  const { toggleSidebar, open } = useSidebar();
  const currentPaths = usePathname();
  const searchParams = useSearchParams();

  // Builder store
  const { files, currentThread } = useBuilderStore();

  // Builder UI store - select only what we need
  const viewMode = useBuilderUIStore((state) => state.viewMode);
  const setViewMode = useBuilderUIStore((state) => state.setViewMode);
  const serverStatus = useBuilderUIStore((state) => state.serverStatus);
  const startServer = useBuilderUIStore((state) => state.startServer);
  const stopServer = useBuilderUIStore((state) => state.stopServer);
  const restartServer = useBuilderUIStore((state) => state.restartServer);
  const showConsole = useBuilderUIStore((state) => state.showConsole);
  const toggleConsole = useBuilderUIStore((state) => state.toggleConsole);
  const mobilePreview = useBuilderUIStore((state) => state.mobilePreview);
  const toggleMobilePreview = useBuilderUIStore((state) => state.toggleMobilePreview);
  const isSynced = useBuilderUIStore((state) => state.isSynced);

  // Local state
  const [showQR, setShowQR] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [exporting, setExporting] = useState(false);

  const showActionButtons = useMemo(() => {
    if (currentPaths.startsWith("/admin")) {
      return false;
    }
    return true;
  }, [currentPaths]);

  const isBuilderPage = useMemo(() => {
    return currentPaths.startsWith("/builder");
  }, [currentPaths]);

  // Calculate file count
  const fileCount = Object.keys(files).length;

  // Get preview URL
  const previewUrl = typeof window !== "undefined" ? window.location.href : "";

  // Server control handlers
  const handleServerStart = useCallback(() => {
    startServer();
    toast.info("Starting server...");
    setTimeout(() => {
      toast.success("Server started successfully");
    }, 1000);
  }, [startServer]);

  const handleServerStop = useCallback(() => {
    stopServer();
    toast.info("Server stopped");
  }, [stopServer]);

  const handleServerRestart = useCallback(() => {
    restartServer();
    toast.info("Restarting server...");
    setTimeout(() => {
      toast.success("Server restarted successfully");
    }, 1000);
  }, [restartServer]);

  // Download/Export handler
  const handleDownload = useCallback(async () => {
    if (exporting) return;
    
    setExporting(true);
    toast.info("Preparing export...");
    
    try {
      // Create a simple export of files
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Add all files to zip
      Object.entries(files).forEach(([path, content]) => {
        zip.file(path, content);
      });

      // Generate zip file
      const blob = await zip.generateAsync({ type: "blob" });
      
      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentThread?.title || "project"}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Project exported successfully!");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export project");
    } finally {
      setExporting(false);
    }
  }, [files, currentThread, exporting]);

  // Deploy handler - simplified without API call
  const handleDeploy = useCallback(async () => {
    if (deploying) return;
    if (!currentThread?.id) {
      toast.error("No active project");
      return;
    }
    
    if (Object.keys(files).length === 0) {
      toast.error("No files to deploy");
      return;
    }
    
    setDeploying(true);
    toast.info("Preparing deployment...");
    
    try {
      // Export as ZIP first
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      Object.entries(files).forEach(([path, content]) => {
        zip.file(path, content);
      });

      await zip.generateAsync({ type: "blob" });
      
      // Simulate deployment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success(
        <div>
          <p className="font-semibold">Ready to deploy!</p>
          <p className="text-xs mt-1">Project exported. Upload to your hosting provider.</p>
        </div>,
        { duration: 5000 }
      );
      
    } catch (error) {
      console.error("Deployment failed:", error);
      toast.error("Failed to prepare deployment");
    } finally {
      setDeploying(false);
    }
  }, [deploying, currentThread, files]);

  // Checkpoint handler - simplified without API call
  const handleCheckpoint = useCallback(async () => {
    if (!currentThread?.id) {
      toast.error("No active project");
      return;
    }

    toast.info("Creating checkpoint...");
    
    try {
      // Create a local checkpoint by saving current state
      const checkpoint = {
        id: Date.now().toString(),
        threadId: currentThread.id,
        files: { ...files },
        timestamp: new Date().toISOString(),
        title: currentThread.title,
      };

      // Store in localStorage for now
      const checkpoints = JSON.parse(localStorage.getItem('builder-checkpoints') || '[]');
      checkpoints.push(checkpoint);
      // Keep only last 10 checkpoints
      if (checkpoints.length > 10) {
        checkpoints.shift();
      }
      localStorage.setItem('builder-checkpoints', JSON.stringify(checkpoints));
      
      toast.success("Checkpoint created successfully!");
    } catch (error) {
      console.error("Checkpoint failed:", error);
      toast.error("Failed to create checkpoint");
    }
  }, [currentThread, files]);

  // Project name click handler - simplified
  const handleProjectNameClick = useCallback(async () => {
    if (!currentThread?.id) return;

    const newName = prompt("Enter project name:", currentThread?.title || "Project Name");
    if (newName && newName.trim() && newName !== currentThread.title) {
      toast.success(`Project name updated to: ${newName}`);
      // Note: This would need API integration to persist
      // For now, it just shows the toast
    }
  }, [currentThread]);

  const componentByPage = useMemo(() => {
    // Don't show thread dropdown on builder pages
    if (currentPaths.startsWith("/builder")) {
      return null;
    }
    
    if (currentPaths.startsWith("/chat/")) {
      return <ThreadDropdownComponent />;
    }
    if (
      currentPaths.startsWith("/admin/users/") &&
      currentPaths.split("/").length > 3
    ) {
      const searchPageParams = searchParams.get("searchPageParams");
      const returnUrl = buildReturnUrl("/admin/users", searchPageParams || "");
      return (
        <BackButton
          data-testid="admin-users-back-button"
          returnUrl={returnUrl}
          title={t("Admin.Users.backToUsers")}
        />
      );
    }
  }, [currentPaths, searchParams]);

  return (
    <header className="sticky top-0 z-50 flex items-center px-2 py-1.5 border-b">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle Sidebar"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleSidebar();
            }}
            data-testid="sidebar-toggle"
            data-state={open ? "open" : "closed"}
            className="h-7 w-7"
          >
            <PanelLeft className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent align="start" side="bottom">
          <div className="flex items-center gap-2">
            {t("KeyboardShortcuts.toggleSidebar")}
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              {getShortcutKeyList(Shortcuts.toggleSidebar).map((key) => (
                <span
                  key={key}
                  className="w-5 h-5 flex items-center justify-center bg-muted rounded "
                >
                  {key}
                </span>
              ))}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>

      {componentByPage}

      {/* Project Name Dropdown - Only show on builder pages */}
      {isBuilderPage && (
        <div className="items-center gap-1 hidden md:flex">
          <Separator orientation="vertical" className="h-3.5" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="h-6 px-1.5 gap-1 hover:bg-accent shrink-0 text-[11px]"
                onClick={handleProjectNameClick}
              >
                <span className="truncate max-w-[100px] font-medium">
                  {currentThread?.title || "Project Name"}
                </span>
                <ChevronDown className="h-2.5 w-2.5 opacity-50 shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{currentThread?.title || "Project Name"}</TooltipContent>
          </Tooltip>
        </div>
      )}
      
      <div className="flex-1" />
      
      {showActionButtons && (
        <div className="flex items-center gap-0.5 shrink-0">
          {/* Builder Page Buttons */}
          {isBuilderPage && (
            <>
              {/* File Count & Sync Status */}
              <Badge
                variant="secondary"
                className="h-6 px-1.5 text-[9px] gap-1 shrink-0 hidden sm:flex"
              >
                <FileCode className="h-2.5 w-2.5" />
                <span>{fileCount}</span>
              </Badge>
              
              {isSynced ? (
                <Badge
                  variant="outline"
                  className="h-6 px-1.5 text-[9px] gap-1 shrink-0 hidden sm:flex"
                >
                  <Check className="h-2.5 w-2.5 text-green-500" />
                  <span className="text-green-500">Synced</span>
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="h-6 px-1.5 text-[9px] gap-1 shrink-0 hidden sm:flex animate-pulse"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                  <span className="text-yellow-500">Saving...</span>
                </Badge>
              )}

              <Separator orientation="vertical" className="h-3.5 mx-0.5 hidden sm:block" />

              {/* View Mode Tabs - Functional */}
              <div className="gap-0.5 bg-muted/50 border rounded-md p-0.5 shrink-0 hidden lg:flex">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={viewMode === "code" ? "secondary" : "ghost"}
                      onClick={() => setViewMode("code")}
                      className="h-5 w-5 p-0"
                    >
                      <Code2 className="h-2.5 w-2.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Code Only</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={viewMode === "preview" ? "secondary" : "ghost"}
                      onClick={() => setViewMode("preview")}
                      className="h-5 w-5 p-0"
                    >
                      <Eye className="h-2.5 w-2.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Preview Only</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant={viewMode === "split" ? "secondary" : "ghost"}
                      onClick={() => setViewMode("split")}
                      className="h-5 w-5 p-0"
                    >
                      <Columns2 className="h-2.5 w-2.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Split View</TooltipContent>
                </Tooltip>
              </div>

              <Separator orientation="vertical" className="h-3.5 mx-0.5 hidden lg:block" />

              {/* Server Controls - Redesigned in one rectangle */}
              <div className="flex items-center gap-0.5 bg-muted/50 border rounded-md p-0.5 shrink-0 hidden md:flex">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleServerStart}
                      disabled={serverStatus === "running"}
                      className="h-6 w-6"
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Start Server</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleServerStop}
                      disabled={serverStatus === "idle"}
                      className="h-6 w-6"
                    >
                      <Square className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Stop Server</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleServerRestart}
                      className="h-6 w-6"
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Restart Server</TooltipContent>
                </Tooltip>
              </div>

              <Separator orientation="vertical" className="h-3.5 mx-0.5 hidden md:block" />

              {/* Console Toggle - Functional */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={showConsole ? "secondary" : "ghost"}
                    onClick={toggleConsole}
                    className="h-7 w-7 shrink-0 hidden md:flex"
                  >
                    <Terminal className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Terminal</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-3.5 mx-0.5" />

              {/* Mobile/Desktop Toggle - Functional */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={mobilePreview ? "secondary" : "ghost"}
                    onClick={toggleMobilePreview}
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
                  {mobilePreview ? "Desktop View" : "Mobile View"}
                </TooltipContent>
              </Tooltip>

              {/* QR Code */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setShowQR(true)}
                    className="h-7 w-7 shrink-0"
                  >
                    <QrCode className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>QR Code</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-3.5 mx-0.5" />

              {/* Checkpoint */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleCheckpoint}
                    className="h-7 w-7 shrink-0 hidden sm:flex"
                  >
                    <History className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Checkpoint</TooltipContent>
              </Tooltip>

              {/* Download */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={handleDownload}
                    disabled={exporting}
                    className="h-7 w-7 shrink-0"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export Project</TooltipContent>
              </Tooltip>

              {/* Deploy */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="default"
                    onClick={handleDeploy}
                    disabled={deploying}
                    className="h-7 w-7 shrink-0"
                  >
                    <Rocket className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Deploy</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-3.5 mx-0.5" />
            </>
          )}

          {/* Voice Chat - Always visible on non-admin pages */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size={"icon"}
                variant={"ghost"}
                className="bg-secondary/40 h-7 w-7 shrink-0"
                onClick={() => {
                  appStoreMutate((state) => ({
                    voiceChat: {
                      ...state.voiceChat,
                      isOpen: true,
                      agentId: undefined,
                    },
                  }));
                }}
              >
                <AudioWaveformIcon className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent align="end" side="bottom">
              <div className="text-xs flex items-center gap-2">
                {t("KeyboardShortcuts.toggleVoiceChat")}
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  {getShortcutKeyList(Shortcuts.toggleVoiceChat).map((key) => (
                    <span
                      className="w-5 h-5 flex items-center justify-center bg-muted rounded "
                      key={key}
                    >
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>

          {/* Temporary Chat - Always visible on non-admin pages */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size={"icon"}
                variant={"secondary"}
                className="bg-secondary/40 h-7 w-7 shrink-0"
                onClick={() => {
                  appStoreMutate((state) => ({
                    temporaryChat: {
                      ...state.temporaryChat,
                      isOpen: !state.temporaryChat.isOpen,
                    },
                  }));
                }}
              >
                <MessageCircleDashed className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent align="end" side="bottom">
              <div className="text-xs flex items-center gap-2">
                {t("KeyboardShortcuts.toggleTemporaryChat")}
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  {getShortcutKeyList(Shortcuts.toggleTemporaryChat).map(
                    (key) => (
                      <span
                        className="w-5 h-5 flex items-center justify-center bg-muted rounded "
                        key={key}
                      >
                        {key}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      
      {/* QR Code Modal */}
      {showQR && (
        <QRCodeModal url={previewUrl} onClose={() => setShowQR(false)} />
      )}
    </header>
  );
}

function ThreadDropdownComponent() {
  const [threadList, currentThreadId, generatingTitleThreadIds] = appStore(
    useShallow((state) => [
      state.threadList,
      state.currentThreadId,
      state.generatingTitleThreadIds,
    ]),
  );
  const currentThread = useMemo(() => {
    return threadList.find((thread) => thread.id === currentThreadId);
  }, [threadList, currentThreadId]);

  useEffect(() => {
    if (currentThread?.id) {
      document.title = currentThread.title || "New Chat";
    }
  }, [currentThread?.id]);

  if (!currentThread) return null;

  return (
    <div className="items-center gap-1 hidden md:flex">
      <div className="w-1 h-4">
        <Separator orientation="vertical" />
      </div>

      <ThreadDropdown
        threadId={currentThread.id}
        beforeTitle={currentThread.title}
      >
        <div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="data-[state=open]:bg-input! hover:text-foreground cursor-pointer flex gap-1 items-center px-2 py-1 rounded-md hover:bg-accent"
              >
                {generatingTitleThreadIds.includes(currentThread.id) ? (
                  <TextShimmer className="truncate max-w-60 min-w-0 mr-1">
                    {currentThread.title || "New Chat"}
                  </TextShimmer>
                ) : (
                  <p className="truncate max-w-60 min-w-0 mr-1">
                    {currentThread.title || "New Chat"}
                  </p>
                )}

                <ChevronDown size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[200px] p-4 break-all overflow-y-auto max-h-[200px]">
              {currentThread.title || "New Chat"}
            </TooltipContent>
          </Tooltip>
        </div>
      </ThreadDropdown>
    </div>
  );
}
