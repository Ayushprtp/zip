/**
 * Temporary Workspace Service
 *
 * Creates short-lived private repositories under the Flare-SH account
 * for users who haven't connected their own GitHub account.
 *
 * Uses a Personal Access Token (FLARE_TEMP_REPO_TOKEN) to create repos,
 * since GitHub Apps cannot create repos on user accounts (only orgs).
 *
 * Features:
 *   - Creates private repos under the Flare-SH account with a unique name
 *   - Supports full features: deployment, commits, checkpoints, source control
 *   - Auto-expires after 16 hours
 *   - Marks repos with a "temp-workspace" topic for cleanup
 *   - Stores expiry metadata in the repo description
 *
 * How cleanup works:
 *   - A cron job (or API route) runs periodically to find repos with "temp-workspace"
 *     topic that have expired, and deletes them.
 *   - The expiry timestamp is embedded in the repo description.
 */

import { Octokit } from "@octokit/core";
import { getGitHubApp } from "./github-app-singleton";

// ─── Constants ────────────────────────────────────────────────────────────

/** How long a temp workspace lives (16 hours in milliseconds) */
export const TEMP_WORKSPACE_TTL_MS = 16 * 60 * 60 * 1000;

/** Topic used to mark temp workspace repos for cleanup */
export const TEMP_WORKSPACE_TOPIC = "flare-temp-workspace";

/** Prefix for temp workspace repo names */
export const TEMP_WORKSPACE_PREFIX = "tmp-";

/** The Flare-SH account that owns temp workspaces */
const FLARE_ORG =
  process.env.FLARE_TEMP_WORKSPACE_ORG || "Flare-SH";

/**
 * PAT with `repo` and `delete_repo` scopes for the Flare-SH account.
 * Required because GitHub Apps cannot create repos on user accounts.
 */
const FLARE_TEMP_REPO_TOKEN = process.env.FLARE_TEMP_REPO_TOKEN || null;

/** Installation ID (still used for commit/branch operations via the App) */
const FLARE_ORG_INSTALLATION_ID = process.env.FLARE_ORG_INSTALLATION_ID
  ? parseInt(process.env.FLARE_ORG_INSTALLATION_ID, 10)
  : null;

// ─── Types ────────────────────────────────────────────────────────────────

export interface TempWorkspaceConfig {
  projectName: string;
  framework?: string;
}

export interface TempWorkspaceResult {
  id: string;
  repoOwner: string;
  repoName: string;
  repoFullName: string;
  defaultBranch: string;
  expiresAt: string; // ISO timestamp
  isTemporary: true;
}

// ─── Service ──────────────────────────────────────────────────────────────

class TempWorkspaceService {
  /**
   * Create a new temporary workspace repository.
   * Uses a PAT to create the repo (GitHub Apps can't create repos on user accounts).
   */
  async createTempWorkspace(
    config: TempWorkspaceConfig,
  ): Promise<TempWorkspaceResult> {
    if (!FLARE_TEMP_REPO_TOKEN) {
      throw new Error(
        "FLARE_TEMP_REPO_TOKEN not set. Add a GitHub PAT with `repo` and `delete_repo` scopes to .env. " +
        "This is required because GitHub Apps cannot create repos on user accounts (Flare-SH is a user, not an org).",
      );
    }

    // Use PAT-based Octokit for repo creation
    const octokit = new Octokit({ auth: FLARE_TEMP_REPO_TOKEN });

    // Generate unique repo name
    const suffix = this.generateSuffix();
    const repoName = `${TEMP_WORKSPACE_PREFIX}${config.projectName || "workspace"}-${suffix}`;

    // Calculate expiry
    const expiresAt = new Date(Date.now() + TEMP_WORKSPACE_TTL_MS);
    const expiresAtIso = expiresAt.toISOString();

    // Create the repo using the PAT (works for user accounts)
    let repo: any;
    try {
      const { data } = await octokit.request("POST /user/repos", {
        name: repoName,
        description: `⏳ Temporary workspace — expires at ${expiresAtIso} | FLARE_TEMP_EXPIRES=${expiresAtIso}`,
        private: true,
        auto_init: true,
        has_issues: false,
        has_wiki: false,
        has_projects: false,
      });
      repo = data;
    } catch (err: any) {
      if (err.status === 403) {
        const isFineGrained = FLARE_TEMP_REPO_TOKEN!.startsWith("github_pat_");
        const hint = isFineGrained
          ? "Your FLARE_TEMP_REPO_TOKEN is a fine-grained PAT. To create repos, " +
            "regenerate it with: Account permissions → Administration: Read and write, " +
            "AND Repository permissions → Contents: Read and write."
          : "Your FLARE_TEMP_REPO_TOKEN (classic PAT) is missing the `repo` scope. " +
            "Regenerate it at https://github.com/settings/tokens with the `repo` scope checked.";
        throw new Error(
          `Cannot create temporary repo: token lacks permission. ${hint}`,
        );
      }
      throw err;
    }

    // Add the temp-workspace topic for cleanup discovery
    try {
      await octokit.request("PUT /repos/{owner}/{repo}/topics", {
        owner: repo.owner?.login || FLARE_ORG,
        repo: repo.name,
        names: [TEMP_WORKSPACE_TOPIC],
      });
    } catch (topicError) {
      // Non-fatal — we can still clean up by description
      console.warn("[TempWorkspace] Failed to set topic:", topicError);
    }

    return {
      id: `temp-${suffix}`,
      repoOwner: repo.owner?.login || FLARE_ORG,
      repoName: repo.name,
      repoFullName: repo.full_name,
      defaultBranch: repo.default_branch || "main",
      expiresAt: expiresAtIso,
      isTemporary: true,
    };
  }

