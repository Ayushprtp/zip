"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useBuilderStore } from "@/stores/builder-store";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  useSidebar,
} from "ui/sidebar";
import { Code2, MoreHorizontal, Trash2, Edit, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";
import { Skeleton } from "ui/skeleton";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";

const DISPLAY_LIMIT = 5;

export function AppSidebarBuilderThreads({ user }: { user?: { id: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  const { threads, loadThreads, deleteThread } = useBuilderStore();
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  // Load threads on mount only if user is authenticated
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      try {
        await loadThreads();
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [loadThreads, user?.id]);

  // Don't show if user is not authenticated
  if (!user?.id) {
    return null;
  }

  const displayedThreads = useMemo(() => {
    return expanded ? threads : threads.slice(0, DISPLAY_LIMIT);
  }, [threads, expanded]);

  const handleThreadClick = (threadId: string) => {
    setOpenMobile(false);
    router.push(`/builder/${threadId}`);
  };

  const handleNewBuilder = () => {
    setOpenMobile(false);
    router.push("/builder?new=true");
  };

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm("Delete this project? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteThread(threadId);
      toast.success("Project deleted");

      // If we're on the deleted thread, redirect to builder home
      if (pathname === `/builder/${threadId}`) {
        router.push("/builder");
      }
    } catch (_error) {
      toast.error("Failed to delete project");
    }
  };

  const handleRenameThread = async (
    threadId: string,
    currentTitle: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();

    const newTitle = prompt("Enter new project name:", currentTitle);
    if (!newTitle || newTitle === currentTitle) return;

    try {
      await useBuilderStore.getState().updateThreadTitle(threadId, newTitle);
      toast.success("Project renamed");
    } catch (_error) {
      toast.error("Failed to rename project");
    }
  };

  if (isLoading) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>Builder Projects</SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <div className="flex items-center justify-between px-2">
        <SidebarGroupLabel>Builder Projects</SidebarGroupLabel>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleNewBuilder}
              className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>New Builder Project</TooltipContent>
        </Tooltip>
      </div>

      <SidebarGroupContent>
        <SidebarMenu>
          {displayedThreads.length === 0 ? (
            <div className="px-2 py-4 text-sm text-muted-foreground text-center">
              No projects yet. Create your first one!
            </div>
          ) : (
            <>
              {displayedThreads.map((thread) => {
                const isActive = pathname === `/builder/${thread.id}`;

                return (
                  <SidebarMenuItem key={thread.id}>
                    <SidebarMenuButton
                      onClick={() => handleThreadClick(thread.id)}
                      isActive={isActive}
                      className="group/item"
                    >
                      <Code2 className="h-4 w-4 shrink-0" />
                      <span className="truncate flex-1">{thread.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {thread.template === "nextjs"
                          ? "Next.js"
                          : thread.template === "vite-react"
                            ? "Vite"
                            : thread.template.charAt(0).toUpperCase() +
                              thread.template.slice(1)}
                      </span>
                    </SidebarMenuButton>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction className="opacity-0 group-hover/item:opacity-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem
                          onClick={(e) =>
                            handleRenameThread(thread.id, thread.title, e)
                          }
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => handleDeleteThread(thread.id, e)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                );
              })}

              {threads.length > DISPLAY_LIMIT && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setExpanded(!expanded)}
                    className="text-muted-foreground"
                  >
                    {expanded
                      ? "Show less"
                      : `Show ${threads.length - DISPLAY_LIMIT} more`}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
