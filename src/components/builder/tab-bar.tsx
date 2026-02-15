/**
 * TabBar - Multi-file tab system for editor
 * Displays open files as tabs with switching and closing capabilities
 */

"use client";

import { useProject } from "@/lib/builder/project-context";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "ui/context-menu";
import { File, X } from "lucide-react";
import React, { useCallback, useState, useEffect } from "react";

// ============================================================================
// Types
// ============================================================================

interface Tab {
  path: string;
  name: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extracts filename from path
 */
function getFileName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

// ============================================================================
// Tab Component
// ============================================================================

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onCloseOthers: (path: string) => void;
  onCloseAll: () => void;
}

function TabItem({
  tab,
  isActive,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseAll,
}: TabItemProps) {
  const handleClick = useCallback(() => {
    onSelect(tab.path);
  }, [tab.path, onSelect]);

  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClose(tab.path);
    },
    [tab.path, onClose],
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            "flex items-center gap-2 px-3 py-2 border-r border-border cursor-pointer transition-all group relative min-w-[120px] max-w-[200px] text-sm select-none",
            "hover:bg-accent/50",
            isActive
              ? "bg-background text-foreground border-t-2 border-t-blue-500 font-medium shadow-sm"
              : "bg-muted/40 text-muted-foreground border-t-2 border-t-transparent hover:text-foreground",
          )}
          onClick={handleClick}
          onAuxClick={(e) => {
            // Chrome handles middle click separately
            if (e.button === 1) {
              e.preventDefault();
              handleClose(e);
            }
          }}
        >
          <File className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="text-sm truncate max-w-[150px]" title={tab.path}>
            {tab.name}
          </span>
          <button
            className={cn(
              "flex-shrink-0 rounded-sm hover:bg-accent-foreground/10 p-0.5 transition-opacity",
              "opacity-0 group-hover:opacity-100",
              isActive && "opacity-100",
            )}
            onClick={handleClose}
            aria-label={`Close ${tab.name}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onClose(tab.path);
          }}
        >
          Close
          <ContextMenuShortcut>Ctrl+W</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onCloseOthers(tab.path);
          }}
        >
          Close Others
        </ContextMenuItem>
        <ContextMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onCloseAll();
          }}
        >
          Close All
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => {
            navigator.clipboard.writeText(tab.path);
          }}
        >
          Copy Path
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ============================================================================
// TabBar Component
// ============================================================================

interface TabBarProps {
  /** Optional className for styling */
  className?: string;
}

export function TabBar({ className }: TabBarProps) {
  const { state, actions } = useProject();
  const { files, activeFile } = state;

  // Track open tabs (files that have been opened)
  const [openTabs, setOpenTabs] = useState<string[]>([]);

  // When activeFile changes, add it to open tabs if not already there
  useEffect(() => {
    if (activeFile && !openTabs.includes(activeFile)) {
      setOpenTabs((prev) => [...prev, activeFile]);
    }
  }, [activeFile, openTabs]);

  // Remove tabs for deleted files
  useEffect(() => {
    setOpenTabs((prev) => prev.filter((path) => path in files));
  }, [files]);

  // Handle tab selection
  const handleSelectTab = useCallback(
    (path: string) => {
      actions.setActiveFile(path);
    },
    [actions],
  );

  // Handle tab close
  const handleCloseTab = useCallback(
    (path: string) => {
      setOpenTabs((prev) => {
        const newTabs = prev.filter((p) => p !== path);

        // If closing the active tab, switch to another tab
        if (path === activeFile) {
          const currentIndex = prev.indexOf(path);
          if (newTabs.length > 0) {
            // Switch to the tab to the right, or left if at the end
            const nextIndex =
              currentIndex < newTabs.length ? currentIndex : currentIndex - 1;
            actions.setActiveFile(newTabs[nextIndex]);
          } else {
            // No more tabs, clear active file
            actions.setActiveFile("");
          }
        }

        return newTabs;
      });
    },
    [activeFile, actions],
  );

  const handleCloseOthers = useCallback(
    (path: string) => {
      setOpenTabs([path]);
      if (activeFile !== path) {
        actions.setActiveFile(path);
      }
    },
    [activeFile, actions],
  );

  const handleCloseAll = useCallback(() => {
    setOpenTabs([]);
    actions.setActiveFile("");
  }, [actions]);

  // Convert paths to tab objects
  const tabs: Tab[] = openTabs.map((path) => ({
    path,
    name: getFileName(path),
  }));

  // Don't render if no tabs
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center bg-muted border-b border-border overflow-x-auto",
        className,
      )}
    >
      {tabs.map((tab) => (
        <TabItem
          key={tab.path}
          tab={tab}
          isActive={tab.path === activeFile}
          onSelect={handleSelectTab}
          onClose={handleCloseTab}
          onCloseOthers={handleCloseOthers}
          onCloseAll={handleCloseAll}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Hook for managing tabs programmatically
// ============================================================================

/**
 * Hook for managing open tabs
 */
export function useTabManager() {
  const { state, actions } = useProject();
  const { activeFile } = state;

  const openTab = useCallback(
    (path: string) => {
      actions.setActiveFile(path);
    },
    [actions],
  );

  const closeTab = useCallback(
    (path: string) => {
      // This will be handled by the TabBar component's internal state
      // For now, just clear active file if it matches
      if (path === activeFile) {
        actions.setActiveFile("");
      }
    },
    [activeFile, actions],
  );

  const closeAllTabs = useCallback(() => {
    actions.setActiveFile("");
  }, [actions]);

  return {
    openTab,
    closeTab,
    closeAllTabs,
    activeTab: activeFile,
  };
}

// Export utility for testing
export { getFileName };
