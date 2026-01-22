/**
 * GitHub App Installations API
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { GitHubAppService } from "@/lib/builder/github-app-service";

const GITHUB_APP_ID = process.env.GITHUB_APP_ID!;
const GITHUB_APP_PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY!;
const GITHUB_APP_CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID!;
const GITHUB_APP_CLIENT_SECRET = process.env.GITHUB_APP_CLIENT_SECRET!;

async function getGitHubToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get("github_token")?.value || null;
}

export async function GET() {
  try {
    const token = await getGitHubToken();

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const githubApp = new GitHubAppService({
      appId: GITHUB_APP_ID,
      privateKey: GITHUB_APP_PRIVATE_KEY,
      clientId: GITHUB_APP_CLIENT_ID,
      clientSecret: GITHUB_APP_CLIENT_SECRET,
    });

    const installations = await githubApp.getUserInstallations(token);

    return NextResponse.json({ installations });
  } catch (error: any) {
    console.error("Get installations error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get installations" },
      { status: 500 },
    );
  }
}
