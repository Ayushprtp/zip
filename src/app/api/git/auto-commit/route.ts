/**
 * Git Auto-Commit API Route
 *
 * POST /api/git/auto-commit
 * Automatically commits file changes made by AI agents.
 * Uses local git (server-side) for projects on the server.
 *
 * This ensures every AI-generated change is tracked in git history
 * for version tracing and rollback capability.
 */

import { getSession } from "auth/server";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";

const execAsync = promisify(exec);

const requestSchema = z.object({
  projectPath: z.string().min(1),
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
    }),
  ),
  message: z.string().optional(),
  agentId: z.string().optional(),
  threadId: z.string().optional(),
});

/**
 * Run a git command in the specified directory.
 */
async function gitCommand(
  cwd: string,
  command: string,
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execAsync(`git ${command}`, {
      cwd,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Flare AI Agent",
        GIT_AUTHOR_EMAIL: "ai-agent@flare-sh.tech",
        GIT_COMMITTER_NAME: "Flare AI Agent",
        GIT_COMMITTER_EMAIL: "ai-agent@flare-sh.tech",
      },
      timeout: 30000,
    });
  } catch (err: any) {
    return { stdout: err.stdout || "", stderr: err.stderr || err.message };
  }
}

/**
 * Ensure the project directory has a git repo initialized.
 */
async function ensureGitRepo(projectPath: string): Promise<void> {
  const gitDir = join(projectPath, ".git");
  if (!existsSync(gitDir)) {
    await gitCommand(projectPath, "init");
    await gitCommand(projectPath, "checkout -b main");
    // Create .gitignore
    const gitignoreContent = `node_modules/
.next/
dist/
.env
.env.local
*.log
`;
    await writeFile(join(projectPath, ".gitignore"), gitignoreContent);
    await gitCommand(projectPath, "add .gitignore");
    await gitCommand(projectPath, 'commit -m "Initial commit"');
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const { projectPath, files, message, agentId, threadId } =
      requestSchema.parse(json);

    // Security: ensure project path is within allowed directories
    const resolvedPath = join(process.cwd(), ".data", "projects", projectPath);
    if (!resolvedPath.startsWith(join(process.cwd(), ".data", "projects"))) {
      return Response.json({ error: "Invalid project path" }, { status: 400 });
    }

    // Ensure directory exists
    await mkdir(resolvedPath, { recursive: true });

    // Ensure git repo
    await ensureGitRepo(resolvedPath);

    // Write files
    const writtenPaths: string[] = [];
    for (const file of files) {
      const filePath = join(resolvedPath, file.path);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, file.content, "utf-8");
      writtenPaths.push(file.path);
    }

    // Stage all changes
    await gitCommand(resolvedPath, "add -A");

    // Check if there are changes to commit
    const { stdout: statusOutput } = await gitCommand(
      resolvedPath,
      "status --porcelain",
    );
    if (!statusOutput.trim()) {
      return Response.json({
        committed: false,
        message: "No changes to commit",
        files: writtenPaths,
      });
    }

    // Build commit message
    const commitMsg =
      message ||
      `AI Agent: Updated ${writtenPaths.length} file(s)\n\nFiles changed:\n${writtenPaths.map((p) => `  - ${p}`).join("\n")}${agentId ? `\n\nAgent: ${agentId}` : ""}${threadId ? `\nThread: ${threadId}` : ""}`;

    // Commit
    await gitCommand(resolvedPath, `commit -m ${JSON.stringify(commitMsg)}`);

    // Get the commit SHA
    const { stdout: shaOutput } = await gitCommand(
      resolvedPath,
      "rev-parse HEAD",
    );
    const sha = shaOutput.trim();

    // Get the commit log
    const { stdout: logOutput } = await gitCommand(
      resolvedPath,
      "log -1 --oneline",
    );

    return Response.json({
      committed: true,
      sha,
      message: commitMsg,
      log: logOutput.trim(),
      files: writtenPaths,
      timestamp: Date.now(),
    });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return Response.json(
        { error: "Invalid request", details: err.errors },
        { status: 400 },
      );
    }
    console.error("[Git Auto-Commit] Error:", err);
    return Response.json(
      { error: err.message || "Git auto-commit failed" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/git/auto-commit?projectPath=xxx
 * Returns commit history for a project.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const projectPath = url.searchParams.get("projectPath");

  if (!projectPath) {
    return Response.json({ error: "projectPath is required" }, { status: 400 });
  }

  const resolvedPath = join(process.cwd(), ".data", "projects", projectPath);
  if (!resolvedPath.startsWith(join(process.cwd(), ".data", "projects"))) {
    return Response.json({ error: "Invalid project path" }, { status: 400 });
  }

  if (!existsSync(join(resolvedPath, ".git"))) {
    return Response.json({ commits: [], initialized: false });
  }

  const { stdout } = await gitCommand(
    resolvedPath,
    'log --oneline --format="%H|%s|%an|%ai" -50',
  );

  const commits = stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|");
      return {
        sha: parts[0]?.trim(),
        message: parts[1]?.trim(),
        author: parts[2]?.trim(),
        date: parts[3]?.trim(),
      };
    });

  return Response.json({ commits, initialized: true });
}
