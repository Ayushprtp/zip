/**
 * CheckpointManager - Manages project history and checkpoints
 * Provides checkpoint creation, restoration, and history management
 */

import { nanoid } from "nanoid";
import type { Checkpoint } from "@/types/builder";

export class CheckpointManager {
  private historyStack: Checkpoint[] = [];
  private readonly maxCheckpoints = 50;

  /**
   * Creates a new checkpoint with deep cloning of file state
   * @param files - The current file system state
   * @param label - A descriptive label for the checkpoint
   * @param description - Optional detailed description
   * @returns The created checkpoint
   */
  createCheckpoint(
    files: Record<string, string>,
    label: string,
    description?: string,
  ): Checkpoint {
    // Deep clone the files object to prevent mutations
    const clonedFiles = this.deepClone(files);

    const checkpoint: Checkpoint = {
      id: nanoid(),
      timestamp: Date.now(),
      label,
      files: clonedFiles,
      description: description || this.generateDescription(clonedFiles),
    };

    // Add to history stack
    this.historyStack.push(checkpoint);

    // Enforce checkpoint limit
    if (this.historyStack.length > this.maxCheckpoints) {
      this.historyStack.shift(); // Remove oldest checkpoint
    }

    return checkpoint;
  }

  /**
   * Restores file state from a checkpoint
   * @param checkpointId - The ID of the checkpoint to restore
   * @returns The restored file state, or null if checkpoint not found
   */
  restoreCheckpoint(checkpointId: string): Record<string, string> | null {
    const checkpoint = this.historyStack.find((cp) => cp.id === checkpointId);

    if (!checkpoint) {
      return null;
    }

    // Return a deep clone to prevent mutations
    return this.deepClone(checkpoint.files);
  }

  /**
   * Gets all checkpoints in the history stack
   * @returns Array of all checkpoints
   */
  getAllCheckpoints(): Checkpoint[] {
    return [...this.historyStack];
  }

  /**
   * Gets the most recent checkpoint
   * @returns The latest checkpoint, or null if no checkpoints exist
   */
  getLatestCheckpoint(): Checkpoint | null {
    if (this.historyStack.length === 0) {
      return null;
    }
    return this.historyStack[this.historyStack.length - 1];
  }

  /**
   * Gets a specific checkpoint by ID
   * @param checkpointId - The ID of the checkpoint to retrieve
   * @returns The checkpoint, or null if not found
   */
  getCheckpoint(checkpointId: string): Checkpoint | null {
    return this.historyStack.find((cp) => cp.id === checkpointId) || null;
  }

  /**
   * Gets the total number of checkpoints
   * @returns The count of checkpoints in the history stack
   */
  getCheckpointCount(): number {
    return this.historyStack.length;
  }

  /**
   * Clears all checkpoints from the history stack
   */
  clearHistory(): void {
    this.historyStack = [];
  }

  /**
   * Gets the index of a checkpoint in the history stack
   * @param checkpointId - The ID of the checkpoint
   * @returns The index, or -1 if not found
   */
  getCheckpointIndex(checkpointId: string): number {
    return this.historyStack.findIndex((cp) => cp.id === checkpointId);
  }

  /**
   * Deep clones an object to prevent mutations
   * @param obj - The object to clone
   * @returns A deep clone of the object
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Generates a description for a checkpoint based on file state
   * @param files - The file system state
   * @returns A descriptive string
   */
  private generateDescription(files: Record<string, string>): string {
    const fileCount = Object.keys(files).length;
    const totalSize = Object.values(files).reduce(
      (sum, content) => sum + content.length,
      0,
    );
    const sizeKB = (totalSize / 1024).toFixed(1);

    return `${fileCount} file${fileCount !== 1 ? "s" : ""}, ${sizeKB} KB`;
  }

  /**
   * Gets checkpoints within a time range
   * @param startTime - Start timestamp (inclusive)
   * @param endTime - End timestamp (inclusive)
   * @returns Array of checkpoints within the time range
   */
  getCheckpointsByTimeRange(startTime: number, endTime: number): Checkpoint[] {
    return this.historyStack.filter(
      (cp) => cp.timestamp >= startTime && cp.timestamp <= endTime,
    );
  }

  /**
   * Removes checkpoints older than a specified timestamp
   * @param timestamp - The cutoff timestamp
   * @returns The number of checkpoints removed
   */
  pruneOldCheckpoints(timestamp: number): number {
    const initialCount = this.historyStack.length;
    this.historyStack = this.historyStack.filter(
      (cp) => cp.timestamp >= timestamp,
    );
    return initialCount - this.historyStack.length;
  }
}
