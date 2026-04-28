import { map, type MapStore } from 'nanostores';
import { Buffer } from 'buffer';
import { getE2BSandbox, scheduleAutoSnapshot, writeFile as e2bWriteFile } from '~/lib/e2b/sandbox';
import { computeFileModifications } from '~/utils/diff';
import { createScopedLogger } from '~/utils/logger';
import { unreachable } from '~/utils/unreachable';
import { WORK_DIR } from '~/utils/constants';

const logger = createScopedLogger('FilesStore');

export interface File {
  type: 'file';
  content: string;
  isBinary: boolean;
}

export interface Folder {
  type: 'folder';
}

type Dirent = File | Folder;

export type FileMap = Record<string, Dirent | undefined>;

export class FilesStore {
  /**
   * Tracks the number of files without folders.
   */
  #size = 0;

  /**
   * @note Keeps track all modified files with their original content since the last user message.
   * Needs to be reset when the user sends another message and all changes have to be submitted
   * for the model to be aware of the changes.
   */
  #modifiedFiles: Map<string, string> = import.meta.hot?.data.modifiedFiles ?? new Map();

  /**
   * Map of files that matches the state of the E2B sandbox.
   */
  files: MapStore<FileMap> = import.meta.hot?.data.files ?? map({});

  /**
   * Polling interval for syncing files from the E2B sandbox.
   */
  #pollInterval: ReturnType<typeof setInterval> | null = null;

  get filesCount() {
    return this.#size;
  }

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.files = this.files;
      import.meta.hot.data.modifiedFiles = this.#modifiedFiles;
    }

    // Start polling for file changes from E2B
    this.#startPolling();
  }

  getFile(filePath: string) {
    const dirent = this.files.get()[filePath];

    if (dirent?.type !== 'file') {
      return undefined;
    }

    return dirent;
  }

  getFileModifications() {
    return computeFileModifications(this.files.get(), this.#modifiedFiles);
  }

  resetFileModifications() {
    this.#modifiedFiles.clear();
  }

  async saveFile(filePath: string, content: string) {
    try {
      const relativePath = filePath.startsWith(WORK_DIR) ? filePath.slice(WORK_DIR.length + 1) : filePath;

      if (!relativePath) {
        throw new Error(`EINVAL: invalid file path, write '${relativePath}'`);
      }

      const oldContent = this.getFile(filePath)?.content;

      if (!oldContent) {
        unreachable('Expected content to be defined');
      }

      // Write to E2B sandbox
      await e2bWriteFile(relativePath, content);
      scheduleAutoSnapshot('file_save');

      if (!this.#modifiedFiles.has(filePath)) {
        this.#modifiedFiles.set(filePath, oldContent);
      }

      // Immediately update the local file state
      this.files.setKey(filePath, { type: 'file', content, isBinary: false });

      logger.info('File updated');
    } catch (error) {
      logger.error('Failed to update file content\n\n', error);
      throw error;
    }
  }

  /**
   * Poll E2B sandbox for file changes every 3 seconds.
   * This replaces the WebContainer file watcher.
   */
  async #startPolling() {
    // Initial sync after a short delay to let the sandbox boot
    setTimeout(() => this.#syncFromE2B(), 2000);

    this.#pollInterval = setInterval(() => {
      this.#syncFromE2B();
    }, 5000);
  }

  async sync() {
    await this.#syncFromE2B();
  }

  async #syncFromE2B() {
    try {
      const sandbox = await getE2BSandbox();
      await this.#walkDirectory(sandbox, '.', WORK_DIR);
    } catch (error) {
      // Sandbox may not be ready yet
    }
  }

  async #walkDirectory(sandbox: any, dir: string, basePath: string) {
    try {
      const entries = await sandbox.files.list(dir);

      for (const entry of entries) {
        // Construct the correct relative path for E2B (e.g., "src/main.tsx")
        const e2bPath = dir === '.' ? entry.name : `${dir}/${entry.name}`;

        // Construct the corresponding workbench path (e.g., "/home/project/src/main.tsx")
        const workbenchPath = `${basePath}/${e2bPath}`;

        // Skip massive or uninteresting directories/files to keep it compact
        const isMessy = ['.npm', '_cacache', '_logs', 'tmp', '.vscode', '.idea', '.npm-global'].includes(entry.name);
        const isSystem = ['.bash_logout', '.bashrc', '.profile', '.sudo_as_admin_successful', '.bash_history'].includes(
          entry.name,
        );
        const isBuild = ['node_modules', '.git', '.next', '.astro', 'dist', 'build', '.cache'].includes(entry.name);

        if (isMessy || isSystem || isBuild) {
          continue;
        }

        if (entry.type === 'dir') {
          // Ensure folder exists in local map
          if (!(this.files.get() as any)[workbenchPath]) {
            this.files.setKey(workbenchPath, { type: 'folder' });
          }

          // Recurse using the e2bPath
          await this.#walkDirectory(sandbox, e2bPath, basePath);
        } else {
          try {
            // Read content from E2B
            const content = await sandbox.files.read(e2bPath);

            const currentFiles = this.files.get();
            const existingFile = currentFiles[workbenchPath];

            // Update if file is new or content has changed (and isn't being locally edited)
            if (!existingFile || (existingFile.type === 'file' && existingFile.content !== content)) {
              this.files.setKey(workbenchPath, { type: 'file', content, isBinary: false });

              if (!existingFile) {
                this.#size++;
              }
            }
          } catch (err) {
            // Likely binary or unreadable
          }
        }
      }
    } catch (error) {
      // dir might not exist on sandbox yet
    }
  }

  /**
   * Directly set a file in the store (used by streaming actions).
   * This doesn't sync to E2B — the action runner handles that separately.
   */
  setFile(filePath: string, content: string) {
    this.files.setKey(filePath, { type: 'file', content, isBinary: false });
    this.#size++;
  }

  destroy() {
    if (this.#pollInterval) {
      clearInterval(this.#pollInterval);
    }
  }
}
