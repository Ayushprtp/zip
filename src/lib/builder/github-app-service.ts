/**
 * GitHub App Service
 *
 * Handles GitHub App authentication and all repository operations.
 * The Flare-SH GitHub App authenticates as an installation (not as the user).
 *
 * Auth flow:
 *   1. App private key → JWT (signed RS256)
 *   2. JWT → Installation access token (1hr, auto-renewed by @octokit/app)
 *   3. Installation token → Octokit client → API calls
 *
 * This service runs SERVER-SIDE only (requires the private key).
 */

import { App } from "@octokit/app";
import { Octokit } from "@octokit/rest";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  clientId: string;
  clientSecret: string;
}

export interface InstallationInfo {
  id: number;
  account: {
    login: string;
    type: string;
    avatar_url?: string;
  };
  repositories?: Array<{
    id: number;
    name: string;
    full_name: string;
    private: boolean;
    description: string | null;
    language: string | null;
    default_branch: string;
  }>;
}

export interface CommitFileEntry {
  path: string;
  content: string;
}

export interface CommitResult {
  sha: string;
  url: string;
  message: string;
  htmlUrl: string;
}

export interface BranchInfo {
  name: string;
  sha: string;
  protected: boolean;
}

// ─── Service ───────────────────────────────────────────────────────────────

export class GitHubAppService {
  private app: App;

