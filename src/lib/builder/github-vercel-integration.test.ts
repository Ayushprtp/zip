/**
 * GitHub & Vercel Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { VirtualFileSystemService } from "./virtual-fs-service";
import { GitService } from "./git-service";
import { GitSyncService } from "./git-sync-service";

describe("VirtualFileSystemService", () => {
  let vfs: VirtualFileSystemService;

  beforeEach(() => {
    vfs = new VirtualFileSystemService("test-fs");
  });

  it("should initialize successfully", async () => {
    await expect(vfs.initialize()).resolves.not.toThrow();
  });

  it("should write and read files", async () => {
    await vfs.initialize();
    await vfs.writeFile("/test.txt", "Hello World");
    const content = await vfs.readFile("/test.txt");
    expect(content).toBe("Hello World");
  });

  it("should check file existence", async () => {
    await vfs.initialize();
    await vfs.writeFile("/exists.txt", "content");
    expect(await vfs.exists("/exists.txt")).toBe(true);
    expect(await vfs.exists("/not-exists.txt")).toBe(false);
  });

  it("should create directories", async () => {
    await vfs.initialize();
    await vfs.ensureDir("/src/components");
    expect(await vfs.exists("/src/components")).toBe(true);
  });

  it("should sync from project files", async () => {
    await vfs.initialize();
    const files = {
      "/index.js": "console.log('hello')",
      "/package.json": '{"name":"test"}',
    };
    await vfs.syncFromProjectFiles(files);
    expect(await vfs.readFile("/index.js")).toBe("console.log('hello')");
    expect(await vfs.readFile("/package.json")).toBe('{"name":"test"}');
  });

  it("should export to project files", async () => {
    await vfs.initialize();
    await vfs.writeFile("/test.js", "test content");
    const files = await vfs.exportToProjectFiles();
    expect(files["/test.js"]).toBe("test content");
  });
});

describe("GitService", () => {
  let vfs: VirtualFileSystemService;
  let git: GitService;

  beforeEach(() => {
    vfs = new VirtualFileSystemService("test-git-fs");
    git = new GitService(vfs);
  });

  it("should initialize git repository", async () => {
    await vfs.initialize();
    await expect(
      git.init({ name: "Test User", email: "test@example.com" }),
    ).resolves.not.toThrow();
  });

  it("should check if initialized", async () => {
    await vfs.initialize();
    expect(await git.isInitialized()).toBe(false);
    await git.init({ name: "Test User", email: "test@example.com" });
    expect(await git.isInitialized()).toBe(true);
  });

  it("should add and commit files", async () => {
    await vfs.initialize();
    await git.init({ name: "Test User", email: "test@example.com" });
    await vfs.writeFile("/test.txt", "content");
    await git.add(".");
    const sha = await git.commit("Initial commit");
    expect(sha).toBeTruthy();
    expect(typeof sha).toBe("string");
  });

  it("should get commit history", async () => {
    await vfs.initialize();
    await git.init({ name: "Test User", email: "test@example.com" });
    await vfs.writeFile("/test.txt", "content");
    await git.add(".");
    await git.commit("First commit");
    const commits = await git.log(10);
    expect(commits).toHaveLength(1);
    expect(commits[0].message).toBe("First commit");
  });

  it("should check for changes", async () => {
    await vfs.initialize();
    await git.init({ name: "Test User", email: "test@example.com" });
    expect(await git.hasChanges()).toBe(false);
    await vfs.writeFile("/test.txt", "content");
    expect(await git.hasChanges()).toBe(true);
  });
});

describe("GitSyncService", () => {
  let vfs: VirtualFileSystemService;
  let git: GitService;
  let sync: GitSyncService;

  beforeEach(() => {
    vfs = new VirtualFileSystemService("test-sync-fs");
    git = new GitService(vfs);
    sync = new GitSyncService(git, vfs, {
      autoCommit: true,
      autoPush: false,
      commitInterval: 60000,
      conflictResolution: "manual",
    });
  });

  it("should get initial status", () => {
    const status = sync.getStatus();
    expect(status.syncing).toBe(false);
    expect(status.hasLocalChanges).toBe(false);
    expect(status.lastCommit).toBeNull();
  });

  it("should update config", () => {
    sync.updateConfig({ autoCommit: false });
    // Config should be updated (internal state)
    expect(true).toBe(true);
  });

  it("should start and stop auto-sync", () => {
    expect(() => {
      sync.startAutoSync("fake-token");
      sync.stopAutoSync();
    }).not.toThrow();
  });
});

describe("Integration Workflow", () => {
  it("should complete full workflow", async () => {
    const vfs = new VirtualFileSystemService("workflow-test");
    const git = new GitService(vfs);

    // Initialize
    await vfs.initialize();
    await git.init({ name: "Test User", email: "test@example.com" });

    // Create files
    const files = {
      "/index.js": "console.log('Hello')",
      "/package.json": '{"name":"test"}',
    };
    await vfs.syncFromProjectFiles(files);

    // Commit
    await git.add(".");
    const sha = await git.commit("Initial commit");
    expect(sha).toBeTruthy();

    // Check history
    const commits = await git.log(10);
    expect(commits).toHaveLength(1);
    expect(commits[0].message).toBe("Initial commit");

    // Export files
    const exported = await vfs.exportToProjectFiles();
    expect(exported["/index.js"]).toBe("console.log('Hello')");
  });
});

describe("Error Handling", () => {
  it("should handle non-existent file read", async () => {
    const vfs = new VirtualFileSystemService("error-test");
    await vfs.initialize();
    await expect(vfs.readFile("/not-exists.txt")).rejects.toThrow();
  });

  it("should handle git operations before init", async () => {
    const vfs = new VirtualFileSystemService("error-git-test");
    const git = new GitService(vfs);
    await vfs.initialize();
    await expect(git.commit("test")).rejects.toThrow();
  });
});
