/**
 * Virtual File System implementation for the AI Builder IDE
 * Provides in-memory file and directory management with support for nested directories
 */

import type {
  VirtualFile,
  VirtualDirectory,
  VirtualFileSystem as IVirtualFileSystem,
  FileSystemError,
} from "@/types/builder";

/**
 * VirtualFileSystem class manages files and directories in memory
 * Supports CRUD operations and nested directory structures up to 10 levels deep
 */
export class VirtualFileSystem implements IVirtualFileSystem {
  files: Map<string, VirtualFile>;
  directories: Map<string, VirtualDirectory>;
  private readonly MAX_NESTING_DEPTH = 11; // Allow 10 directory levels + 1 file

  constructor() {
    this.files = new Map();
    this.directories = new Map();
    // Initialize root directory
    this.directories.set("/", {
      path: "/",
      children: [],
      parent: null,
    });
  }

  /**
   * Creates a new file in the virtual file system
   * Automatically creates parent directories if they don't exist
   */
  createFile(path: string, content: string): void {
    // Normalize the path first
    path = this.normalizePath(path);

    this.validatePath(path);
    this.validateNestingDepth(path);

    // Ensure parent directories exist
    this.ensureDirectoryPath(path);

    // Detect language from file extension
    const language = this.detectLanguage(path);

    const file: VirtualFile = {
      path,
      content,
      language,
      lastModified: Date.now(),
      size: content.length,
    };

    this.files.set(path, file);

    // Add file to parent directory's children
    const parentPath = this.getParentPath(path);
    const parentDir = this.directories.get(parentPath);
    if (parentDir && !parentDir.children.includes(path)) {
      parentDir.children.push(path);
    }
  }

  /**
   * Reads a file from the virtual file system
   */
  readFile(path: string): string {
    const file = this.files.get(path);
    if (!file) {
      throw this.createFileSystemError(
        "FILE_NOT_FOUND",
        path,
        `File not found: ${path}`,
      );
    }
    return file.content;
  }

  /**
   * Updates an existing file's content
   */
  updateFile(path: string, content: string): void {
    const file = this.files.get(path);
    if (!file) {
      throw this.createFileSystemError(
        "FILE_NOT_FOUND",
        path,
        `File not found: ${path}`,
      );
    }

    file.content = content;
    file.lastModified = Date.now();
    file.size = content.length;
  }

  /**
   * Deletes a file from the virtual file system
   */
  deleteFile(path: string): void {
    const file = this.files.get(path);
    if (!file) {
      throw this.createFileSystemError(
        "FILE_NOT_FOUND",
        path,
        `File not found: ${path}`,
      );
    }

    this.files.delete(path);

    // Remove from parent directory's children
    const parentPath = this.getParentPath(path);
    const parentDir = this.directories.get(parentPath);
    if (parentDir) {
      parentDir.children = parentDir.children.filter((child) => child !== path);
    }
  }

  /**
   * Checks if a file exists
   */
  fileExists(path: string): boolean {
    return this.files.has(path);
  }

  /**
   * Gets file metadata
   */
  getFile(path: string): VirtualFile | undefined {
    return this.files.get(path);
  }

  /**
   * Creates a directory in the virtual file system
   */
  createDirectory(path: string): void {
    // Normalize the path first
    path = this.normalizePath(path);

    this.validatePath(path);
    this.validateNestingDepth(path);

    if (this.directories.has(path)) {
      return; // Directory already exists
    }

    // Ensure parent directories exist
    const parentPath = this.getParentPath(path);
    if (parentPath !== "/" && !this.directories.has(parentPath)) {
      this.createDirectory(parentPath);
    }

    const directory: VirtualDirectory = {
      path,
      children: [],
      parent: parentPath,
    };

    this.directories.set(path, directory);

    // Add to parent's children
    const parentDir = this.directories.get(parentPath);
    if (parentDir && !parentDir.children.includes(path)) {
      parentDir.children.push(path);
    }
  }

  /**
   * Deletes a directory and all its contents
   */
  deleteDirectory(path: string): void {
    const directory = this.directories.get(path);
    if (!directory) {
      throw this.createFileSystemError(
        "FILE_NOT_FOUND",
        path,
        `Directory not found: ${path}`,
      );
    }

    // Recursively delete all children
    const children = [...directory.children];
    for (const child of children) {
      if (this.files.has(child)) {
        this.deleteFile(child);
      } else if (this.directories.has(child)) {
        this.deleteDirectory(child);
      }
    }

    // Remove from parent's children
    if (directory.parent) {
      const parentDir = this.directories.get(directory.parent);
      if (parentDir) {
        parentDir.children = parentDir.children.filter(
          (child) => child !== path,
        );
      }
    }

    this.directories.delete(path);
  }

  /**
   * Checks if a directory exists
   */
  directoryExists(path: string): boolean {
    return this.directories.has(path);
  }

  /**
   * Gets directory metadata
   */
  getDirectory(path: string): VirtualDirectory | undefined {
    return this.directories.get(path);
  }

