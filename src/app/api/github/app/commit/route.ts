/**
 * GitHub App — Commit Files API
 *
 * POST /api/github/app/commit
 *
 * Commits files to a repo using the Flare-SH GitHub App's installation token.
 * Used by the builder after AI generates code changes.
 *
 * Author email resolution:
 *   - Temp workspace repos (Flare-SH org) → flare-sh@outlook.com
 *   - User-connected repos → user's GitHub email (fetched via OAuth token)
 *
 * Body: {
 *   owner: string,
 *   repo: string,
 *   branch: string,
 *   files: Array<{ path: string, content: string }>,
 *   message: string,
 *   installationId?: number  // optional override
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getGitHubApp,
  getGitHubToken,
  isTempWorkspaceRepo,
  requireGitHubAuthOrTemp,
} from "@/lib/builder/github-app-singleton";
import { Octokit } from "@octokit/rest";

/**
 * Resolve the commit author email:
 *   - For temp workspace repos → default Flare-SH email
 *   - For user-connected repos → fetch the user's GitHub email via their OAuth token
 */
async function resolveAuthorEmail(
  owner?: string,
  repo?: string,
): Promise<string | undefined> {
  // Temp workspace → use default (undefined triggers fallback in service)
  if (isTempWorkspaceRepo(owner, repo)) {
    return undefined;
  }

  // Try to get user's GitHub email from their OAuth token
  try {
    const userToken = await getGitHubToken();
    if (userToken) {
      const octokit = new Octokit({ auth: userToken });
      const { data: user } = await octokit.users.getAuthenticated();

      // Primary email from profile
      if (user.email) {
        return user.email;
      }

      // If profile email is private, fetch from emails API
      const { data: emails } = await octokit.users.listEmailsForAuthenticatedUser();
      const primary = emails.find((e) => e.primary && e.verified);
      if (primary) {
        return primary.email;
      }

      // Fall back to any verified email
      const verified = emails.find((e) => e.verified);
      if (verified) {
        return verified.email;
      }
    }
  } catch (err) {
    console.warn("[Commit] Could not resolve user email, using default:", err);
  }

  // No user token or email found → undefined triggers default in service
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { owner, repo, branch, files, message, installationId } = body;
    const auth = await requireGitHubAuthOrTemp(owner, repo);

    if (!owner || !repo || !branch || !files || !message) {
      return NextResponse.json(
        {
          error: "Missing required fields: owner, repo, branch, files, message",
        },
        { status: 400 },
      );
    }

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "files must be a non-empty array" },
        { status: 400 },
      );
    }

    const app = getGitHubApp();
    const instId = installationId || auth.installationId;

    // Resolve author email based on project type
    const authorEmail = await resolveAuthorEmail(owner, repo);

    const result = await app.commitFiles(
      instId,
      owner,
      repo,
      branch,
      files,
      message,
      authorEmail,
    );

    return NextResponse.json({
      sha: result.sha,
      url: result.htmlUrl,
      message: result.message,
    });
  } catch (error: any) {
    console.error("Commit error:", error);

    const status = error.status || 500;
    const message = error.message || "Failed to commit files";

    return NextResponse.json({ error: message }, { status });
  }
}