  constructor(config: GitHubAppConfig) {
    this.app = new App({
      appId: config.appId,
      privateKey: config.privateKey,
      oauth: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      },
    });
  }

  // ─── Authentication ──────────────────────────────────────────────────

  /**
   * Exchange an OAuth code for a user access token.
   * Used during the GitHub App installation callback.
   */
  async exchangeCodeForToken(code: string): Promise<{
    token: string;
    refreshToken?: string;
    expiresAt?: string;
  }> {
    const { authentication } = await this.app.oauth.createToken({ code });

    return {
      token: authentication.token,
      refreshToken: authentication.refreshToken,
      expiresAt: authentication.expiresAt,
    };
  }

  /**
   * Get an installation access token for the given installation.
   * The @octokit/app SDK handles JWT generation + token caching automatically.
   */
  async getInstallationToken(installationId: number): Promise<string> {
    const auth = (await this.app.octokit.auth({
      type: "installation",
      installationId,
    })) as { token: string };

    return auth.token;
  }

  /**
   * Get an authenticated Octokit instance for the given installation.
   * This is the primary way to make API calls as the Flare-SH GitHub App.
   */
  async getInstallationOctokit(installationId: number): Promise<Octokit> {
    const token = await this.getInstallationToken(installationId);
    return new Octokit({ auth: token });
  }

  // ─── User & Installation Info ────────────────────────────────────────

  /**
   * Get the authenticated user's info given their OAuth token.
   */
  async getAuthenticatedUser(userToken: string) {
    const octokit = new Octokit({ auth: userToken });
    const { data } = await octokit.users.getAuthenticated();
    return data;
  }

  /**
   * List all installations the user has granted the Flare-SH app access to.
   */
  async getUserInstallations(userToken: string): Promise<InstallationInfo[]> {
    const octokit = new Octokit({ auth: userToken });
    const { data } = await octokit.apps.listInstallationsForAuthenticatedUser();

    return data.installations.map((inst) => ({
      id: inst.id,
      account: {
        login: (inst.account as any)?.login || "",
        type: (inst.account as any)?.type || "",
        avatar_url: (inst.account as any)?.avatar_url || "",
      },
    }));
  }

  /**
   * List repositories accessible to the given installation.
   */
  async getInstallationRepositories(installationId: number) {
    const octokit = await this.getInstallationOctokit(installationId);
    const { data } = await octokit.apps.listReposAccessibleToInstallation();
    return data.repositories;
  }

  /**
   * Get app metadata (name, description, etc.)
   */
  async getAppInfo() {
    const { data } = await this.app.octokit.request("GET /app");
    return data;
  }

  /**
   * Get an installation by ID.
   */
  async getInstallation(installationId: number) {
    const { data } = await this.app.octokit.request(
      "GET /app/installations/{installation_id}",
      { installation_id: installationId },
    );
    return data;
  }

  // ─── Repository Operations ───────────────────────────────────────────

  /**
   * Create a new repository under the installation's account.
   * Uses the installation token so the repo is created by the app.
   */
  async createRepository(
    installationId: number,
    options: {
      name: string;
      description?: string;
      private?: boolean;
      auto_init?: boolean;
    },
  ) {
    const octokit = await this.getInstallationOctokit(installationId);

    // Determine if the installation is on a user or org account
    const installation = await this.getInstallation(installationId);
    const accountType = (installation.account as any)?.type;
    const accountLogin = (installation.account as any)?.login;

    if (accountType === "Organization") {
      // Create repo under the org
      const { data } = await octokit.repos.createInOrg({
        org: accountLogin,
        name: options.name,
        description: options.description,
        private: options.private ?? true,
        auto_init: options.auto_init ?? true,
      });
      return data;
    } else {
      // For user accounts, we use the user's token to create (installation tokens can't create user repos)
      // Fall back to creating via the installation with auto_init
      const { data } = await octokit.repos.createForAuthenticatedUser({
        name: options.name,
        description: options.description,
        private: options.private ?? true,
        auto_init: options.auto_init ?? true,
      });
      return data;
    }
  }

  /**
   * Get a repository's info.
   */
  async getRepo(installationId: number, owner: string, repo: string) {
    const octokit = await this.getInstallationOctokit(installationId);
    const { data } = await octokit.repos.get({ owner, repo });
    return data;
  }

  // ─── Branch Operations ───────────────────────────────────────────────

  /**
   * List branches for a repository.
   */
  async listBranches(
    installationId: number,
    owner: string,
    repo: string,
  ): Promise<BranchInfo[]> {
    const octokit = await this.getInstallationOctokit(installationId);
    const { data } = await octokit.repos.listBranches({ owner, repo });

    return data.map((b) => ({
      name: b.name,
      sha: b.commit.sha,
      protected: b.protected,
    }));
  }

  /**
   * Create a new branch from an existing one.
   */
  async createBranch(
    installationId: number,
    owner: string,
    repo: string,
    branchName: string,
    baseBranch: string = "main",
  ): Promise<BranchInfo> {
    const octokit = await this.getInstallationOctokit(installationId);

    // Get the SHA of the base branch
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${baseBranch}`,
    });

    // Create the new branch
    const { data: newRef } = await octokit.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branchName}`,
      sha: ref.object.sha,
    });

    return {
      name: branchName,
      sha: newRef.object.sha,
      protected: false,
    };
  }

  // ─── Git Operations (Commit & Push) ──────────────────────────────────

  /**
   * Commit multiple files to a branch in a single commit.
   * This is the core operation used after AI generates code.
   *
   * Uses the Git Data API (tree + commit + ref update) for atomic commits.
   * All commits are attributed to "Flare Builder AI" as the author.
   */
  async commitFiles(
    installationId: number,
    owner: string,
    repo: string,
    branch: string,
    files: CommitFileEntry[],
    message: string,
  ): Promise<CommitResult> {
    const octokit = await this.getInstallationOctokit(installationId);

    // ① Get current branch HEAD
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    const latestSha = ref.object.sha;

    // ② Get the tree of the current commit
    const { data: currentCommit } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: latestSha,
    });

    // ③ Create blobs for each file
    const treeItems: {
      path: string;
      mode: "100644";
      type: "blob";
      sha: string;
    }[] = [];

    for (const file of files) {
      const path = file.path.startsWith("/") ? file.path.slice(1) : file.path;

      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: file.content,
        encoding: "utf-8",
      });

      treeItems.push({
        path,
        mode: "100644",
        type: "blob",
        sha: blob.sha,
      });
    }

    // ④ Create a new tree
    const { data: tree } = await octokit.git.createTree({
      owner,
      repo,
      base_tree: currentCommit.tree.sha,
      tree: treeItems,
    });

    // ⑤ Create a new commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message: `🤖 ${message}`,
      tree: tree.sha,
      parents: [latestSha],
      author: {
        name: "Flare Builder AI",
        email: "ai@flare.sh",
        date: new Date().toISOString(),
      },
    });

    // ⑥ Update branch HEAD to point to the new commit
    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    return {
      sha: newCommit.sha,
      url: newCommit.url,
      message,
      htmlUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
    };
  }

  /**
   * Delete files from a branch by creating a commit that removes them.
   */
  async deleteFiles(
    installationId: number,
    owner: string,
    repo: string,
    branch: string,
    filePaths: string[],
    message: string,
  ): Promise<CommitResult> {
    const octokit = await this.getInstallationOctokit(installationId);

    // Get current tree
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });

    const { data: currentCommit } = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: ref.object.sha,
    });

    const { data: currentTree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: currentCommit.tree.sha,
      recursive: "true",
    });

    // Build new tree excluding deleted files
    const normalizedPaths = filePaths.map((p) =>
      p.startsWith("/") ? p.slice(1) : p,
    );

    const newTreeItems = currentTree.tree
      .filter(
        (item) => item.type === "blob" && !normalizedPaths.includes(item.path!),
      )
      .map((item) => ({
        path: item.path!,
        mode: item.mode as "100644",
        type: "blob" as const,
        sha: item.sha!,
      }));

    const { data: newTree } = await octokit.git.createTree({
      owner,
      repo,
      tree: newTreeItems,
    });

    const { data: newCommit } = await octokit.git.createCommit({
      owner,
      repo,
      message: `🗑️ ${message}`,
      tree: newTree.sha,
      parents: [ref.object.sha],
      author: {
        name: "Flare Builder AI",
        email: "ai@flare.sh",
        date: new Date().toISOString(),
      },
    });

    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: newCommit.sha,
    });

    return {
      sha: newCommit.sha,
      url: newCommit.url,
      message,
      htmlUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
    };
  }

  /**
   * Force-reset a branch to a specific commit SHA (rollback).
   */
  async resetBranch(
    installationId: number,
    owner: string,
    repo: string,
    branch: string,
    targetSha: string,
  ): Promise<void> {
    const octokit = await this.getInstallationOctokit(installationId);

    await octokit.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: targetSha,
      force: true,
    });
  }

  /**
   * Get the latest commits on a branch.
   */
  async getCommits(
    installationId: number,
    owner: string,
    repo: string,
    branch: string,
    perPage: number = 30,
  ) {
    const octokit = await this.getInstallationOctokit(installationId);
    const { data } = await octokit.repos.listCommits({
      owner,
      repo,
      sha: branch,
      per_page: perPage,
    });
    return data;
  }

  /**
   * Get a file's content from a branch.
   */
  async getFileContent(
    installationId: number,
    owner: string,
    repo: string,
    path: string,
    branch?: string,
  ): Promise<{ content: string; sha: string } | null> {
    const octokit = await this.getInstallationOctokit(installationId);

    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path: path.startsWith("/") ? path.slice(1) : path,
        ref: branch,
      });

      if ("content" in data && data.type === "file") {
        const content = Buffer.from(data.content, "base64").toString("utf-8");
        return { content, sha: data.sha };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get the full tree of a branch (all file paths).
   */
  async getTree(
    installationId: number,
    owner: string,
    repo: string,
    branch: string = "main",
  ) {
    const octokit = await this.getInstallationOctokit(installationId);

    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });

    const { data: tree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: ref.object.sha,
      recursive: "true",
    });

    return tree.tree
      .filter((item) => item.type === "blob")
      .map((item) => ({
        path: item.path!,
        size: item.size,
        sha: item.sha!,
      }));
  }

  // ─── Webhook Verification ────────────────────────────────────────────

  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const crypto = require("crypto");
    const hmac = crypto.createHmac("sha256", secret);
    const digest = "sha256=" + hmac.update(payload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  }
}
