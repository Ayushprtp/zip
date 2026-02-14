/**
 * Temporary Workspace API
 *
 * POST → Create a temporary private repository under the Flare-SH org
 *
 * No user GitHub auth required — the Flare-SH GitHub App creates the repo
 * under its own organization. The repo auto-deletes after 16 hours.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/server";
import { tempWorkspaceService } from "@/lib/builder/temp-workspace-service";

export async function POST(request: NextRequest) {
  try {
    // Require app-level auth (user must be logged in to the site)
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Please log in to create a workspace" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { projectName, framework } = body;

    if (!projectName?.trim()) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 },
      );
    }

    // Sanitize project name
    const sanitized = projectName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30);

    const result = await tempWorkspaceService.createTempWorkspace({
      projectName: sanitized,
      framework,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Create temp workspace error:", error);

    return NextResponse.json(
      {
        error:
          error.message || "Failed to create temporary workspace",
      },
      { status: error.status || 500 },
    );
  }
}
