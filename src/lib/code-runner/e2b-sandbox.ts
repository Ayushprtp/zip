/**
 * E2B Sandbox Service
 *
 * Provides secure, sandboxed code execution using E2B cloud sandboxes.
 * Used by the AI Builder and Claude Code for running user/AI-generated code safely.
 *
 * Supports: JavaScript/TypeScript, Python, Shell commands
 */

import "server-only";

const E2B_API_KEY = process.env.E2B_API_KEY || "";

export interface SandboxExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
  executionTimeMs: number;
}

export interface SandboxFileOp {
  path: string;
  content: string;
}

/**
 * Execute code in an E2B sandbox.
 * Uses the E2B Sandbox SDK for cloud-based code execution.
 */
export async function executeInSandbox(
  code: string,
  language: "javascript" | "python" | "shell" = "javascript",
  options?: {
    timeout?: number;
    files?: SandboxFileOp[];
  },
): Promise<SandboxExecResult> {
  if (!E2B_API_KEY) {
    return {
      stdout: "",
      stderr: "E2B_API_KEY not configured",
      exitCode: 1,
      error: "E2B_API_KEY not configured. Set it in your .env file.",
      executionTimeMs: 0,
    };
  }

  const startTime = Date.now();

  try {
    const { Sandbox } = await import("@e2b/code-interpreter");
    const sandbox = await Sandbox.create({
      apiKey: E2B_API_KEY,
    });

    try {
      // Write any files to the sandbox
      if (options?.files?.length) {
        for (const file of options.files) {
          await sandbox.files.write(file.path, file.content);
        }
      }

      let stdout = "";
      let stderr = "";

      // Build the command to execute
      let cmd: string;
      if (language === "python") {
        // Write python code to a temp file and run it
        const tmpFile = "/tmp/run_code.py";
        await sandbox.files.write(tmpFile, code);
        cmd = `python3 ${tmpFile}`;
      } else if (language === "javascript") {
        const tmpFile = "/tmp/run_code.js";
        await sandbox.files.write(tmpFile, code);
        cmd = `node ${tmpFile}`;
      } else {
        cmd = code;
      }

      const result = await sandbox.commands.run(cmd, {
        timeoutMs: options?.timeout || 30000,
      });

      stdout = result.stdout || "";
      stderr = result.stderr || "";

      return {
        stdout,
        stderr,
        exitCode: result.exitCode ?? 0,
        error: result.exitCode !== 0 ? stderr : undefined,
        executionTimeMs: Date.now() - startTime,
      };
    } finally {
      await sandbox.kill();
    }
  } catch (err: any) {
    return {
      stdout: "",
      stderr: err.message || "Sandbox execution failed",
      exitCode: 1,
      error: err.message,
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Execute a series of commands in a persistent sandbox session.
 * Useful for multi-step operations (install deps, then run code).
 */
export async function executeSessionInSandbox(
  commands: Array<{
    code: string;
    language: "javascript" | "python" | "shell";
  }>,
  options?: {
    timeout?: number;
    files?: SandboxFileOp[];
  },
): Promise<SandboxExecResult[]> {
  if (!E2B_API_KEY) {
    return commands.map(() => ({
      stdout: "",
      stderr: "E2B_API_KEY not configured",
      exitCode: 1,
      error: "E2B_API_KEY not configured",
      executionTimeMs: 0,
    }));
  }

  const { Sandbox } = await import("@e2b/code-interpreter");
  const sandbox = await Sandbox.create({
    apiKey: E2B_API_KEY,
  });

  const results: SandboxExecResult[] = [];

  try {
    // Write files first
    if (options?.files?.length) {
      for (const file of options.files) {
        await sandbox.files.write(file.path, file.content);
      }
    }

    for (const cmdDef of commands) {
      const startTime = Date.now();
      try {
        let cmd: string;
        if (cmdDef.language === "python") {
          const tmpFile = "/tmp/run_code.py";
          await sandbox.files.write(tmpFile, cmdDef.code);
          cmd = `python3 ${tmpFile}`;
        } else if (cmdDef.language === "javascript") {
          const tmpFile = "/tmp/run_code.js";
          await sandbox.files.write(tmpFile, cmdDef.code);
          cmd = `node ${tmpFile}`;
        } else {
          cmd = cmdDef.code;
        }

        const result = await sandbox.commands.run(cmd, {
          timeoutMs: options?.timeout || 30000,
        });

        results.push({
          stdout: result.stdout || "",
          stderr: result.stderr || "",
          exitCode: result.exitCode ?? 0,
          error: result.exitCode !== 0 ? result.stderr || "" : undefined,
          executionTimeMs: Date.now() - startTime,
        });
      } catch (err: any) {
        results.push({
          stdout: "",
          stderr: err.message || "Command failed",
          exitCode: 1,
          error: err.message,
          executionTimeMs: Date.now() - startTime,
        });
      }
    }
  } finally {
    await sandbox.kill();
  }

  return results;
}
