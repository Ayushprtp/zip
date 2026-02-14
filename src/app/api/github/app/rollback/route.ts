/**
 * GitHub App — Rollback API
 *
 * POST /api/github/app/rollback
 *
 * Force-resets a branch to a specific commit SHA.
 * Used when the user wants to undo AI changes.
 *
 * Body: {
 *   owner: string,
 *   repo: string,
 *   branch: string,
 *   targetSha: string
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
    const { owner, repo, branch, targetSha } = body;
    const auth = await requireGitHubAuthOrTemp(owner, repo);

    if (!owner || !repo || !branch || !targetSha) {
      return NextResponse.json(
        { error: "Missing required fields: owner, repo, branch, targetSha" },
        { status: 400 },
      );
    }

    const app = getGitHubApp();
    await app.resetBranch(auth.installationId, owner, repo, branch, targetSha);

    return NextResponse.json({
      success: true,
      message: `Branch ${branch} reset to ${targetSha.slice(0, 7)}`,
    });
  } catch (error: any) {
    console.error("Rollback error:", error);

    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || "Failed to rollback" },
      { status },
    );
  }
}
