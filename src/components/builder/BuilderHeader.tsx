"use client";

import { useSidebar } from "ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import {
  ChevronDown,
  MessageCircleDashed,
  PanelLeft,
  Download,
  Smartphone,
  Monitor,
  Rocket,
  QrCode,
  History,
} from "lucide-react";
import { Button } from "ui/button";
import { Separator } from "ui/separator";
import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { getShortcutKeyList, Shortcuts } from "lib/keyboard-shortcuts";
import { useTranslations } from "next-intl";
import { TextShimmer } from "ui/text-shimmer";

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
}: BuilderHeaderProps) {
  const t = useTranslations();
  const [appStoreMutate] = appStore(useShallow((state) => [state.mutate]));
  const { toggleSidebar, open } = useSidebar();

  return (
    <header className="sticky top-0 z-50 flex items-center px-3 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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

      {/* Project Name Dropdown */}
      <div className="items-center gap-1 hidden md:flex">
        <div className="w-1 h-4">
          <Separator orientation="vertical" />
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="hover:text-foreground cursor-pointer flex gap-1 items-center px-2 py-1 rounded-md hover:bg-accent"
              onClick={onProjectNameClick}
            >
              {isGeneratingTitle ? (
                <TextShimmer className="truncate max-w-60 min-w-0 mr-1">
                  {projectName}
                </TextShimmer>
              ) : (
                <p className="truncate max-w-60 min-w-0 mr-1">{projectName}</p>
              )}
              <ChevronDown size={14} />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="max-w-[200px] p-4 break-all overflow-y-auto max-h-[200px]">
            {projectName}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-1" />

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {/* QR Code */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={onShowQR}
              className="h-8 w-8"
            >
              <QrCode className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>QR Code</TooltipContent>
        </Tooltip>

        {/* Mobile/Desktop Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={mobilePreview ? "secondary" : "ghost"}
              onClick={onToggleMobilePreview}
              className="h-8 w-8"
            >
              {mobilePreview ? (
                <Smartphone className="h-4 w-4" />
              ) : (
                <Monitor className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {mobilePreview ? "Desktop View" : "Mobile View"}
          </TooltipContent>
        </Tooltip>

        {/* Create Checkpoint */}
        {onCreateCheckpoint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={onCreateCheckpoint}
                className="h-8 w-8"
              >
                <History className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save Checkpoint</TooltipContent>
          </Tooltip>
        )}

        {/* Download Zip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              onClick={onDownloadZip}
              className="h-8"
            >
              <Download className="h-4 w-4 mr-1" />
              <span className="hidden md:inline">Zip</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download Project</TooltipContent>
        </Tooltip>

        {/* Deploy */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="default"
              onClick={onDeploy}
              disabled={deploying}
              className="h-8"
            >
              <Rocket className="h-4 w-4 mr-1" />
              <span className="hidden md:inline">
                {deploying ? "..." : "Deploy"}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Deploy to Netlify</TooltipContent>
        </Tooltip>

        {/* Temporary Chat */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="secondary"
              className="bg-secondary/40 h-8 w-8"
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
    </header>
  );
}
