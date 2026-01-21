/**
 * GitHub Repositories API
 */

import { NextRequest, NextResponse } from "next/server";
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
    const repos = await github.listRepos();

    return NextResponse.json({ repos });
  } catch (error: any) {
    console.error("List repos error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to list repositories" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = await getGitHubToken();

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    const { name, description, isPrivate } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: "Repository name is required" },
        { status: 400 },
      );
    }

    const github = new GitHubService(token);
    const repo = await github.createRepo({
      name,
      description,
      private: isPrivate ?? true,
      auto_init: false,
    });

    return NextResponse.json({ repo });
  } catch (error: any) {
    console.error("Create repo error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create repository" },
      { status: 500 },
    );
  }
}
