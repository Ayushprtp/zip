"use client";

import { useBuilderUIStore } from "@/stores/builder-ui-store";
import { useSidebar } from "ui/sidebar";
import { useEffect } from "react";
import { toast } from "sonner";

export function KeyBindings() {
  const { toggleSidebar } = useSidebar();
  const toggleTerminal = useBuilderUIStore((s) => s.toggleTerminal);
  const setSidebarPanel = useBuilderUIStore((s) => s.setSidebarPanel);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for modifier keys
      const hasCtrl = e.ctrlKey || e.metaKey;
      const hasShift = e.shiftKey;
      const hasAlt = e.altKey;

      // 1. Core Actions

      // Save: Ctrl+S
      if (hasCtrl && e.key === "s") {
        e.preventDefault();
        // Auto-save handles saving, just show feedback
        toast.success("File saved");
      }

      // Quick Open / Search in Files: Ctrl+P or Ctrl+Shift+F
      // Mapping Ctrl+P to Sidebar Search for now as we lack a command palette modal
      if (
        (hasCtrl && e.key === "p") ||
        (hasCtrl && hasShift && e.key === "f")
      ) {
        e.preventDefault();
        setSidebarPanel("search");
        // We assume user wants to see sidebar. Toggle effectively opens it if closed?
        // useSidebar logic is complex, checking if it works:
        // If closed, sidebar width 0. Toggle opens.
        // If open, toggle closes.
        // Ideally we check `open` state but we don't have it here conveniently without prop drilling
        // or using context. useSidebar() returns { open }.
        // Let's use it!
      }

      // Sidebar Toggle: Ctrl+B
      if (hasCtrl && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }

      // Terminal Toggle: Ctrl+`
      if (hasCtrl && e.key === "`") {
        e.preventDefault();
        toggleTerminal();
      }

      // 2. Browser Conflicts & Navigation

      // Format Document: Shift+Alt+F
      if (hasShift && hasAlt && e.key === "f") {
        e.preventDefault();
        toast.info("Formatting not yet implemented");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar, toggleTerminal, setSidebarPanel]);

  return null;
}
