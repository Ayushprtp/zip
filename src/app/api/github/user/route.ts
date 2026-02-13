/**
 * GitHub User API
 *
 * Returns the authenticated GitHub user's profile.
 * Uses the OAuth token stored in httpOnly cookies.
 */

import { NextResponse } from "next/server";
import {
  getGitHubApp,
  getGitHubToken,
} from "@/lib/builder/github-app-singleton";

export async function GET() {
  try {
    const token = await getGitHubToken();

    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const app = getGitHubApp();
    const user = await app.getAuthenticatedUser(token);

    return NextResponse.json({
      login: user.login,
      name: user.name,
      avatar_url: user.avatar_url,
      email: user.email,
      html_url: user.html_url,
    });
  } catch (error: any) {
    console.error("Get user error:", error);

    return NextResponse.json(
      { error: error.message || "Failed to get user info" },
      { status: 500 },
    );
  }
}
