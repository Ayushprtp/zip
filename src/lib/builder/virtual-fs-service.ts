/**
 * Virtual File System Service
 * Manages in-browser file system using IndexedDB via lightning-fs
 */

import FS from "@isomorphic-git/lightning-fs";

export class VirtualFileSystemService {
  private fs: FS;
  private pfs: any;
  private initialized = false;

  constructor(private fsName = "builder-fs") {
    this.fs = new FS(fsName);
    this.pfs = this.fs.promises;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure root directory exists
      await this.ensureDir("/");
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize VFS:", error);
      throw error;
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.ensureDir(this.dirname(path));
    await this.pfs.writeFile(path, content, "utf8");
  }

  async readFile(path: string): Promise<string> {
    const content = await this.pfs.readFile(path, "utf8");
    return content;
  }

  async deleteFile(path: string): Promise<void> {
    await this.pfs.unlink(path);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.pfs.stat(path);
      return true;
    } catch {
      return false;
    }
  }

  async readDir(path: string): Promise<string[]> {
    return await this.pfs.readdir(path);
  }

  async ensureDir(path: string): Promise<void> {
    if (path === "/" || path === "") return;

    const exists = await this.exists(path);
    if (exists) return;

    const parent = this.dirname(path);
    await this.ensureDir(parent);
    await this.pfs.mkdir(path);
  }

  async deleteDir(path: string): Promise<void> {
    const files = await this.readDir(path);
    for (const file of files) {
      const fullPath = `${path}/${file}`;
      const stat = await this.pfs.stat(fullPath);
      if (stat.isDirectory()) {
        await this.deleteDir(fullPath);
      } else {
        await this.deleteFile(fullPath);
      }
    }
    await this.pfs.rmdir(path);
  }

  async syncFromProjectFiles(files: Record<string, string>): Promise<void> {
    await this.initialize();

    // Clear existing files
    const rootFiles = await this.readDir("/");
    for (const file of rootFiles) {
      if (file !== ".git") {
        const fullPath = `/${file}`;
        const stat = await this.pfs.stat(fullPath);
        if (stat.isDirectory()) {
          await this.deleteDir(fullPath);
        } else {
          await this.deleteFile(fullPath);
        }
      }
    }

    // Write new files
    for (const [path, content] of Object.entries(files)) {
      await this.writeFile(path, content);
    }
  }

  async exportToProjectFiles(): Promise<Record<string, string>> {
    const files: Record<string, string> = {};
    await this.collectFiles("/", files);
    return files;
  }

  private async collectFiles(
    dir: string,
    files: Record<string, string>,
  ): Promise<void> {
    const entries = await this.readDir(dir);

    for (const entry of entries) {
      if (entry === ".git") continue;

      const fullPath = dir === "/" ? `/${entry}` : `${dir}/${entry}`;
      const stat = await this.pfs.stat(fullPath);

      if (stat.isDirectory()) {
        await this.collectFiles(fullPath, files);
      } else {
        const content = await this.readFile(fullPath);
        files[fullPath] = content;
      }
    }
  }

  private dirname(path: string): string {
    const parts = path.split("/").filter(Boolean);
    if (parts.length <= 1) return "/";
    parts.pop();
    return "/" + parts.join("/");
  }

  async clear(): Promise<void> {
    // Clear all data
    await this.deleteDir("/");
    await this.ensureDir("/");
  }

  getFS() {
    return this.fs;
  }
}
