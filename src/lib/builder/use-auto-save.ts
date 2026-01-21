/**
 * useAutoSave - Automatic background file saving with debouncing
 * Monitors file changes and saves them to the database automatically
 * Also creates version history checkpoints
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useBuilderStore } from "@/stores/builder-store";
import { useProject } from "./project-context";

interface AutoSaveOptions {
  debounceMs?: number; // Delay before saving (default: 1000ms)
  enabled?: boolean; // Enable/disable auto-save (default: true)
  createCheckpoints?: boolean; // Create checkpoints on save (default: true)
  checkpointInterval?: number; // Minutes between checkpoints (default: 5)
  onSaveStart?: () => void;
  onSaveSuccess?: (filePath: string) => void;
  onSaveError?: (filePath: string, error: Error) => void;
}

interface PendingSave {
  filePath: string;
  content: string;
  timeoutId: NodeJS.Timeout;
}

export function useAutoSave(options: AutoSaveOptions = {}) {
  const {
    debounceMs = 1000,
    enabled = true,
    createCheckpoints = true,
    checkpointInterval = 5, // 5 minutes
    onSaveStart,
    onSaveSuccess,
    onSaveError,
  } = options;

  const { currentThreadId, files } = useBuilderStore();
  const { actions } = useProject();
  const pendingSavesRef = useRef<Map<string, PendingSave>>(new Map());
  const previousFilesRef = useRef<Record<string, string>>({});
  const lastCheckpointTimeRef = useRef<number>(Date.now());

  // Use state for reactive UI updates
  const [isSaving, setIsSaving] = useState(false);
  const [hasPendingSaves, setHasPendingSaves] = useState(false);
  const savingCountRef = useRef(0);

  // Update pending saves state
  const updatePendingState = useCallback(() => {
    setHasPendingSaves(pendingSavesRef.current.size > 0);
  }, []);

  // Update saving state
  const updateSavingState = useCallback(() => {
    setIsSaving(savingCountRef.current > 0);
  }, []);

  // Save a single file to the database
  const saveFileToDb = useCallback(
    async (filePath: string, content: string) => {
      if (!currentThreadId) return;

      try {
        savingCountRef.current++;
        updateSavingState();
        onSaveStart?.();

        const response = await fetch(
          `/api/builder/threads/${currentThreadId}/files`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filePath, fileContent: content }),
          },
        );

        if (!response.ok) {
          throw new Error(`Failed to save file: ${response.statusText}`);
        }

        onSaveSuccess?.(filePath);

        // Create checkpoint if enabled and interval passed
        if (createCheckpoints) {
          const now = Date.now();
          const minutesSinceLastCheckpoint =
            (now - lastCheckpointTimeRef.current) / 1000 / 60;

          if (minutesSinceLastCheckpoint >= checkpointInterval) {
            const label = `Auto-save ${new Date().toLocaleTimeString()}`;
            actions.createCheckpoint(label);
            lastCheckpointTimeRef.current = now;
          }
        }
      } catch (error) {
        console.error(`Error auto-saving file ${filePath}:`, error);
        onSaveError?.(filePath, error as Error);
      } finally {
        savingCountRef.current--;
        updateSavingState();
        pendingSavesRef.current.delete(filePath);
        updatePendingState();
      }
    },
    [
      currentThreadId,
      onSaveStart,
      onSaveSuccess,
      onSaveError,
      updateSavingState,
      updatePendingState,
      createCheckpoints,
      checkpointInterval,
      actions,
    ],
  );

  // Schedule a file save with debouncing
  const scheduleSave = useCallback(
    (filePath: string, content: string) => {
      // Cancel existing timeout for this file
      const existing = pendingSavesRef.current.get(filePath);
      if (existing) {
        clearTimeout(existing.timeoutId);
      }

      // Schedule new save
      const timeoutId = setTimeout(() => {
        saveFileToDb(filePath, content);
      }, debounceMs);

      pendingSavesRef.current.set(filePath, {
        filePath,
        content,
        timeoutId,
      });
      updatePendingState();
    },
    [debounceMs, saveFileToDb, updatePendingState],
  );

  // Monitor file changes and trigger auto-save
  useEffect(() => {
    if (!enabled || !currentThreadId) return;

    // Compare current files with previous files
    Object.entries(files).forEach(([filePath, content]) => {
      const previousContent = previousFilesRef.current[filePath];

      // File is new or content changed
      if (previousContent !== content) {
        scheduleSave(filePath, content);
      }
    });

    // Update previous files reference
    previousFilesRef.current = { ...files };
  }, [files, enabled, currentThreadId, scheduleSave]);

  // Add beforeunload handler to save pending changes
  useEffect(() => {
    if (!enabled || !currentThreadId) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasPending = pendingSavesRef.current.size > 0;

      if (hasPending) {
        // Save all pending changes immediately
        const saves = Array.from(pendingSavesRef.current.values());
        saves.forEach(({ filePath, content, timeoutId }) => {
          clearTimeout(timeoutId);

          // Use sendBeacon for guaranteed delivery
          const data = JSON.stringify({ filePath, fileContent: content });
          const blob = new Blob([data], { type: "application/json" });
          navigator.sendBeacon(
            `/api/builder/threads/${currentThreadId}/files`,
            blob,
          );
        });
        pendingSavesRef.current.clear();

        // Show warning to user
        e.preventDefault();
        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, currentThreadId]);

  // Cleanup on unmount - save any pending changes immediately
  useEffect(() => {
    return () => {
      // Clear all timeouts and save immediately
      const saves = Array.from(pendingSavesRef.current.values());
      pendingSavesRef.current.clear();

      if (currentThreadId && saves.length > 0) {
        // Use sendBeacon for guaranteed delivery even after unmount
        const savePromises = saves.map(({ filePath, content, timeoutId }) => {
          clearTimeout(timeoutId);

          // Try sendBeacon first (most reliable for page unload)
          const data = JSON.stringify({ filePath, fileContent: content });
          const blob = new Blob([data], { type: "application/json" });
          const sent = navigator.sendBeacon(
            `/api/builder/threads/${currentThreadId}/files`,
            blob,
          );

          // Fallback to fetch with keepalive if sendBeacon fails
          if (!sent) {
            return fetch(`/api/builder/threads/${currentThreadId}/files`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: data,
              keepalive: true,
            }).catch((error) => {
              console.error(`Error saving file on unmount:`, error);
            });
          }
          return Promise.resolve();
        });

        // Wait for all saves (if possible)
        Promise.all(savePromises).catch(console.error);
      }
    };
  }, [currentThreadId]);

  // Force save all pending changes immediately
  const forceSaveAll = useCallback(async () => {
    const saves = Array.from(pendingSavesRef.current.values());

    // Clear all timeouts
    saves.forEach(({ timeoutId }) => clearTimeout(timeoutId));
    pendingSavesRef.current.clear();
    updatePendingState();

    // Save all files in parallel
    await Promise.all(
      saves.map(({ filePath, content }) => saveFileToDb(filePath, content)),
    );
  }, [saveFileToDb, updatePendingState]);

  return {
    isSaving,
    hasPendingSaves,
    forceSaveAll,
  };
}