  /**
   * Clean up expired temporary workspace repos.
   * Uses the PAT to delete repos.
   */
  async cleanupExpiredWorkspaces(): Promise<{ deleted: number; errors: number }> {
    if (!FLARE_TEMP_REPO_TOKEN) {
      throw new Error("FLARE_TEMP_REPO_TOKEN not set");
    }

    const octokit = new Octokit({ auth: FLARE_TEMP_REPO_TOKEN });

    let deleted = 0;
    let errors = 0;

    try {
      // List all repos with the temp-workspace topic
      const { data: searchResults } = await octokit.request(
        "GET /search/repositories",
        {
          q: `topic:${TEMP_WORKSPACE_TOPIC} user:${FLARE_ORG}`,
          per_page: 100,
        },
      );

      const now = Date.now();

      for (const repo of searchResults.items) {
        try {
          // Extract expiry from description
          const match = repo.description?.match(
            /FLARE_TEMP_EXPIRES=([^\s|]+)/,
          );
          if (!match) continue;

          const expiresAtMs = new Date(match[1]).getTime();
          if (isNaN(expiresAtMs) || expiresAtMs > now) continue;

          // Repo has expired — delete it
          await octokit.request("DELETE /repos/{owner}/{repo}", {
            owner: repo.owner?.login || FLARE_ORG,
            repo: repo.name,
          });

          deleted++;
          console.log(
            `[TempWorkspace] Deleted expired repo: ${repo.full_name}`,
          );
        } catch (repoError) {
          errors++;
          console.error(
            `[TempWorkspace] Failed to delete repo ${repo.full_name}:`,
            repoError,
          );
        }
      }
    } catch (searchError) {
      console.error("[TempWorkspace] Cleanup search failed:", searchError);
      errors++;
    }

    return { deleted, errors };
  }

  /**
   * Get remaining time for a temp workspace.
   */
  getRemainingTime(expiresAt: string): {
    hours: number;
    minutes: number;
    expired: boolean;
    formatted: string;
  } {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      return { hours: 0, minutes: 0, expired: true, formatted: "Expired" };
    }

    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

    return {
      hours,
      minutes,
      expired: false,
      formatted: `${hours}h ${minutes}m remaining`,
    };
  }

  /**
   * Check if a repo name indicates a temp workspace.
   */
  isTempWorkspace(repoName: string): boolean {
    return repoName.startsWith(TEMP_WORKSPACE_PREFIX);
  }

  /**
   * Get the installation ID for the Flare-SH account.
   * Used for branch/commit operations (which DO work with GitHub App tokens).
   */
  async getOrgInstallationId(): Promise<number> {
    if (FLARE_ORG_INSTALLATION_ID) return FLARE_ORG_INSTALLATION_ID;

    // Try to find the installation dynamically
    try {
      const app = getGitHubApp();
      const appOctokit = (app as any).app;
      if (appOctokit?.eachInstallation) {
        let orgInstId: number | null = null;
        await appOctokit.eachInstallation(
          ({ installation }: { installation: any }) => {
            if (installation.account?.login === FLARE_ORG) {
              orgInstId = installation.id;
            }
          },
        );
        if (orgInstId) return orgInstId;
      }
    } catch {
      // Fall through
    }

    throw new Error(
      `FLARE_ORG_INSTALLATION_ID env var not set and could not auto-detect installation for "${FLARE_ORG}". ` +
        "Set FLARE_ORG_INSTALLATION_ID in your .env file.",
    );
  }

  private generateSuffix(): string {
    // Random 6-char hex suffix
    const hex = Math.random().toString(16).slice(2, 8);
    return `${hex}`;
  }
}

export const tempWorkspaceService = new TempWorkspaceService();
