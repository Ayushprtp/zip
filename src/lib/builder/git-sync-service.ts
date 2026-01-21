/**
 * Git Sync Service
 * Manages auto-save and sync with GitHub
 */

import type { GitService } from "./git-service";
import type { VirtualFileSystemService } from "./virtual-fs-service";

export interface SyncConfig {
  autoCommit: boolean;
  autoPush: boolean;
  commitInterval: number; // milliseconds
  conflictResolution: "theirs" | "ours" | "manual";
}

export interface SyncStatus {
  lastSync: number;
  lastCommit: string | null;
  hasLocalChanges: boolean;
  hasRemoteChanges: boolean;
  syncing: boolean;
  error: string | null;
}

export class GitSyncService {
  private syncTimer: NodeJS.Timeout | null = null;
  private status: SyncStatus = {
    lastSync: 0,
    lastCommit: null,
    hasLocalChanges: false,
    hasRemoteChanges: false,
    syncing: false,
    error: null,
  };

  constructor(
    private git: GitService,
    private vfs: VirtualFileSystemService,
    private config: SyncConfig,
  ) {}

  async startAutoSync(token: string): Promise<void> {
    if (this.syncTimer) {
      this.stopAutoSync();
    }

    this.syncTimer = setInterval(async () => {
      await this.sync(token);
    }, this.config.commitInterval);
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  async sync(token: string): Promise<void> {
    if (this.status.syncing) return;

    this.status.syncing = true;
    this.status.error = null;

    try {
      // Check for local changes
      const hasChanges = await this.git.hasChanges();
      this.status.hasLocalChanges = hasChanges;

      if (hasChanges && this.config.autoCommit) {
        // Stage all changes
        await this.git.add(".");

        // Commit
        const timestamp = new Date().toISOString();
        const commitSha = await this.git.commit(
          `Auto-save: ${timestamp}`,
        );
        this.status.lastCommit = commitSha;
      }

      if (this.config.autoPush && this.status.lastCommit) {
        // Pull first to check for remote changes
        try {
          await this.git.pull("origin", "main", token);
        } catch (error: any) {
          // Handle merge conflicts
          if (error.message?.includes("conflict")) {
            await this.handleConflict(token);
          } else {
            throw error;
          }
        }

        // Push changes
        await this.git.push("origin", "main", token);
      }

      this.status.lastSync = Date.now();
    } catch (error: any) {
      this.status.error = error.message;
      console.error("Sync error:", error);
    } finally {
      this.status.syncing = false;
    }
  }

  private async handleConflict(token: string): Promise<void> {
    switch (this.config.conflictResolution) {
      case "theirs":
        // Accept remote changes
        await this.git.checkout("FETCH_HEAD");
        break;

      case "ours":
        // Keep local changes
        await this.git.resetHard("HEAD");
        break;

      case "manual":
        // Throw error for manual resolution
        throw new Error(
          "Merge conflict detected. Manual resolution required.",
        );
    }
  }

  async manualSync(
    files: Record<string, string>,
    message: string,
    token: string,
  ): Promise<string> {
    // Sync files to VFS
    await this.vfs.syncFromProjectFiles(files);

    // Stage all changes
    await this.git.add(".");

    // Commit
    const commitSha = await this.git.commit(message);

    // Push
    await this.git.push("origin", "main", token);

    this.status.lastCommit = commitSha;
    this.status.lastSync = Date.now();

    return commitSha;
  }

  getStatus(): SyncStatus {
    return { ...this.status };
  }

  updateConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
