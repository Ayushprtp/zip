/**
 * Temporary Workspace Cleanup API
 *
 * POST → Clean up all expired temporary repos
 *
 * This should be called by a cron job (e.g., every hour).
 * Optionally protected by a secret token.
 */

import { NextRequest, NextResponse } from "next/server";
import { tempWorkspaceService } from "@/lib/builder/temp-workspace-service";

const CLEANUP_SECRET = process.env.TEMP_WORKSPACE_CLEANUP_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Optional: verify cleanup secret
    if (CLEANUP_SECRET) {
      const auth = request.headers.get("authorization");
      if (auth !== `Bearer ${CLEANUP_SECRET}`) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 },
        );
      }
    }

    const result = await tempWorkspaceService.cleanupExpiredWorkspaces();

    return NextResponse.json({
      success: true,
      deleted: result.deleted,
      errors: result.errors,
    });
  } catch (error: any) {
    console.error("Temp workspace cleanup error:", error);
    return NextResponse.json(
      { error: error.message || "Cleanup failed" },
      { status: 500 },
    );
  }
}
