/**
 * useProjectSync - Syncs ProjectContext files with database via auto-save
 * Bridges the gap between local ProjectContext state and persisted database state
 */

import { useEffect, useCallback, useRef } from "react";
import { useProject } from "./project-context";
import { useBuilderStore } from "@/stores/builder-store";
import { useAutoSave } from "./use-auto-save";

interface ProjectSyncOptions {
  autoSaveEnabled?: boolean;
  debounceMs?: number;
  onSyncComplete?: () => void;
}

export function useProjectSync(options: ProjectSyncOptions = {}) {
  const { autoSaveEnabled = true, debounceMs = 1000, onSyncComplete } = options;

  const { state, actions } = useProject();
  const { currentThreadId, files: storeFiles, setFiles } = useBuilderStore();
  const lastSyncedFilesRef = useRef<string>("");
  const isSyncingRef = useRef(false);
  const isInitializedRef = useRef(false);

  // Initial sync: Store → ProjectContext (when store files load)
  useEffect(() => {
    if (!currentThreadId || isInitializedRef.current) return;

    const storeFilesStr = JSON.stringify(storeFiles);

    // Sync store files to context (even if empty, to mark initialized)
    console.log(
      "[useProjectSync] Initial sync: store → context:",
      Object.keys(storeFiles).length,
      "files",
    );

    // Batch update all files at once (if any)
    if (Object.keys(storeFiles).length > 0) {
      Object.entries(storeFiles).forEach(([path, content]) => {
        actions.updateFile(path, content);
      });
    }

    lastSyncedFilesRef.current = storeFilesStr;
    isInitializedRef.current = true;
  }, [currentThreadId, storeFiles, actions]);

  // Ongoing sync: ProjectContext → Store (when user makes changes)
  useEffect(() => {
    if (!currentThreadId || isSyncingRef.current || !isInitializedRef.current)
      return;
    if (Object.keys(state.files).length === 0) return; // Don't sync empty state

    const currentFilesStr = JSON.stringify(state.files);

    // Only sync if ProjectContext has changes from last sync
    if (currentFilesStr !== lastSyncedFilesRef.current) {
      const storeFilesStr = JSON.stringify(storeFiles);

      // Don't sync if it matches store (avoid circular updates)
      if (currentFilesStr === storeFilesStr) {
        lastSyncedFilesRef.current = currentFilesStr;
        return;
      }

      console.log("[useProjectSync] Syncing context → store");
      isSyncingRef.current = true;
      lastSyncedFilesRef.current = currentFilesStr;
      setFiles(state.files);

      setTimeout(() => {
        isSyncingRef.current = false;
      }, 100);
    }
  }, [state.files, currentThreadId, storeFiles, setFiles]);

  // Auto-save with status callbacks
  const { isSaving, hasPendingSaves, forceSaveAll } = useAutoSave({
    enabled: autoSaveEnabled && !!currentThreadId,
    debounceMs,
    onSaveSuccess: () => {
      onSyncComplete?.();
    },
  });

  // Manual save trigger
  const saveNow = useCallback(async () => {
    await forceSaveAll();
  }, [forceSaveAll]);

  return {
    isSaving,
    hasPendingSaves,
    saveNow,
    isConnected: !!currentThreadId,
  };
}
