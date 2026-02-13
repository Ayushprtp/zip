/**
 * Git Service
 * In-browser Git operations using isomorphic-git
 */

import git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import type { VirtualFileSystemService } from "./virtual-fs-service";

export interface GitConfig {
  name: string;
  email: string;
}

export interface CommitInfo {
  oid: string;
  message: string;
  author: string;
  timestamp: number;
}

export class GitService {
  private dir = "/";
  private corsProxy = "/api/git-proxy";

  constructor(private vfs: VirtualFileSystemService) {}

  async init(config: GitConfig): Promise<void> {
    await git.init({
      fs: this.vfs.getFS(),
      dir: this.dir,
      defaultBranch: "main",
    });

    await git.setConfig({
      fs: this.vfs.getFS(),
      dir: this.dir,
      path: "user.name",
      value: config.name,
    });

    await git.setConfig({
      fs: this.vfs.getFS(),
      dir: this.dir,
      path: "user.email",
      value: config.email,
    });
  }

  async add(filepath: string = "."): Promise<void> {
    await git.add({
      fs: this.vfs.getFS(),
      dir: this.dir,
      filepath,
    });
  }

  async commit(message: string): Promise<string> {
    const sha = await git.commit({
      fs: this.vfs.getFS(),
      dir: this.dir,
      message,
      author: {
        name: await this.getConfig("user.name"),
        email: await this.getConfig("user.email"),
      },
    });
    return sha;
  }

  async push(
    remote: string = "origin",
    branch: string = "main",
    token: string,
  ): Promise<void> {
    await git.push({
      fs: this.vfs.getFS(),
      http,
      dir: this.dir,
      remote,
      ref: branch,
      corsProxy: this.corsProxy,
      onAuth: () => ({ username: token, password: "x-oauth-basic" }),
    });
  }

  async pull(
    _remote: string = "origin",
    branch: string = "main",
    token: string,
  ): Promise<void> {
    await git.pull({
      fs: this.vfs.getFS(),
      http,
      dir: this.dir,
      ref: branch,
      corsProxy: this.corsProxy,
      onAuth: () => ({ username: token, password: "x-oauth-basic" }),
      author: {
        name: await this.getConfig("user.name"),
        email: await this.getConfig("user.email"),
      },
    });
  }

  async clone(url: string, token: string): Promise<void> {
    await git.clone({
      fs: this.vfs.getFS(),
      http,
      dir: this.dir,
      url,
      corsProxy: this.corsProxy,
      onAuth: () => ({ username: token, password: "x-oauth-basic" }),
      singleBranch: true,
      depth: 1,
    });
  }

  async addRemote(name: string, url: string): Promise<void> {
    await git.addRemote({
      fs: this.vfs.getFS(),
      dir: this.dir,
      remote: name,
      url,
    });
  }

  async log(depth: number = 50): Promise<CommitInfo[]> {
    const commits = await git.log({
      fs: this.vfs.getFS(),
      dir: this.dir,
      depth,
    });

    return commits.map((commit) => ({
      oid: commit.oid,
      message: commit.commit.message,
      author: commit.commit.author.name,
      timestamp: commit.commit.author.timestamp * 1000,
    }));
  }

  async checkout(ref: string): Promise<void> {
    await git.checkout({
      fs: this.vfs.getFS(),
      dir: this.dir,
      ref,
    });
  }

  async resetHard(ref: string): Promise<void> {
    await git.checkout({
      fs: this.vfs.getFS(),
      dir: this.dir,
      ref,
      force: true,
    });
  }

  async status(): Promise<string[]> {
    const FILE = 0,
      WORKDIR = 2,
      STAGE = 3;
    const statuses = await git.statusMatrix({
      fs: this.vfs.getFS(),
      dir: this.dir,
    });

    return statuses
      .filter((row) => row[WORKDIR] !== row[STAGE])
      .map((row) => row[FILE]);
  }

  async hasChanges(): Promise<boolean> {
    const changes = await this.status();
    return changes.length > 0;
  }

  async getCurrentBranch(): Promise<string> {
    return (
      (await git.currentBranch({
        fs: this.vfs.getFS(),
        dir: this.dir,
        fullname: false,
      })) || "main"
    );
  }

  async listBranches(): Promise<string[]> {
    return await git.listBranches({
      fs: this.vfs.getFS(),
      dir: this.dir,
    });
  }

  async createBranch(name: string): Promise<void> {
    await git.branch({
      fs: this.vfs.getFS(),
      dir: this.dir,
      ref: name,
    });
  }

  async deleteBranch(name: string): Promise<void> {
    await git.deleteBranch({
      fs: this.vfs.getFS(),
      dir: this.dir,
      ref: name,
    });
  }

  private async getConfig(path: string): Promise<string> {
    return (
      (await git.getConfig({
        fs: this.vfs.getFS(),
        dir: this.dir,
        path,
      })) || ""
    );
  }

  async isInitialized(): Promise<boolean> {
    try {
      await this.vfs.exists("/.git");
      return true;
    } catch {
      return false;
    }
  }
}
