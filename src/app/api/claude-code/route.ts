/**
 * Claude Code API Route
 *
 * POST /api/claude-code
 * Provides a coding agent powered by Claude through the Flare API gateway.
 * Supports streaming responses, tool calls, and E2B sandbox execution.
 */

import { getSession } from "auth/server";
import { z } from "zod";

const CLAUDE_CODE_BASE_URL =
  process.env.CLAUDE_CODE_API_BASE_URL || "https://api.flare-sh.tech/v1";
const CLAUDE_CODE_API_KEY = process.env.CLAUDE_CODE_API_KEY || "";
const CLAUDE_CODE_MODEL =
  process.env.CLAUDE_CODE_DEFAULT_MODEL || "claude-sonnet-4.6";

const SYSTEM_PROMPT = `You are Claude Code, an expert AI coding assistant integrated into the Flare IDE.
You help users write, debug, refactor, and understand code.

Key capabilities:
- Write and edit code across all popular languages
- Explain code, algorithms, and architectural decisions
- Debug issues and suggest fixes
- Execute code in a secure sandbox when needed
- Manage git operations (commit, diff, branch)

Always provide clear, well-structured responses with proper code formatting.
When modifying files, show diffs or complete file contents.
Be concise but thorough.`;

const requestSchema = z.object({
  message: z.string().min(1),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string(),
      }),
    )
    .optional()
    .default([]),
  model: z.string().optional(),
  projectContext: z
    .object({
      files: z
        .array(z.object({ path: z.string(), content: z.string() }))
        .optional(),
      currentFile: z.string().optional(),
      selection: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!CLAUDE_CODE_API_KEY) {
    return Response.json(
      { error: "Claude Code API key not configured" },
      { status: 500 },
    );
  }

  try {
    const json = await request.json();
    const { message, history, model, projectContext } =
      requestSchema.parse(json);

    const modelId = model || CLAUDE_CODE_MODEL;

    // Build messages array
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history,
    ];

    // If project context is provided, inject it
    if (projectContext) {
      let contextMsg = "";
      if (projectContext.currentFile) {
        contextMsg += `\n\nCurrent file: ${projectContext.currentFile}`;
      }
      if (projectContext.selection) {
        contextMsg += `\n\nSelected code:\n\`\`\`\n${projectContext.selection}\n\`\`\``;
      }
      if (projectContext.files?.length) {
        contextMsg += "\n\nProject files:";
        for (const f of projectContext.files.slice(0, 10)) {
          contextMsg += `\n\n--- ${f.path} ---\n\`\`\`\n${f.content.slice(0, 5000)}\n\`\`\``;
        }
      }
      if (contextMsg) {
        messages.push({
          role: "user",
          content: `[Project Context]${contextMsg}`,
        });
        messages.push({
          role: "assistant",
          content:
            "I've reviewed the project context. How can I help you with this code?",
        });
      }
    }

    messages.push({ role: "user", content: message });

    // Stream response from Flare API
    const resp = await fetch(`${CLAUDE_CODE_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CLAUDE_CODE_API_KEY}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        stream: true,
        temperature: 0.3,
        max_tokens: 16384,
      }),
      signal: request.signal,
    });

    if (!resp.ok) {
      const errorBody = await resp.text().catch(() => "Unknown error");
      return Response.json(
        { error: `API error ${resp.status}: ${errorBody}` },
        { status: resp.status },
      );
    }

    // Forward the SSE stream directly
    return new Response(resp.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: any) {
    if (err.name === "ZodError") {
      return Response.json(
        { error: "Invalid request", details: err.errors },
        { status: 400 },
      );
    }
    return Response.json(
      { error: err.message || "Claude Code request failed" },
      { status: 500 },
    );
  }
}
