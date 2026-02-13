/**
 * GitHub Repositories API
 *
 * Uses the Flare-SH GitHub App installation token to
 * list and create repositories.
 *
 * GET  → List repos accessible to the installation
 * POST → Create a new repository under the installation
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getGitHubApp,
  requireGitHubAuth,
} from "@/lib/builder/github-app-singleton";

export async function GET() {
  try {
    const auth = await requireGitHubAuth();
    const app = getGitHubApp();

    const repos = await app.getInstallationRepositories(auth.installationId);

    return NextResponse.json({ repos });
  } catch (error: any) {
    console.error("List repos error:", error);

    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || "Failed to list repositories" },
      { status },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireGitHubAuth();
    const body = await request.json();

    const { name, description, private: isPrivate, auto_init } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Repository name is required" },
        { status: 400 },
      );
    }

    const app = getGitHubApp();
    const repo = await app.createRepository(
      auth.installationId,
      {
        name,
        description,
        private: isPrivate ?? true,
        auto_init: auto_init ?? true,
      },
      auth.token,
    );

    return NextResponse.json({ repo });
  } catch (error: any) {
    console.error("Create repo error:", error);

    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || "Failed to create repository" },
      { status },
    );
  }
}
