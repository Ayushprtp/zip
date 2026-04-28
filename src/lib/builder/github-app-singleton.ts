/**
 * GitHub App singleton helper
 *
 * Returns a pre-configured GitHubAppService instance.
 * Also provides a helper to extract the installation_id from cookies.
 * Falls back to persisted tokens in user DB preferences when cookies expire.
 *
 * All API routes should use this instead of constructing the service directly.
 */

import { cookies } from "next/headers";
import { GitHubAppService } from "@/lib/builder/github-app-service";
import { getSession } from "auth/server";
import { userRepository } from "lib/db/repository";

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
 * Get the GitHub user OAuth token — tries cookie first, then DB.
 */
export async function getGitHubToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get("github_token")?.value;
  if (cookieToken) return cookieToken;

  // Fall back to DB-persisted token
  try {
    const session = await getSession();
    if (session?.user?.id) {
      const prefs = await userRepository.getPreferences(session.user.id);
      if (prefs?.githubToken) {
        // Restore cookie from DB
        cookieStore.set("github_token", prefs.githubToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 365,
        });
        return prefs.githubToken;
      }
    }
  } catch {
    // Session/DB not available — that's fine
  }

  return null;
}

/**
 * Get the GitHub App installation ID — tries cookie first, then DB.
 */
export async function getInstallationId(): Promise<number | null> {
  const cookieStore = await cookies();
  const cookieId = cookieStore.get("github_installation_id")?.value;
  if (cookieId) return parseInt(cookieId, 10);

  // Fall back to DB-persisted installation ID
  try {
    const session = await getSession();
    if (session?.user?.id) {
      const prefs = await userRepository.getPreferences(session.user.id);
      if (prefs?.githubInstallationId) {
        // Restore cookie from DB
        cookieStore.set(
          "github_installation_id",
          String(prefs.githubInstallationId),
          {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 365,
          },
        );
        return prefs.githubInstallationId;
      }
    }
  } catch {
    // Session/DB not available
  }

  return null;
}

/**
 * Persist GitHub tokens to the user's DB preferences.
 * Called after GitHub OAuth callback or app installation.
 */
export async function persistGitHubAuth(
  token: string,
  installationId: number,
  username?: string,
): Promise<void> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return;

    const currentPrefs =
      (await userRepository.getPreferences(session.user.id)) || {};
    await userRepository.updatePreferences(session.user.id, {
      ...currentPrefs,
      githubToken: token,
      githubInstallationId: installationId,
      ...(username ? { githubUsername: username } : {}),
    });
  } catch (err) {
    console.warn("[GitHub] Failed to persist auth to DB:", err);
  }
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
  // Try normal user auth first (checks cookie → DB)
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
