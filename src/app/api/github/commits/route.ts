/**
 * GitHub Commits API
 *
 * GET /api/github/commits?owner=...&repo=...&branch=...
 *
 * Lists recent commits for a repo. Supports both user-authenticated
 * repos and temp workspaces.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getGitHubApp,
  requireGitHubAuthOrTemp,
} from "@/lib/builder/github-app-singleton";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const branch = searchParams.get("branch") || "main";

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Missing required query params: owner, repo" },
        { status: 400 },
      );
    }

    const auth = await requireGitHubAuthOrTemp(owner, repo);
    const app = getGitHubApp();

    const raw = await app.getCommits(
      auth.installationId,
      owner,
      repo,
      branch,
    );

    // Map to the shape the SourceControlPanel expects
    const commits = raw.map((c: any) => ({
      sha: c.sha,
      message: c.commit?.message || "",
      date: c.commit?.author?.date || c.commit?.committer?.date || "",
      author: c.commit?.author?.name || c.author?.login || "unknown",
    }));

    return NextResponse.json(commits);
  } catch (error: any) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || "Failed to list commits" },
      { status },
    );
  }
}
