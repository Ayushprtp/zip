/**
 * GitHub App Installations API
 *
 * GET → List installations for the authenticated user
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
    const installations = await app.getUserInstallations(token);

    return NextResponse.json({ installations });
  } catch (error: any) {
    console.error("Get installations error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get installations" },
      { status: 500 },
    );
  }
}
