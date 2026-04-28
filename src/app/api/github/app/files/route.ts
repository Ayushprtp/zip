/**
 * GitHub App — Pull Repository Files API
 *
 * GET /api/github/app/files?owner=X&repo=Y&branch=Z
 *
 * Fetches all files from a GitHub repo using the Flare-SH GitHub App.
 * Used when opening a builder thread to pull the latest code from GitHub.
 *
 * Returns: { files: Record<string, string> }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getGitHubApp,
  requireGitHubAuthOrTemp,
} from "@/lib/builder/github-app-singleton";

// Skip binary files and large files
const SKIP_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".svg",
  ".webp",
  ".avif",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".mp3",
  ".mp4",
  ".wav",
  ".ogg",
  ".webm",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".7z",
  ".rar",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".lock",
]);

const SKIP_PATHS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".cache",
  "__pycache__",
  ".DS_Store",
  "Thumbs.db",
]);

const MAX_FILE_SIZE = 100_000; // 100KB per file
const MAX_FILES = 200; // Don't pull more than 200 files

function shouldSkipFile(path: string, size?: number): boolean {
  if (size && size > MAX_FILE_SIZE) return true;

  const ext = "." + path.split(".").pop()?.toLowerCase();
  if (SKIP_EXTENSIONS.has(ext)) return true;

  const parts = path.split("/");
  return parts.some((part) => SKIP_PATHS.has(part));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    const branch = searchParams.get("branch") || "main";

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "Missing required params: owner, repo" },
        { status: 400 },
      );
    }

    const auth = await requireGitHubAuthOrTemp(owner, repo);
    const app = getGitHubApp();
    const instId = auth.installationId;

    // 1. Get the full file tree
    const tree = await app.getTree(instId, owner, repo, branch);

    // 2. Filter out binary/large/skippable files
    const filesToFetch = tree
      .filter((item) => !shouldSkipFile(item.path, item.size))
      .slice(0, MAX_FILES);

    // 3. Fetch file contents in parallel (batched)
    const files: Record<string, string> = {};
    const BATCH_SIZE = 20;

    for (let i = 0; i < filesToFetch.length; i += BATCH_SIZE) {
      const batch = filesToFetch.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const result = await app.getFileContent(
            instId,
            owner,
            repo,
            item.path,
            branch,
          );
          if (result) {
            // Normalize path to start with /
            const normalizedPath = item.path.startsWith("/")
              ? item.path
              : "/" + item.path;
            files[normalizedPath] = result.content;
          }
        }),
      );

      // Log any failures (but don't fail the whole request)
      results.forEach((r, idx) => {
        if (r.status === "rejected") {
          console.warn(
            `[GitHubFiles] Failed to fetch ${batch[idx].path}:`,
            r.reason?.message,
          );
        }
      });
    }

    return NextResponse.json({
      files,
      totalInRepo: tree.length,
      fetched: Object.keys(files).length,
      branch,
    });
  } catch (error: any) {
    console.error("GitHub fetch files error:", error);
    const status = error.status || 500;
    const message = error.message || "Failed to fetch repository files";
    return NextResponse.json({ error: message }, { status });
  }
}
