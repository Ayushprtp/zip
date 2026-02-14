/**
 * GitHub App singleton helper
 *
 * Returns a pre-configured GitHubAppService instance.
 * Also provides a helper to extract the installation_id from cookies.
 *
 * All API routes should use this instead of constructing the service directly.
 */

import { cookies } from "next/headers";
import { GitHubAppService } from "@/lib/builder/github-app-service";

let _appService: GitHubAppService | null = null;

/**
 * Get the GitHubAppService singleton.
 * Throws if env vars are not set.
 */
export function getGitHubApp(): GitHubAppService {
  if (_appService) return _appService;

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;

  if (!appId || !privateKey || !clientId || !clientSecret) {
    throw new Error(
      "Missing GitHub App environment variables. Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_CLIENT_ID, and GITHUB_APP_CLIENT_SECRET.",
    );
  }

  _appService = new GitHubAppService({
    appId,
    // Private key may be base64-encoded in env (common for multi-line PEM)
    privateKey: privateKey.includes("BEGIN")
      ? privateKey
      : Buffer.from(privateKey, "base64").toString("utf-8"),
    clientId,
    clientSecret,
  });

  return _appService;
}

/**
 * Get the GitHub user OAuth token from cookies.
 */
export async function getGitHubToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("github_token")?.value || null;
}

/**
 * Get the GitHub App installation ID from cookies.
 */
export async function getInstallationId(): Promise<number | null> {
  const cookieStore = await cookies();
  const id = cookieStore.get("github_installation_id")?.value;
  return id ? parseInt(id, 10) : null;
}

/**
 * Require both a user token and installation ID.
 * Returns them or throws an HTTP-friendly error object.
 */
export async function requireGitHubAuth(): Promise<{
  token: string;
  installationId: number;
}> {
  const token = await getGitHubToken();
  if (!token) {
    throw { status: 401, message: "Not authenticated with GitHub" };
  }

  const installationId = await getInstallationId();
  if (!installationId) {
    throw {
      status: 403,
      message:
        "No GitHub App installation found. Please install the Flare-SH GitHub App first.",
    };
  }

  return { token, installationId };
}

/**
 * Check if a repo is a Flare-managed temp workspace.
 */
export function isTempWorkspaceRepo(owner?: string, repo?: string): boolean {
  const flareOrg = process.env.FLARE_TEMP_WORKSPACE_ORG || "Flare-SH";
  return (
    !!owner &&
    !!repo &&
    owner.toLowerCase() === flareOrg.toLowerCase() &&
    repo.startsWith("tmp-")
  );
}

/**
 * Require GitHub auth — with temp-workspace fallback.
 *
 * For temp workspace repos, the user has no GitHub OAuth cookie because
 * they skipped GitHub login. In that case we use the org-level PAT and
 * the GitHub App installation ID to operate on the repo.
 */
export async function requireGitHubAuthOrTemp(
  owner?: string,
  repo?: string,
): Promise<{ token: string; installationId: number }> {
  // Try normal user auth first
  const token = await getGitHubToken();
  const installationId = await getInstallationId();
  if (token && installationId) {
    return { token, installationId };
  }

  // Fall back to temp workspace auth
  if (isTempWorkspaceRepo(owner, repo)) {
    const tempToken = process.env.FLARE_TEMP_REPO_TOKEN;
    const orgInstallationId = process.env.FLARE_ORG_INSTALLATION_ID
      ? parseInt(process.env.FLARE_ORG_INSTALLATION_ID, 10)
      : null;

    if (!tempToken) {
      throw {
        status: 500,
        message:
          "Temp workspace token (FLARE_TEMP_REPO_TOKEN) is not configured.",
      };
    }
    if (!orgInstallationId) {
      throw {
        status: 500,
        message:
          "Org installation ID (FLARE_ORG_INSTALLATION_ID) is not configured.",
      };
    }

    return { token: tempToken, installationId: orgInstallationId };
  }

  // Neither path worked
  if (!token) {
    throw { status: 401, message: "Not authenticated with GitHub" };
  }
  throw {
    status: 403,
    message:
      "No GitHub App installation found. Please install the Flare-SH GitHub App first.",
  };
}