  /**
   * Lists all files in a directory (non-recursive)
   */
  listFiles(directoryPath: string): VirtualFile[] {
    const directory = this.directories.get(directoryPath);
    if (!directory) {
      throw this.createFileSystemError(
        "FILE_NOT_FOUND",
        directoryPath,
        `Directory not found: ${directoryPath}`,
      );
    }

    return directory.children
      .filter((child) => this.files.has(child))
      .map((path) => this.files.get(path)!)
      .filter((file): file is VirtualFile => file !== undefined);
  }

  /**
   * Lists all subdirectories in a directory (non-recursive)
   */
  listDirectories(directoryPath: string): VirtualDirectory[] {
    const directory = this.directories.get(directoryPath);
    if (!directory) {
      throw this.createFileSystemError(
        "FILE_NOT_FOUND",
        directoryPath,
        `Directory not found: ${directoryPath}`,
      );
    }

    return directory.children
      .filter((child) => this.directories.has(child))
      .map((path) => this.directories.get(path)!)
      .filter((dir): dir is VirtualDirectory => dir !== undefined);
  }

  /**
   * Gets all files in the file system as a flat Record
   */
  getAllFiles(): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [path, file] of this.files.entries()) {
      result[path] = file.content;
    }
    return result;
  }

  /**
   * Clears all files and directories (except root)
   */
  clear(): void {
    this.files.clear();
    this.directories.clear();
    // Reinitialize root directory
    this.directories.set("/", {
      path: "/",
      children: [],
      parent: null,
    });
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Normalizes a path by removing double slashes and ensuring it starts with /
   */
  private normalizePath(path: string): string {
    // Ensure path starts with /
    if (!path.startsWith("/")) {
      path = "/" + path;
    }

    // Replace multiple consecutive slashes with a single slash
    path = path.replace(/\/+/g, "/");

    // Remove trailing slash unless it's the root
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    return path;
  }

  /**
   * Ensures all parent directories exist for a given path
   */
  private ensureDirectoryPath(filePath: string): void {
    const parentPath = this.getParentPath(filePath);
    if (parentPath !== "/" && !this.directories.has(parentPath)) {
      this.createDirectory(parentPath);
    }
  }

  /**
   * Gets the parent directory path from a file or directory path
   */
  private getParentPath(path: string): string {
    if (path === "/") {
      return "/";
    }

    const normalized = path.startsWith("/") ? path : `/${path}`;

    // Find the last slash
    const lastSlashIndex = normalized.lastIndexOf("/");

    // If there's no slash or it's the first character, parent is root
    if (lastSlashIndex <= 0) {
      return "/";
    }

    // Return everything before the last slash
    return normalized.substring(0, lastSlashIndex);
  }

  /**
   * Validates that a path is not empty and has valid format
   */
  private validatePath(path: string): void {
    if (!path || path.trim().length === 0) {
      throw this.createFileSystemError(
        "INVALID_PATH",
        path,
        "Path cannot be empty",
      );
    }

    // Check for invalid characters
    const invalidChars = /[<>:"|?*\x00-\x1F]/;
    if (invalidChars.test(path)) {
      throw this.createFileSystemError(
        "INVALID_PATH",
        path,
        "Path contains invalid characters",
      );
    }
  }

  /**
   * Validates that a path doesn't exceed maximum nesting depth
   */
  private validateNestingDepth(path: string): void {
    const normalized = path.startsWith("/") ? path : `/${path}`;

    // Count directory separators to determine depth
    // For /dir1/dir2/file.txt, we have 2 directories, so depth is 2
    // Split by '/' and filter out empty strings
    const parts = normalized.split("/").filter((p) => p.length > 0);

    // The depth is the number of directory levels
    // For a file at /a/b/c/file.txt, depth is 3 (a, b, c are directories)
    // For a directory at /a/b/c, depth is 3
    // We count all parts except we need to account that the last part might be a file
    // Since we don't know if it's a file or directory, we'll count all parts
    // and allow up to MAX_NESTING_DEPTH parts
    const depth = parts.length;

    // Allow exactly MAX_NESTING_DEPTH levels
    if (depth > this.MAX_NESTING_DEPTH) {
      throw this.createFileSystemError(
        "INVALID_PATH",
        path,
        `Path exceeds maximum nesting depth of ${this.MAX_NESTING_DEPTH}`,
      );
    }
  }

  /**
   * Detects programming language from file extension
   */
  private detectLanguage(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      css: "css",
      scss: "scss",
      sass: "sass",
      html: "html",
      json: "json",
      md: "markdown",
      py: "python",
      java: "java",
      cpp: "cpp",
      c: "c",
      go: "go",
      rs: "rust",
      rb: "ruby",
      php: "php",
      sql: "sql",
      xml: "xml",
      yaml: "yaml",
      yml: "yaml",
    };
    return languageMap[ext || ""] || "plaintext";
  }

  /**
   * Creates a FileSystemError object
   */
  private createFileSystemError(
    type: FileSystemError["type"],
    path: string,
    message: string,
  ): FileSystemError {
    return {
      type,
      path,
      message,
    };
  }
}
