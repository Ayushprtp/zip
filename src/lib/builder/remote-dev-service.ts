/**
 * Remote Development Service
 * Provides high-level operations for remote SSH development in Builder mode.
 * Acts as a bridge between the UI, the remote dev store, and the SSH API.
 */

import { useRemoteDevStore } from "@/stores/remote-dev-store";
import type {
  RemoteFileInfo,
  RemoteProjectTemplate,
} from "@/types/builder/remote";

// ============================================================================
// Remote File Operations Service
// ============================================================================

export class RemoteDevService {
  /**
   * Read a file from the remote server, resolving relative paths
   * against the current working directory
   */
  static async readFile(path: string): Promise<string | null> {
    const store = useRemoteDevStore.getState();
    const resolvedPath = this.resolvePath(path, store.workingDirectory);
    return store.readRemoteFile(resolvedPath);
  }

  /**
   * Write content to a file on the remote server
   */
  static async writeFile(path: string, content: string): Promise<boolean> {
    const store = useRemoteDevStore.getState();
    const resolvedPath = this.resolvePath(path, store.workingDirectory);
    const success = await store.writeRemoteFile(resolvedPath, content);
    if (success) {
      await store.listRemoteFiles();
    }
    return success;
  }

  /**
   * Create a new file with initial content
   */
  static async createFile(path: string, content = ""): Promise<boolean> {
    return this.writeFile(path, content);
  }

  /**
   * Delete a file or directory
   */
  static async deleteFile(path: string, recursive = false): Promise<boolean> {
    const store = useRemoteDevStore.getState();
    const resolvedPath = this.resolvePath(path, store.workingDirectory);
    return store.deleteRemoteFile(resolvedPath, recursive);
  }

  /**
   * Create a directory
   */
  static async createDirectory(path: string): Promise<boolean> {
    const store = useRemoteDevStore.getState();
    const resolvedPath = this.resolvePath(path, store.workingDirectory);
    return store.createRemoteDirectory(resolvedPath);
  }

  /**
   * Move/rename a file
   */
  static async moveFile(from: string, to: string): Promise<boolean> {
    const store = useRemoteDevStore.getState();
    const resolvedFrom = this.resolvePath(from, store.workingDirectory);
    const resolvedTo = this.resolvePath(to, store.workingDirectory);

    const result = await store.executeCommand(
      `mv "${resolvedFrom}" "${resolvedTo}"`,
      { skipSafetyCheck: true },
    );

    if (result && result.exitCode === 0) {
      await store.listRemoteFiles();
      return true;
    }
    return false;
  }

  /**
   * Copy a file
   */
  static async copyFile(
    from: string,
    to: string,
    recursive = false,
  ): Promise<boolean> {
    const store = useRemoteDevStore.getState();
    const resolvedFrom = this.resolvePath(from, store.workingDirectory);
    const resolvedTo = this.resolvePath(to, store.workingDirectory);

    const flag = recursive ? "-r " : "";
    const result = await store.executeCommand(
      `cp ${flag}"${resolvedFrom}" "${resolvedTo}"`,
      { skipSafetyCheck: true },
    );

    if (result && result.exitCode === 0) {
      await store.listRemoteFiles();
      return true;
    }
    return false;
  }

  /**
   * List files in a directory
   */
  static async listFiles(path?: string): Promise<RemoteFileInfo[]> {
    const store = useRemoteDevStore.getState();
    const targetPath = path
      ? this.resolvePath(path, store.workingDirectory)
      : store.workingDirectory;
    return store.listRemoteFiles(targetPath);
  }

  /**
   * Get a tree view of the remote directory
   */
  static async getTreeView(path?: string, depth = 3): Promise<string | null> {
    const store = useRemoteDevStore.getState();
    const targetPath = path || store.workingDirectory;

    const result = await store.executeCommand(
      `tree -L ${depth} --charset=utf-8 "${targetPath}" 2>/dev/null || find "${targetPath}" -maxdepth ${depth} -print | head -100`,
      { skipSafetyCheck: true },
    );

    return result?.output || null;
  }

  /**
   * Search for files matching a pattern
   */
  static async findFiles(pattern: string, path?: string): Promise<string[]> {
    const store = useRemoteDevStore.getState();
    const targetPath = path || store.workingDirectory;

    const result = await store.executeCommand(
      `find "${targetPath}" -name "${pattern}" -maxdepth 5 2>/dev/null | head -50`,
      { skipSafetyCheck: true },
    );

    if (result?.output) {
      return result.output
        .split("\n")
        .filter((l) => l.trim())
        .map((l) => l.trim());
    }
    return [];
  }

