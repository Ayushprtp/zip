/**
 * GitHub App — Commit Files API
 *
 * POST /api/github/app/commit
 *
 * Commits files to a repo using the Flare-SH GitHub App's installation token.
 * Used by the builder after AI generates code changes.
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
  requireGitHubAuthOrTemp,
} from "@/lib/builder/github-app-singleton";

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

    const result = await app.commitFiles(
      instId,
      owner,
      repo,
      branch,
      files,
      message,
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
