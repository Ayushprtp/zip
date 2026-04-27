/**
 * E2B Sandbox API Route
 *
 * POST /api/sandbox
 * Executes code in an E2B cloud sandbox securely.
 */

import { getSession } from "auth/server";
import { executeInSandbox } from "@/lib/code-runner/e2b-sandbox";
import { z } from "zod";

const requestSchema = z.object({
  code: z.string().min(1),
  language: z.enum(["javascript", "python", "shell"]).default("javascript"),
  timeout: z.number().min(1000).max(120000).optional(),
  files: z
    .array(
      z.object({
        path: z.string(),
        content: z.string(),
      }),
    )
    .optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const json = await request.json();
    const { code, language, timeout, files } = requestSchema.parse(json);

    const result = await executeInSandbox(code, language, {
      timeout,
      files,
    });

    return Response.json(result);
  } catch (err: any) {
    if (err.name === "ZodError") {
      return Response.json(
        { error: "Invalid request", details: err.errors },
        { status: 400 },
      );
    }
    return Response.json(
      { error: err.message || "Sandbox execution failed" },
      { status: 500 },
    );
  }
}