  /**
   * Search for text in files
   */
  static async grepFiles(
    pattern: string,
    path?: string,
    options: { recursive?: boolean; ignoreCase?: boolean } = {},
  ): Promise<string | null> {
    const store = useRemoteDevStore.getState();
    const targetPath = path || store.workingDirectory;

    const flags = [
      options.recursive !== false ? "-r" : "",
      options.ignoreCase ? "-i" : "",
      "-n",
      "--include='*.{ts,tsx,js,jsx,py,rb,go,rs,java,css,html,json,md,yaml,yml}'",
    ]
      .filter(Boolean)
      .join(" ");

    const result = await store.executeCommand(
      `grep ${flags} "${pattern}" "${targetPath}" 2>/dev/null | head -100`,
      { skipSafetyCheck: true },
    );

    return result?.output || null;
  }

  // ============================================================================
  // Git Operations
  // ============================================================================

  static async gitInit(): Promise<boolean> {
    const store = useRemoteDevStore.getState();
    const result = await store.executeCommand("git init", {
      skipSafetyCheck: true,
    });
    if (result?.exitCode === 0) {
      await store.refreshGitStatus();
      return true;
    }
    return false;
  }

  static async gitStatus(): Promise<string | null> {
    const store = useRemoteDevStore.getState();
    const result = await store.executeCommand("git status", {
      skipSafetyCheck: true,
    });
    await store.refreshGitStatus();
    return result?.output || null;
  }

  static async gitAdd(files: string | string[] = "."): Promise<boolean> {
    const store = useRemoteDevStore.getState();
    const fileArg = Array.isArray(files) ? files.join(" ") : files;
    const result = await store.executeCommand(`git add ${fileArg}`, {
      skipSafetyCheck: true,
    });
    if (result?.exitCode === 0) {
      await store.refreshGitStatus();
      return true;
    }
    return false;
  }

  static async gitCommit(message: string): Promise<boolean> {
    const store = useRemoteDevStore.getState();
    const result = await store.executeCommand(
      `git commit -m "${message.replace(/"/g, '\\"')}"`,
      { skipSafetyCheck: true },
    );
    if (result?.exitCode === 0) {
      await store.refreshGitStatus();
      return true;
    }
    return false;
  }

  static async gitPush(remote = "origin", branch?: string): Promise<boolean> {
    const store = useRemoteDevStore.getState();
    const branchArg = branch || "";
    const result = await store.executeCommand(
      `git push ${remote} ${branchArg}`.trim(),
    );
    if (result?.exitCode === 0) {
      await store.refreshGitStatus();
      return true;
    }
    return false;
  }

  static async gitPull(remote = "origin", branch?: string): Promise<boolean> {
    const store = useRemoteDevStore.getState();
    const branchArg = branch || "";
    const result = await store.executeCommand(
      `git pull ${remote} ${branchArg}`.trim(),
      { skipSafetyCheck: true },
    );
    if (result?.exitCode === 0) {
      await store.refreshGitStatus();
      return true;
    }
    return false;
  }

  static async gitLog(count = 10): Promise<string | null> {
    const store = useRemoteDevStore.getState();
    const result = await store.executeCommand(`git log --oneline -${count}`, {
      skipSafetyCheck: true,
    });
    return result?.output || null;
  }

  static async gitDiff(staged = false): Promise<string | null> {
    const store = useRemoteDevStore.getState();
    const flag = staged ? "--staged " : "";
    const result = await store.executeCommand(`git diff ${flag}`, {
      skipSafetyCheck: true,
    });
    return result?.output || null;
  }

  static async gitBranch(): Promise<string | null> {
    const store = useRemoteDevStore.getState();
    const result = await store.executeCommand("git branch -a", {
      skipSafetyCheck: true,
    });
    return result?.output || null;
  }

  static async gitCheckout(branch: string): Promise<boolean> {
    const store = useRemoteDevStore.getState();
    const result = await store.executeCommand(`git checkout ${branch}`);
    if (result?.exitCode === 0) {
      await store.refreshGitStatus();
      return true;
    }
    return false;
  }

