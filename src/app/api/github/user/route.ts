/**
 * GitHub User API
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { GitHubService } from "@/lib/builder/github-service";

async function getGitHubToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("github_token")?.value || null;
}

export async function GET() {
  try {
    const token = await getGitHubToken();

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const github = new GitHubService(token);
    const user = await github.getAuthenticatedUser();

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get user" },
      { status: 500 },
    );
  }
}
