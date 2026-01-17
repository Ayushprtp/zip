/**
 * Hook for checkpoint restoration with confirmation flow
 * Provides methods to restore checkpoints with user confirmation
 */

import { useState, useCallback } from "react";
import type { Checkpoint, FileDiff } from "@/types/builder";
import { CheckpointManager } from "./checkpoint-manager";

export interface CheckpointRestorationState {
  isConfirming: boolean;
  selectedCheckpoint: Checkpoint | null;
  diff: FileDiff[] | null;
}

export interface CheckpointRestorationActions {
  selectCheckpoint: (
    checkpoint: Checkpoint,
    currentFiles: Record<string, string>,
  ) => void;
  confirmRestore: () => Record<string, string> | null;
  cancelRestore: () => void;
}

export function useCheckpointRestoration(
  manager: CheckpointManager,
): [CheckpointRestorationState, CheckpointRestorationActions] {
  const [state, setState] = useState<CheckpointRestorationState>({
    isConfirming: false,
    selectedCheckpoint: null,
    diff: null,
  });

  const selectCheckpoint = useCallback(
    (checkpoint: Checkpoint, currentFiles: Record<string, string>) => {
      // Calculate diff between current state and checkpoint
      const diff = calculateSimpleDiff(currentFiles, checkpoint.files);

      setState({
        isConfirming: true,
        selectedCheckpoint: checkpoint,
        diff,
      });
    },
    [],
  );

  const confirmRestore = useCallback(() => {
    if (!state.selectedCheckpoint) {
      return null;
    }

    const restoredFiles = manager.restoreCheckpoint(
      state.selectedCheckpoint.id,
    );

    setState({
      isConfirming: false,
      selectedCheckpoint: null,
      diff: null,
    });

    return restoredFiles;
  }, [state.selectedCheckpoint, manager]);

  const cancelRestore = useCallback(() => {
    setState({
      isConfirming: false,
      selectedCheckpoint: null,
      diff: null,
    });
  }, []);

  const actions: CheckpointRestorationActions = {
    selectCheckpoint,
    confirmRestore,
    cancelRestore,
  };

  return [state, actions];
}

/**
 * Calculates a simple diff between two file states
 * Returns a list of files that were added, modified, or deleted
 */
function calculateSimpleDiff(
  oldFiles: Record<string, string>,
  newFiles: Record<string, string>,
): FileDiff[] {
  const diffs: FileDiff[] = [];
  const allPaths = new Set([
    ...Object.keys(oldFiles),
    ...Object.keys(newFiles),
  ]);

  for (const path of allPaths) {
    const oldContent = oldFiles[path];
    const newContent = newFiles[path];

    if (!oldContent && newContent) {
      // File was added
      diffs.push({
        path,
        type: "added",
        newContent,
        hunks: [],
      });
    } else if (oldContent && !newContent) {
      // File was deleted
      diffs.push({
        path,
        type: "deleted",
        oldContent,
        hunks: [],
      });
    } else if (oldContent !== newContent) {
      // File was modified
      diffs.push({
        path,
        type: "modified",
        oldContent,
        newContent,
        hunks: [],
      });
    }
  }

  return diffs;
}