  // ============================================================================
  // Package Management
  // ============================================================================

  static async detectPackageManager(): Promise<
    "npm" | "yarn" | "pnpm" | "bun" | null
  > {
    const store = useRemoteDevStore.getState();

    // Check lock files
    const result = await store.executeCommand(
      `ls package-lock.json yarn.lock pnpm-lock.yaml bun.lockb 2>/dev/null`,
      { skipSafetyCheck: true },
    );

    if (result?.output) {
      if (result.output.includes("bun.lockb")) return "bun";
      if (result.output.includes("pnpm-lock.yaml")) return "pnpm";
      if (result.output.includes("yarn.lock")) return "yarn";
      if (result.output.includes("package-lock.json")) return "npm";
    }

    return "npm"; // default
  }

  static async installDependencies(
    packageManager?: "npm" | "yarn" | "pnpm" | "bun",
  ): Promise<boolean> {
    const pm = packageManager || (await this.detectPackageManager()) || "npm";
    const store = useRemoteDevStore.getState();
    const result = await store.executeCommand(`${pm} install`, {
      skipSafetyCheck: true,
    });
    return result?.exitCode === 0;
  }

  static async addPackage(packageName: string, dev = false): Promise<boolean> {
    const pm = await this.detectPackageManager();
    const store = useRemoteDevStore.getState();

    let cmd: string;
    switch (pm) {
      case "yarn":
        cmd = `yarn add ${dev ? "-D " : ""}${packageName}`;
        break;
      case "pnpm":
        cmd = `pnpm add ${dev ? "-D " : ""}${packageName}`;
        break;
      case "bun":
        cmd = `bun add ${dev ? "-d " : ""}${packageName}`;
        break;
      default:
        cmd = `npm install ${dev ? "--save-dev " : ""}${packageName}`;
    }

    const result = await store.executeCommand(cmd, {
      skipSafetyCheck: true,
    });
    return result?.exitCode === 0;
  }

  // ============================================================================
  // Process Management
  // ============================================================================

  static async runDevServer(
    command?: string,
  ): Promise<{ output: string } | null> {
    const store = useRemoteDevStore.getState();

    if (!command) {
      // Auto-detect start command from package.json
      const pm = await this.detectPackageManager();
      command = `${pm || "npm"} run dev`;
    }

    const result = await store.executeCommand(command, {
      skipSafetyCheck: true,
    });
    return result ? { output: result.output } : null;
  }

  static async runScript(script: string): Promise<string | null> {
    const store = useRemoteDevStore.getState();
    const pm = await this.detectPackageManager();
    const result = await store.executeCommand(`${pm || "npm"} run ${script}`, {
      skipSafetyCheck: true,
    });
    return result?.output || null;
  }

  // ============================================================================
  // Project Initialization
  // ============================================================================

  static async initializeProject(
    template: RemoteProjectTemplate,
    name: string,
  ): Promise<boolean> {
    return useRemoteDevStore.getState().initializeProject(template, name);
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Resolve a potentially relative path against a base directory
   */
  static resolvePath(path: string, baseDir: string): string {
    if (path.startsWith("/") || path.startsWith("~")) {
      return path;
    }
    // Relative path
    const base = baseDir.endsWith("/") ? baseDir : `${baseDir}/`;
    return `${base}${path}`;
  }

  /**
   * Check if the remote connection is active and healthy
   */
  static isConnected(): boolean {
    const store = useRemoteDevStore.getState();
    return store.connectionStatus === "connected" && store.isHealthy;
  }

  /**
   * Check if execution should happen remotely
   */
  static shouldUseRemote(): boolean {
    const store = useRemoteDevStore.getState();
    return (
      store.executionContext === "remote" &&
      store.connectionStatus === "connected" &&
      store.isHealthy
    );
  }

  /**
   * Get the current remote working directory
   */
  static getWorkingDirectory(): string {
    return useRemoteDevStore.getState().workingDirectory;
  }

  /**
   * Get connection status string for display
   */
  static getConnectionStatusDisplay(): string {
    const store = useRemoteDevStore.getState();
    const { connectionStatus, activeConnection, workingDirectory } = store;

    if (connectionStatus !== "connected" || !activeConnection) {
      return "Not connected";
    }

    return `${activeConnection.username}@${activeConnection.host}:${activeConnection.port} • ${workingDirectory}`;
  }
}
