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
} from "lucide-react";
import { Button } from "ui/button";
import { Separator } from "ui/separator";

import { useEffect, useMemo } from "react";
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

export function AppHeader() {
  const t = useTranslations();
  const [appStoreMutate] = appStore(useShallow((state) => [state.mutate]));
  const { toggleSidebar, open } = useSidebar();
  const currentPaths = usePathname();
  const searchParams = useSearchParams();

  const showActionButtons = useMemo(() => {
    if (currentPaths.startsWith("/admin")) {
      return false;
    }
    return true;
  }, [currentPaths]);

  const isBuilderPage = useMemo(() => {
    return currentPaths.startsWith("/builder");
  }, [currentPaths]);

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
    <header className="sticky top-0 z-50 flex items-center px-3 py-2">
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
          >
            <PanelLeft />
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
          <Separator orientation="vertical" className="h-4" />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 px-2 gap-1 hover:bg-accent shrink-0"
              >
                <span className="truncate max-w-[120px] text-xs font-medium">
                  Project Name
                </span>
                <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Project Name</TooltipContent>
          </Tooltip>
        </div>
      )}
      
      <div className="flex-1" />
      
      {showActionButtons && (
        <div className="flex items-center gap-1 shrink-0">
          {/* Builder Page Buttons */}
          {isBuilderPage && (
            <>
              {/* File Count & Sync Status */}
              <Badge
                variant="secondary"
                className="h-7 px-2 text-[10px] gap-1 shrink-0 hidden sm:flex"
              >
                <FileCode className="h-3 w-3" />
                <span>0</span>
              </Badge>
              
              <Badge
                variant="outline"
                className="h-7 px-2 text-[10px] gap-1 shrink-0 hidden sm:flex"
              >
                <Check className="h-3 w-3 text-green-500" />
              </Badge>

              <Separator orientation="vertical" className="h-4 mx-1 hidden sm:block" />

              {/* View Mode Tabs */}
              <div className="gap-0.5 bg-muted/50 border rounded-md p-0.5 shrink-0 hidden lg:flex">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px]"
                >
                  <Code2 className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-6 px-2 text-[10px]"
                >
                  <Eye className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px]"
                >
                  <Columns2 className="h-3 w-3" />
                </Button>
              </div>

              <Separator orientation="vertical" className="h-4 mx-1 hidden lg:block" />

              {/* Server Controls */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 hidden md:flex"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Start Server</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 hidden md:flex"
                  >
                    <Square className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Stop Server</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 hidden md:flex"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Restart Server</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-4 mx-1 hidden md:block" />

              {/* Console Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 hidden md:flex"
                  >
                    <Terminal className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Terminal</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-4 mx-1" />

              {/* Mobile/Desktop Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Mobile View</TooltipContent>
              </Tooltip>

              {/* QR Code */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>QR Code</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-4 mx-1" />

              {/* Checkpoint */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 hidden sm:flex"
                  >
                    <History className="h-3.5 w-3.5" />
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
                    className="h-8 w-8 shrink-0"
                  >
                    <Download className="h-3.5 w-3.5" />
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
                    className="h-8 w-8 shrink-0"
                  >
                    <Rocket className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Deploy</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-4 mx-1" />
            </>
          )}

          {/* Voice Chat - Always visible on non-admin pages */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size={"icon"}
                variant={"ghost"}
                className="bg-secondary/40 h-8 w-8 shrink-0"
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
                <AudioWaveformIcon className="size-4" />
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
                className="bg-secondary/40 h-8 w-8 shrink-0"
                onClick={() => {
                  appStoreMutate((state) => ({
                    temporaryChat: {
                      ...state.temporaryChat,
                      isOpen: !state.temporaryChat.isOpen,
                    },
                  }));
                }}
              >
                <MessageCircleDashed className="size-4" />
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
