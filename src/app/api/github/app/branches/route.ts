/**
 * GitHub App — Branch Operations API
 *
 * POST /api/github/app/branches  → Create a new branch
 * GET  /api/github/app/branches  → List branches for a repo
 *
 * Body (POST): {
 *   owner: string,
 *   repo: string,
 *   branchName: string,
 *   baseBranch: string  // defaults to "main"
 * }
 *
 * Query (GET): ?owner=...&repo=...
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getGitHubApp,
  requireGitHubAuth,
} from "@/lib/builder/github-app-singleton";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireGitHubAuth();
    const { searchParams } = request.nextUrl;
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Missing required query params: owner, repo" },
        { status: 400 },
      );
    }

    const app = getGitHubApp();
    const branches = await app.listBranches(auth.installationId, owner, repo);

    return NextResponse.json({ branches });
  } catch (error: any) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || "Failed to list branches" },
      { status },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireGitHubAuth();
    const body = await request.json();
    const { owner, repo, branchName, baseBranch = "main" } = body;

    if (!owner || !repo || !branchName) {
      return NextResponse.json(
        { error: "Missing required fields: owner, repo, branchName" },
        { status: 400 },
      );
    }

    const app = getGitHubApp();
    const branch = await app.createBranch(
      auth.installationId,
      owner,
      repo,
      branchName,
      baseBranch,
    );

    return NextResponse.json({ branch });
  } catch (error: any) {
    // If branch already exists, return 422 with specific message
    if (error.status === 422) {
      return NextResponse.json(
        { error: "Branch already exists", exists: true },
        { status: 422 },
      );
    }

    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || "Failed to create branch" },
      { status },
    );
  }
}
