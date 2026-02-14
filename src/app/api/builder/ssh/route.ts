import { NextRequest, NextResponse } from "next/server";
import { Client } from "ssh2";
import type {
  SSHApiRequest,
  RemoteFileInfo,
  RemoteSystemInfo,
  RemoteGitStatus,
} from "@/types/builder/remote";

// ============================================================================
// In-memory session store
// ============================================================================

interface SSHSessionState {
  client: Client;
  connected: boolean;
  output: string[];
  cwd: string;
  lastActivity: number;
  host: string;
  username: string;
  port: number;
  preferredShell: string;
  envVars: Record<string, string>;
  // Remote development extensions
  remoteServer?: import("@/types/builder/remote").RemoteServerInfo;
  portForwarding?: import("@/types/builder/remote").ActivePortForwarding;
}

const sshConnections = new Map<string, SSHSessionState>();

// Heartbeat: clean up stale sessions every 5 minutes
if (typeof globalThis !== "undefined") {
  const cleanupKey = "__ssh_cleanup_registered";
  if (!(globalThis as any)[cleanupKey]) {
    (globalThis as any)[cleanupKey] = true;
    setInterval(
      () => {
        const now = Date.now();
        for (const [id, session] of sshConnections.entries()) {
          if (now - session.lastActivity > 15 * 60 * 1000) {
            try {
              session.client.end();
            } catch {
              // ignore
            }
            sshConnections.delete(id);
          }
        }
      },
      5 * 60 * 1000,
    );
  }
}

// ============================================================================
// Main request handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: SSHApiRequest = await request.json();
    const { action, sessionId, ...params } = body;

    switch (action) {
      case "connect":
        return handleConnect(params);
      case "disconnect":
        return handleDisconnect(sessionId!);
      case "exec":
        return handleExec(
          sessionId!,
          params.command!,
          params.cwd,
          params.timeout,
        );
      case "test":
        return handleTest(params);
      case "heartbeat":
        return handleHeartbeat(sessionId!);
      case "list-files":
        return handleListFiles(sessionId!, params.path!);
      case "read-file":
        return handleReadFile(sessionId!, params.path!, params.encoding);
      case "write-file":
        return handleWriteFile(sessionId!, params.path!, params.content!);
      case "delete-file":
        return handleDeleteFile(sessionId!, params.path!, params.recursive);
      case "mkdir":
        return handleMkdir(sessionId!, params.path!, params.recursive);
      case "move-file":
        return handleMoveFile(sessionId!, params.path!, params.destPath!);
      case "copy-file":
        return handleCopyFile(
          sessionId!,
          params.path!,
          params.destPath!,
          params.recursive,
        );
      case "system-info":
        return handleSystemInfo(sessionId!);
      case "git-status":
        return handleGitStatus(sessionId!, params.cwd);
      case "init-project":
        return handleInitProject(sessionId!, params);
      case "install-remote-server":
        return handleInstallRemoteServer(sessionId!, params.serverVersion);
      case "start-remote-server":
        return handleStartRemoteServer(sessionId!, params.serverConfig);
      case "stop-remote-server":
        return handleStopRemoteServer(sessionId!);
      case "get-remote-server-status":
        return handleGetRemoteServerStatus(sessionId!);
      case "setup-port-forwarding":
        return handleSetupPortForwarding(
          sessionId!,
          params.forwardingType!,
          params.forwardingConfig!,
        );
      case "remove-port-forwarding":
        return handleRemovePortForwarding(sessionId!, params.forwardingType!);
      case "create-terminal":
        return handleCreateTerminal(
          sessionId!,
          params.terminalId!,
          params.terminalConfig,
        );
      case "send-terminal-input":
        return handleSendTerminalInput(
          sessionId!,
          params.terminalId!,
          params.input!,
        );
      case "resize-terminal":
        return handleResizeTerminal(
          sessionId!,
          params.terminalId!,
          params.cols!,
          params.rows!,
        );
      case "close-terminal":
        return handleCloseTerminal(sessionId!, params.terminalId!);
      case "run-git-command":
        return handleRunGitCommand(sessionId!, params.gitCommand!, params.cwd);
      case "run-task":
        return handleRunTask(
          sessionId!,
          params.taskCommand!,
          params.cwd,
          params.background,
        );
      case "search-files":
        return handleSearchFiles(
          sessionId!,
          params.query!,
          params.cwd,
          params.include,
          params.exclude,
        );
      case "get-file-tree":
        return handleGetFileTree(sessionId!, params.path);
      case "sync-files":
        return handleSyncFiles(sessionId!, params.operations || []);
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (error: any) {
    console.error("[SSH API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// ============================================================================
// Connection handlers
// ============================================================================

async function handleConnect(
  params: Partial<SSHApiRequest>,
): Promise<NextResponse> {
  const {
    host,
    port = 22,
    username,
    password,
    privateKey,
    passphrase,
    jumpHost,
    keepAliveInterval = 10000,
    readyTimeout = 15000,
    preferredShell = "/bin/bash",
    envVars = {},
  } = params;

  if (!host || !username) {
    return NextResponse.json(
      { error: "Host and username are required" },
      { status: 400 },
    );
  }

  if (jumpHost) {
    return handleConnectViaJumpHost(
      {
        host: host!,
        port,
        username: username!,
        password,
        privateKey,
        passphrase,
        preferredShell,
        envVars,
      },
      jumpHost,
      keepAliveInterval,
      readyTimeout,
    );
  }

  return new Promise((resolve) => {
    const client = new Client();
    const sessionId = `ssh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const timeout = setTimeout(() => {
      client.end();
      resolve(
        NextResponse.json({ error: "Connection timed out" }, { status: 408 }),
      );
    }, readyTimeout + 1000);

    client
      .on("ready", async () => {
        clearTimeout(timeout);

        let homeDir = "~";
        try {
          homeDir = await execOnClient(client, "echo $HOME");
          homeDir = homeDir.trim() || "~";
        } catch {
          // fall back to ~
        }

        if (Object.keys(envVars).length > 0) {
          const exportCmd = Object.entries(envVars)
            .map(([k, v]) => `export ${k}="${v}"`)
            .join(" && ");
          try {
            await execOnClient(client, exportCmd);
          } catch {
            // non-fatal
          }
        }

        sshConnections.set(sessionId, {
          client,
          connected: true,
          output: [],
          cwd: homeDir,
          lastActivity: Date.now(),
          host: host!,
          username: username!,
          port,
          preferredShell,
          envVars,
        });

        resolve(
          NextResponse.json({
            success: true,
            sessionId,
            connected: true,
            cwd: homeDir,
            message: `Connected to ${host}:${port} as ${username}`,
          }),
        );
      })
      .on("error", (err) => {
        clearTimeout(timeout);
        resolve(
          NextResponse.json(
            { error: `SSH connection failed: ${err.message}` },
            { status: 502 },
          ),
        );
      })
      .on("close", () => {
        const session = sshConnections.get(sessionId);
        if (session) {
          session.connected = false;
        }
      })
      .connect({
        host,
        port,
        username,
        password: password || undefined,
        privateKey: privateKey || undefined,
        passphrase: passphrase || undefined,
        readyTimeout,
        keepaliveInterval: keepAliveInterval,
      });
  });
}

async function handleConnectViaJumpHost(
  target: {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
    preferredShell: string;
    envVars: Record<string, string>;
  },
  jumpHost: NonNullable<SSHApiRequest["jumpHost"]>,
  keepAliveInterval: number,
  readyTimeout: number,
): Promise<NextResponse> {
  return new Promise((resolve) => {
    const jumpClient = new Client();
    const sessionId = `ssh_jump_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const timeout = setTimeout(() => {
      jumpClient.end();
      resolve(
        NextResponse.json(
          { error: "Jump host connection timed out" },
          { status: 408 },
        ),
      );
    }, readyTimeout * 2);

    jumpClient
      .on("ready", () => {
        jumpClient.forwardOut(
          "127.0.0.1",
          0,
          target.host,
          target.port,
          (err, stream) => {
            if (err) {
              clearTimeout(timeout);
              jumpClient.end();
              return resolve(
                NextResponse.json(
                  {
                    error: `Jump host forwarding failed: ${err.message}`,
                  },
                  { status: 502 },
                ),
              );
            }

            const targetClient = new Client();
            targetClient
              .on("ready", async () => {
                clearTimeout(timeout);

                let homeDir = "~";
                try {
                  homeDir = await execOnClient(targetClient, "echo $HOME");
                  homeDir = homeDir.trim() || "~";
                } catch {
                  // fall back
                }

                sshConnections.set(sessionId, {
                  client: targetClient,
                  connected: true,
                  output: [],
                  cwd: homeDir,
                  lastActivity: Date.now(),
                  host: target.host,
                  username: target.username,
                  port: target.port,
                  preferredShell: target.preferredShell,
                  envVars: target.envVars,
                });

                resolve(
                  NextResponse.json({
                    success: true,
                    sessionId,
                    connected: true,
                    cwd: homeDir,
                    message: `Connected to ${target.host}:${target.port} via jump host ${jumpHost.host}`,
                  }),
                );
              })
              .on("error", (err) => {
                clearTimeout(timeout);
                jumpClient.end();
                resolve(
                  NextResponse.json(
                    {
                      error: `Target connection via jump host failed: ${err.message}`,
                    },
                    { status: 502 },
                  ),
                );
              })
              .connect({
                sock: stream,
                username: target.username,
                password: target.password || undefined,
                privateKey: target.privateKey || undefined,
                passphrase: target.passphrase || undefined,
                readyTimeout,
                keepaliveInterval: keepAliveInterval,
              });
          },
        );
      })
      .on("error", (err) => {
        clearTimeout(timeout);
        resolve(
          NextResponse.json(
            { error: `Jump host connection failed: ${err.message}` },
            { status: 502 },
          ),
        );
      })
      .connect({
        host: jumpHost.host,
        port: jumpHost.port,
        username: jumpHost.username,
        password:
          jumpHost.authMethod === "password" ? jumpHost.password : undefined,
        privateKey:
          jumpHost.authMethod === "key" ? jumpHost.privateKey : undefined,
        readyTimeout,
      });
  });
}

async function handleDisconnect(sessionId: string): Promise<NextResponse> {
  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 },
    );
  }

  const session = sshConnections.get(sessionId);
  if (session) {
    try {
      session.client.end();
    } catch {
      // ignore
    }
    session.connected = false;
    sshConnections.delete(sessionId);
  }

  return NextResponse.json({ success: true, disconnected: true });
}

async function handleTest(
  params: Partial<SSHApiRequest>,
): Promise<NextResponse> {
  const {
    host,
    port = 22,
    username,
    password,
    privateKey,
    passphrase,
  } = params;

  if (!host || !username) {
    return NextResponse.json(
      { error: "Host and username are required" },
      { status: 400 },
    );
  }

  return new Promise((resolve) => {
    const client = new Client();
    const timeout = setTimeout(() => {
      client.end();
      resolve(
        NextResponse.json({
          success: false,
          error: "Connection timed out",
        }),
      );
    }, 10000);

    client
      .on("ready", async () => {
        clearTimeout(timeout);
        const sysInfo: Partial<RemoteSystemInfo> = {};
        try {
          const uname = await execOnClient(client, "uname -srm");
          sysInfo.os = uname.trim();
        } catch {
          // ignore
        }
        client.end();
        resolve(
          NextResponse.json({
            success: true,
            message: `Successfully connected to ${host}:${port}`,
            systemInfo: sysInfo,
          }),
        );
      })
      .on("error", (err) => {
        clearTimeout(timeout);
        resolve(
          NextResponse.json({
            success: false,
            error: err.message,
          }),
        );
      })
      .connect({
        host,
        port,
        username,
        password: password || undefined,
        privateKey: privateKey || undefined,
        passphrase: passphrase || undefined,
        readyTimeout: 9000,
      });
  });
}

async function handleHeartbeat(sessionId: string): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { success: false, connected: false, error: "No active session" },
      { status: 404 },
    );
  }

  try {
    const result = await execOnClient(session.client, "echo __heartbeat_ok__");
    session.lastActivity = Date.now();

    if (result.includes("__heartbeat_ok__")) {
      return NextResponse.json({
        success: true,
        connected: true,
        cwd: session.cwd,
        lastActivity: session.lastActivity,
      });
    }

    return NextResponse.json({
      success: false,
      connected: false,
      error: "Heartbeat failed",
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      connected: false,
      error: err.message,
    });
  }
}

// ============================================================================
// Command execution
// ============================================================================

async function execCommand(
  client: Client,
  command: string,
  options?: { cwd?: string; timeout?: number },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const timeout = options?.timeout || 30000;
    const timer = setTimeout(() => {
      reject(new Error("Command timed out"));
    }, timeout);

    const wrappedCommand = options?.cwd
      ? `cd "${options.cwd}" && ${command}`
      : command;

    client.exec(wrappedCommand, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        return reject(err);
      }

      let stdout = "";
      let stderr = "";

      stream.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      stream.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      stream.on("close", (code: number) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code });
      });

      stream.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  });
}

async function handleExec(
  sessionId: string,
  command: string,
  cwd?: string,
  timeout?: number,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session found" },
      { status: 404 },
    );
  }

  const workDir = cwd || session.cwd;
  const execTimeout = timeout || 30000;
  const startTime = Date.now();

  const envExports = Object.entries(session.envVars)
    .map(([k, v]) => `export ${k}="${v}"`)
    .join("; ");

  const wrappedCommand = [
    `cd "${workDir}" 2>/dev/null || cd ~`,
    envExports || null,
    command,
    'echo "___CWD___$(pwd)"',
  ]
    .filter(Boolean)
    .join(" && ");

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve(
        NextResponse.json(
          { error: "Command timed out", exitCode: -1 },
          { status: 408 },
        ),
      );
    }, execTimeout);

    session.client.exec(wrappedCommand, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        return resolve(
          NextResponse.json(
            { error: `Exec failed: ${err.message}` },
            { status: 500 },
          ),
        );
      }

      let stdout = "";
      let stderr = "";

      stream
        .on("close", (code: number) => {
          clearTimeout(timer);
          session.lastActivity = Date.now();

          let newCwd = session.cwd;
          const cwdMatch = stdout.match(/___CWD___(.*?)$/m);
          if (cwdMatch) {
            newCwd = cwdMatch[1].trim();
            stdout = stdout.replace(/___CWD___.*$/m, "").trimEnd();
            session.cwd = newCwd;
          }

          const duration = Date.now() - startTime;
          session.output.push(`$ ${command}\n${stdout}`);

          resolve(
            NextResponse.json({
              success: true,
              output: stdout,
              stderr,
              exitCode: code,
              cwd: newCwd,
              duration,
            }),
          );
        })
        .on("data", (data: Buffer) => {
          stdout += data.toString();
        })
        .stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });
    });
  });
}

// ============================================================================
// File operations
// ============================================================================

async function handleListFiles(
  _sessionId: string,
  dirPath: string,
): Promise<NextResponse> {
  // --- GitHub repo agent integration ---
  // Example config: these should be provided by session or params
  const installationId = process.env.GITHUB_INSTALLATION_ID
    ? parseInt(process.env.GITHUB_INSTALLATION_ID)
    : undefined;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  const branch = process.env.GITHUB_REPO_BRANCH || "main";

  if (!installationId || !owner || !repo) {
    return NextResponse.json(
      { error: "GitHub repo agent config missing" },
      { status: 500 },
    );
  }

  try {
    // Dynamically import GitHubAppService
    const { GitHubAppService } = await import(
      "@/lib/builder/github-app-service"
    );
    const githubApp = new GitHubAppService({
      appId: process.env.GITHUB_APP_ID!,
      privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
      clientId: process.env.GITHUB_APP_CLIENT_ID!,
      clientSecret: process.env.GITHUB_APP_CLIENT_SECRET!,
    });

    // Get directory tree for the branch
    const tree = await githubApp.getTree(installationId, owner, repo, branch);
    // Normalize dirPath (remove leading/trailing slashes)
    const normalizedDir = dirPath.replace(/^\/+|\/+$/g, "");
    const dirPrefix = normalizedDir ? `${normalizedDir}/` : "";

    // Collect files and directories in the requested path
    const items = new Map<string, any>();

    for (const item of tree) {
      if (
        normalizedDir &&
        !item.path.startsWith(dirPrefix) &&
        item.path !== normalizedDir
      ) {
        continue; // Not in this directory
      }

      const relativePath = normalizedDir
        ? item.path.slice(dirPrefix.length)
        : item.path;
      if (!relativePath || relativePath.includes("/")) {
        // Skip items deeper than one level
        continue;
      }

      items.set(relativePath, item);
    }

    const files: RemoteFileInfo[] = Array.from(items.values()).map(
      (item: any) => {
        const name = item.path.split("/").pop() || item.path;
        const isDirectory = item.type === "tree";
        return {
          name,
          path: item.path,
          type: isDirectory ? "directory" : "file",
          size: item.size || 0,
          permissions: isDirectory ? "drwxr-xr-x" : "rw-r--r--",
          owner: owner,
          group: "",
          modifiedAt: "",
          isHidden: name.startsWith("."),
        };
      },
    );

    return NextResponse.json({
      success: true,
      files,
      path: dirPath,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to list files (GitHub agent): ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleReadFile(
  sessionId: string,
  filePath: string,
  encoding?: string,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  try {
    const fileType = await execOnClient(
      session.client,
      `file -b --mime-encoding "${filePath}"`,
    );
    const isBinary = fileType.trim() === "binary";

    if (isBinary) {
      const content = await execOnClient(
        session.client,
        `base64 "${filePath}"`,
      );
      const size = await execOnClient(
        session.client,
        `stat -c%s "${filePath}" 2>/dev/null || stat -f%z "${filePath}" 2>/dev/null`,
      );

      session.lastActivity = Date.now();

      return NextResponse.json({
        success: true,
        file: {
          path: filePath,
          content: content.trim(),
          size: parseInt(size.trim()) || 0,
          encoding: "base64",
          isBinary: true,
        },
      });
    }

    const content = await execOnClient(session.client, `cat "${filePath}"`);
    const size = await execOnClient(
      session.client,
      `stat -c%s "${filePath}" 2>/dev/null || stat -f%z "${filePath}" 2>/dev/null`,
    );

    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      file: {
        path: filePath,
        content,
        size: parseInt(size.trim()) || content.length,
        encoding: encoding || "utf-8",
        isBinary: false,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to read file: ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleWriteFile(
  sessionId: string,
  filePath: string,
  content: string,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  try {
    const dirPath = filePath.substring(0, filePath.lastIndexOf("/"));
    if (dirPath) {
      await execOnClient(session.client, `mkdir -p "${dirPath}"`);
    }

    await execOnClient(
      session.client,
      `cat > "${filePath}" << 'FLARE_EOF'\n${content}\nFLARE_EOF`,
    );

    const size = await execOnClient(
      session.client,
      `stat -c%s "${filePath}" 2>/dev/null || stat -f%z "${filePath}" 2>/dev/null`,
    );

    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      path: filePath,
      bytesWritten: parseInt(size.trim()) || content.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to write file: ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleDeleteFile(
  sessionId: string,
  filePath: string,
  recursive?: boolean,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  try {
    const cmd = recursive ? `rm -rf "${filePath}"` : `rm -f "${filePath}"`;
    await execOnClient(session.client, cmd);
    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      message: `Deleted ${filePath}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to delete: ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleMkdir(
  sessionId: string,
  dirPath: string,
  recursive?: boolean,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  try {
    const cmd =
      recursive !== false ? `mkdir -p "${dirPath}"` : `mkdir "${dirPath}"`;
    await execOnClient(session.client, cmd);
    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      message: `Created directory ${dirPath}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to create directory: ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleMoveFile(
  sessionId: string,
  sourcePath: string,
  destPath: string,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  try {
    await execOnClient(session.client, `mv "${sourcePath}" "${destPath}"`);
    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      message: `Moved ${sourcePath} to ${destPath}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to move: ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleCopyFile(
  sessionId: string,
  sourcePath: string,
  destPath: string,
  recursive?: boolean,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  try {
    const cmd = recursive
      ? `cp -r "${sourcePath}" "${destPath}"`
      : `cp "${sourcePath}" "${destPath}"`;
    await execOnClient(session.client, cmd);
    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      message: `Copied ${sourcePath} to ${destPath}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to copy: ${err.message}` },
      { status: 500 },
    );
  }
}

// ============================================================================
// System info & Git
// ============================================================================

async function handleSystemInfo(sessionId: string): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  try {
    const [osInfo, arch, hostname, kernel, uptime, shell, homeDir, diskUsage] =
      await Promise.all([
        execOnClient(
          session.client,
          "cat /etc/os-release 2>/dev/null | head -1 || uname -s",
        ).catch(() => "Unknown"),
        execOnClient(session.client, "uname -m").catch(() => "Unknown"),
        execOnClient(session.client, "hostname").catch(() => "Unknown"),
        execOnClient(session.client, "uname -r").catch(() => "Unknown"),
        execOnClient(session.client, "uptime -p 2>/dev/null || uptime").catch(
          () => "Unknown",
        ),
        execOnClient(session.client, "echo $SHELL").catch(() => "/bin/sh"),
        execOnClient(session.client, "echo $HOME").catch(() => "~"),
        execOnClient(session.client, "df -h / 2>/dev/null | tail -1").catch(
          () => "",
        ),
      ]);

    const [nodeVersion, pythonVersion, gitVersion, npmVersion] =
      await Promise.all([
        execOnClient(session.client, "node --version 2>/dev/null").catch(
          () => "",
        ),
        execOnClient(
          session.client,
          "python3 --version 2>/dev/null || python --version 2>/dev/null",
        ).catch(() => ""),
        execOnClient(session.client, "git --version 2>/dev/null").catch(
          () => "",
        ),
        execOnClient(session.client, "npm --version 2>/dev/null").catch(
          () => "",
        ),
      ]);

    let diskInfo;
    if (diskUsage.trim()) {
      const parts = diskUsage.trim().split(/\s+/);
      if (parts.length >= 5) {
        diskInfo = {
          total: parts[1],
          used: parts[2],
          available: parts[3],
          percentage: parts[4],
        };
      }
    }

    const systemInfo: RemoteSystemInfo = {
      os: osInfo.replace(/^NAME="|"$/g, "").trim(),
      arch: arch.trim(),
      hostname: hostname.trim(),
      kernel: kernel.trim(),
      uptime: uptime.trim(),
      shell: shell.trim(),
      homeDir: homeDir.trim(),
      nodeVersion: nodeVersion.trim() || undefined,
      pythonVersion: pythonVersion.trim() || undefined,
      gitVersion: gitVersion.trim() || undefined,
      npmVersion: npmVersion.trim() || undefined,
      diskUsage: diskInfo,
    };

    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      systemInfo,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to get system info: ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleGitStatus(
  sessionId: string,
  cwd?: string,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  const workDir = cwd || session.cwd;

  try {
    const isRepo = await execOnClient(
      session.client,
      `cd "${workDir}" && git rev-parse --is-inside-work-tree 2>/dev/null`,
    );

    if (isRepo.trim() !== "true") {
      return NextResponse.json({
        success: true,
        gitStatus: { isRepo: false },
      });
    }

    const [branch, status, aheadBehind] = await Promise.all([
      execOnClient(
        session.client,
        `cd "${workDir}" && git branch --show-current 2>/dev/null`,
      ).catch(() => ""),
      execOnClient(
        session.client,
        `cd "${workDir}" && git status --porcelain 2>/dev/null`,
      ).catch(() => ""),
      execOnClient(
        session.client,
        `cd "${workDir}" && git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null`,
      ).catch(() => ""),
    ]);

    const lines = status.split("\n").filter((l) => l.trim());
    const staged: string[] = [];
    const modified: string[] = [];
    const untracked: string[] = [];
    let hasConflicts = false;

    for (const line of lines) {
      const indexStatus = line[0];
      const workTreeStatus = line[1];
      const filePath = line.substring(3).trim();

      if (indexStatus === "U" || workTreeStatus === "U") {
        hasConflicts = true;
      }
      if (indexStatus !== " " && indexStatus !== "?") {
        staged.push(filePath);
      }
      if (workTreeStatus === "M" || workTreeStatus === "D") {
        modified.push(filePath);
      }
      if (indexStatus === "?") {
        untracked.push(filePath);
      }
    }

    let ahead = 0;
    let behind = 0;
    if (aheadBehind.trim()) {
      const parts = aheadBehind.trim().split(/\s+/);
      ahead = parseInt(parts[0]) || 0;
      behind = parseInt(parts[1]) || 0;
    }

    const gitStatus: RemoteGitStatus = {
      isRepo: true,
      branch: branch.trim(),
      ahead,
      behind,
      staged,
      modified,
      untracked,
      hasConflicts,
    };

    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      gitStatus,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to get git status: ${err.message}` },
      { status: 500 },
    );
  }
}

// ============================================================================
// Project initialization
// ============================================================================

async function handleInitProject(
  sessionId: string,
  params: Partial<SSHApiRequest>,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  const { template, projectName, cwd } = params;
  if (!template || !projectName) {
    return NextResponse.json(
      { error: "template and projectName are required" },
      { status: 400 },
    );
  }

  const { REMOTE_PROJECT_TEMPLATES } = await import("@/types/builder/remote");
  const templateConfig = REMOTE_PROJECT_TEMPLATES[template];

  if (!templateConfig) {
    return NextResponse.json(
      { error: `Unknown template: ${template}` },
      { status: 400 },
    );
  }

  const workDir = cwd || session.cwd;

  try {
    if (templateConfig.requiredTools.length > 0) {
      const checks = await Promise.all(
        templateConfig.requiredTools.map(async (tool) => {
          try {
            await execOnClient(session.client, `which ${tool} 2>/dev/null`);
            return { tool, available: true };
          } catch {
            return { tool, available: false };
          }
        }),
      );

      const missing = checks.filter((c) => !c.available).map((c) => c.tool);
      if (missing.length > 0) {
        return NextResponse.json({
          success: false,
          error: `Missing required tools: ${missing.join(", ")}`,
          data: { missingTools: missing },
        });
      }
    }

    const initCommand = templateConfig.command.replace(
      /\{name\}/g,
      projectName,
    );

    const result = await execOnClient(
      session.client,
      `cd "${workDir}" && ${initCommand}`,
      120000,
    );

    const newCwd = `${workDir}/${projectName}`;
    session.cwd = newCwd;
    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      message: `${templateConfig.name} project "${projectName}" initialized`,
      output: result,
      cwd: newCwd,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Project initialization failed: ${err.message}` },
      { status: 500 },
    );
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getSession(sessionId: string): SSHSessionState | null {
  if (!sessionId) return null;
  const session = sshConnections.get(sessionId);
  if (!session || !session.connected) return null;
  return session;
}

function execOnClient(
  client: Client,
  command: string,
  timeout = 30000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Command timed out"));
    }, timeout);

    client.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        return reject(err);
      }

      let stdout = "";
      let stderr = "";

      stream
        .on("close", (code: number) => {
          clearTimeout(timer);
          if (code !== 0 && stderr) {
            reject(new Error(stderr.trim()));
          } else {
            resolve(stdout);
          }
        })
        .on("data", (data: Buffer) => {
          stdout += data.toString();
        })
        .stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });
    });
  });
}

// ============================================================================
// Remote Development Server Handlers
// ============================================================================

async function handleInstallRemoteServer(
  sessionId: string,
  serverVersion?: string,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  try {
    const installPath = "~/.flare-remote-server";
    const version = serverVersion || "latest";

    // Create installation directory
    await execOnClient(session.client, `mkdir -p "${installPath}"`);

    // Download the installation script from the local server
    // In a real deployment, this would be from a CDN or GitHub release
    // For development, we'll embed the script content directly
    const installScriptContent = `#!/bin/bash

# Flare Remote Development Server Installation Script

set -e

echo "🚀 Installing Flare Remote Development Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_VERSION="16.0.0"

if ! [ "$(printf '%s\\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $NODE_VERSION is too old. Please upgrade to Node.js 16+."
    exit 1
fi

echo "✅ Node.js $NODE_VERSION detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

echo "✅ npm detected"

# Create installation directory
INSTALL_DIR="$HOME/.flare-remote-server"
echo "📁 Installing to: $INSTALL_DIR"

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Create package.json
cat > package.json << 'EOL'
{
  "name": "flare-remote-server-instance",
  "version": "1.0.0",
  "description": "Flare Remote Development Server Instance",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "socket.io": "^4.7.4",
    "chokidar": "^3.5.3",
    "ws": "^8.14.2"
  }
}
EOL

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Download server code
echo "⬇️ Downloading server code..."

# For now, we'll embed the server code directly
cat > index.js << 'EOL'
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const chokidar = require('chokidar');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 37507;
const HOST = process.env.HOST || '127.0.0.1';
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

class FlareRemoteServer {
  constructor() {
    this.workspaceRoot = WORKSPACE_ROOT;
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: { origin: "*", methods: ["GET", "POST"] }
    });
    this.wss = new WebSocketServer({ server: this.server });
    this.watcher = chokidar.watch(this.workspaceRoot, {
      ignored: /(^|[\\\\/\\\\])\\../,
      persistent: true,
      ignoreInitial: true
    });

    this.setupMiddleware();
    this.setupWebSocket();
    this.setupFileWatcher();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  setupWebSocket() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });

      socket.on('read-file', async (data) => {
        try {
          const filePath = path.resolve(this.workspaceRoot, data.path);
          if (!filePath.startsWith(this.workspaceRoot)) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }
          const content = fs.readFileSync(filePath, 'utf8');
          socket.emit('file-content', { path: data.path, content });
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('write-file', async (data) => {
        try {
          const filePath = path.resolve(this.workspaceRoot, data.path);
          if (!filePath.startsWith(this.workspaceRoot)) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }
          fs.writeFileSync(filePath, data.content, 'utf8');
          socket.emit('file-saved', { path: data.path });
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });

      socket.on('list-directory', async (data) => {
        try {
          const dirPath = path.resolve(this.workspaceRoot, data.path || '');
          if (!dirPath.startsWith(this.workspaceRoot)) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }
          const items = fs.readdirSync(dirPath).map(item => {
            const itemPath = path.join(dirPath, item);
            const stats = fs.statSync(itemPath);
            return {
              name: item,
              path: path.relative(this.workspaceRoot, itemPath),
              type: stats.isDirectory() ? 'directory' : 'file',
              size: stats.size,
              modifiedAt: stats.mtime.toISOString()
            };
          });
          socket.emit('directory-listing', { path: data.path, items });
        } catch (error) {
          socket.emit('error', { message: error.message });
        }
      });
    });
  }

  setupFileWatcher() {
    this.watcher.on('all', (event, filePath) => {
      const relativePath = path.relative(this.workspaceRoot, filePath);
      this.io.emit('file-change', {
        event,
        path: relativePath,
        timestamp: new Date().toISOString()
      });
    });
  }

  setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        workspace: this.workspaceRoot,
        port: PORT
      });
    });

    this.app.get('/files/*', (req, res) => {
      const filePath = path.resolve(this.workspaceRoot, req.params[0]);
      if (!filePath.startsWith(this.workspaceRoot)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).json({ error: 'File not found' });
      }
    });

    this.app.get('/api/files', (req, res) => {
      try {
        const dirPath = req.query.path || '';
        const fullPath = path.resolve(this.workspaceRoot, dirPath);
        if (!fullPath.startsWith(this.workspaceRoot)) {
          return res.status(403).json({ error: 'Access denied' });
        }
        const items = fs.readdirSync(fullPath).map(item => {
          const itemPath = path.join(fullPath, item);
          const stats = fs.statSync(itemPath);
          return {
            name: item,
            path: path.relative(this.workspaceRoot, itemPath),
            type: stats.isDirectory() ? 'directory' : 'file',
            size: stats.size,
            modifiedAt: stats.mtime.toISOString()
          };
        });
        res.json({ items });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  start() {
    this.server.listen(PORT, HOST, () => {
      console.log(\`🚀 Flare Remote Development Server running on \${HOST}:\${PORT}\`);
      console.log(\`📁 Workspace: \${this.workspaceRoot}\`);
      console.log(\`🔗 WebSocket endpoint: ws://\${HOST}:\${PORT}\`);
      console.log(\`💻 Health check: http://\${HOST}:\${PORT}/health\`);
    });

    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  stop() {
    console.log('🛑 Shutting down Flare Remote Development Server...');
    this.watcher.close();
    this.io.close();
    this.wss.close();
    this.server.close(() => {
      console.log('✅ Server stopped');
      process.exit(0);
    });
  }
}

if (require.main === module) {
  const server = new FlareRemoteServer();
  server.start();
}

module.exports = FlareRemoteServer;
EOL

echo "✅ Server code installed"
echo "🎉 Installation complete!"
echo ""
echo "To start the server, run:"
echo "  cd $INSTALL_DIR && npm start"
echo ""
echo "Or with custom port:"
echo "  PORT=8080 WORKSPACE_ROOT=/path/to/workspace npm start"
`;

    // Write the installation script to the remote machine
    const tempScriptPath = "/tmp/flare-install.sh";
    await execOnClient(
      session.client,
      `cat > ${tempScriptPath} << 'EOF'
${installScriptContent}
EOF`,
    );

    // Make it executable and run it
    await execOnClient(session.client, `chmod +x ${tempScriptPath}`);
    const installOutput = await execOnClient(
      session.client,
      `bash ${tempScriptPath}`,
    );

    // Clean up the temp script
    await execOnClient(session.client, `rm ${tempScriptPath}`);

    // Update session with server info
    session.remoteServer = {
      serverId: `server_${Date.now()}`,
      version,
      installPath,
      listeningPort: 0, // Will be set when started
      status: "stopped",
    };

    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      message: "Remote server installed successfully",
      serverInfo: session.remoteServer,
      installOutput,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to install remote server: ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleStartRemoteServer(
  sessionId: string,
  serverConfig?: any,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  if (!session.remoteServer) {
    return NextResponse.json(
      { error: "Remote server not installed" },
      { status: 400 },
    );
  }

  try {
    const port = serverConfig?.port || 37507; // Default port like VS Code
    const workspaceRoot = serverConfig?.workspaceRoot || session.cwd || "~";
    const installPath = session.remoteServer.installPath;

    // Check if server is already running
    const checkCommand = `lsof -ti:${port} | wc -l`;
    const runningCount = parseInt(
      await execOnClient(session.client, checkCommand),
    );

    if (runningCount > 0) {
      return NextResponse.json(
        { error: `Port ${port} is already in use` },
        { status: 409 },
      );
    }

    // Start the remote server in background
    const startCommand = `
      cd "${installPath}" &&
      echo "Starting Flare Remote Development Server on port ${port}..." &&
      PORT=${port} WORKSPACE_ROOT="${workspaceRoot}" nohup npm start > server.log 2>&1 &
      echo $! > server.pid
      sleep 2
      if kill -0 $(cat server.pid) 2>/dev/null; then
        echo "Server started successfully on port ${port}"
        echo ${port}
      else
        echo "Failed to start server"
        cat server.log
        exit 1
      fi
    `;

    const result = await execOnClient(session.client, startCommand);
    const lines = result.trim().split("\n");
    const lastLine = lines[lines.length - 1];

    if (lastLine.includes("Failed to start server")) {
      throw new Error(`Server startup failed: ${result}`);
    }

    const listeningPort = parseInt(lastLine) || port;

    // Get the actual PID
    const pidResult = await execOnClient(
      session.client,
      `cat "${installPath}/server.pid"`,
    );
    const pid = parseInt(pidResult.trim());

    // Update server info
    session.remoteServer.listeningPort = listeningPort;
    session.remoteServer.status = "running";
    session.remoteServer.startedAt = Date.now();
    session.remoteServer.pid = pid;
    session.remoteServer.workspaceRoot = workspaceRoot;

    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      message: "Remote server started successfully",
      serverInfo: session.remoteServer,
    });
  } catch (err: any) {
    if (session.remoteServer) {
      session.remoteServer.status = "error";
    }
    return NextResponse.json(
      { error: `Failed to start remote server: ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleStopRemoteServer(
  sessionId: string,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  if (!session.remoteServer) {
    return NextResponse.json(
      { error: "Remote server not installed" },
      { status: 400 },
    );
  }

  try {
    const installPath = session.remoteServer.installPath;
    // Stop the remote server
    const stopCommand = `
      if [ -f "${installPath}/server.pid" ]; then
        SERVER_PID=$(cat "${installPath}/server.pid")
        if kill -0 $SERVER_PID 2>/dev/null; then
          echo "Stopping Flare Remote Development Server (PID: $SERVER_PID)..."
          kill $SERVER_PID
          sleep 2
          if kill -0 $SERVER_PID 2>/dev/null; then
            echo "Force killing server..."
            kill -9 $SERVER_PID
          fi
        else
          echo "Server process not running"
        fi
        rm -f "${installPath}/server.pid"
      else
        echo "No PID file found, attempting to kill by port..."
        PORT=${session.remoteServer.listeningPort}
        if [ -n "$PORT" ]; then
          PIDS=$(lsof -ti:$PORT)
          if [ -n "$PIDS" ]; then
            echo "Killing processes on port $PORT: $PIDS"
            kill $PIDS
          fi
        fi
      fi
      echo "Server stopped"
    `;

    await execOnClient(session.client, stopCommand);

    // Update server info
    session.remoteServer.status = "stopped";
    session.remoteServer.pid = undefined;
    session.remoteServer.stoppedAt = Date.now();

    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      message: "Remote server stopped successfully",
      serverInfo: session.remoteServer,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to stop remote server: ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleGetRemoteServerStatus(
  sessionId: string,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  if (!session.remoteServer) {
    return NextResponse.json(
      { error: "Remote server not installed" },
      { status: 400 },
    );
  }

  try {
    const port = session.remoteServer.listeningPort;

    // Check if server process is running
    let isRunning = false;
    let healthCheckResult = null;

    if (session.remoteServer.pid) {
      const pidCheck = await execOnClient(
        session.client,
        `kill -0 ${session.remoteServer.pid} 2>/dev/null && echo "running" || echo "stopped"`,
      );
      isRunning = pidCheck.trim() === "running";
    }

    // Also check if port is listening
    if (port) {
      const portCheck = await execOnClient(
        session.client,
        `lsof -ti:${port} | wc -l`,
      );
      const portCount = parseInt(portCheck.trim());
      isRunning = isRunning || portCount > 0;
    }

    // Try to get health check from server
    if (isRunning && port) {
      try {
        const healthCommand = `curl -s -m 5 http://localhost:${port}/health`;
        const healthResponse = await execOnClient(
          session.client,
          healthCommand,
        );
        healthCheckResult = JSON.parse(healthResponse);
      } catch (err) {
        // Health check failed, but server might still be running
        console.log("Health check failed:", err);
      }
    }

    // Update server status
    session.remoteServer.status = isRunning ? "running" : "stopped";
    session.remoteServer.lastHealthCheck = Date.now();
    session.remoteServer.healthCheckResult = healthCheckResult;

    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      serverInfo: session.remoteServer,
      portForwarding: session.portForwarding,
      healthCheck: healthCheckResult,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to check server status: ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleSetupPortForwarding(
  sessionId: string,
  forwardingType: string,
  forwardingConfig: any,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  try {
    // Initialize port forwarding if not exists
    if (!session.portForwarding) {
      session.portForwarding = {};
    }

    if (forwardingType === "dynamic") {
      // Setup SOCKS proxy (like VS Code's -D flag)
      const localPort = forwardingConfig.port || 59840;

      // Check if port is available
      try {
        const portCheck = await execOnClient(
          session.client,
          `lsof -ti:${localPort} | wc -l`,
        );
        if (parseInt(portCheck.trim()) > 0) {
          return NextResponse.json(
            { error: `Local port ${localPort} is already in use` },
            { status: 409 },
          );
        }
      } catch (_err) {
        // Port check failed, assume it's available
      }

      // Setup dynamic (SOCKS) port forwarding
      return new Promise((resolve) => {
        session.client.forwardOut(
          "127.0.0.1",
          localPort,
          "127.0.0.1",
          0, // Dynamic forwarding
          (err, stream) => {
            if (err) {
              resolve(
                NextResponse.json(
                  {
                    error: `Failed to setup dynamic forwarding: ${err.message}`,
                  },
                  { status: 500 },
                ),
              );
              return;
            }

            session.portForwarding!.dynamicForwarding = {
              localPort,
              server: stream, // Store the stream for cleanup
            };

            resolve(
              NextResponse.json({
                success: true,
                message: `Dynamic port forwarding setup on local port ${localPort}`,
                portForwarding: session.portForwarding,
              }),
            );
          },
        );
      });
    }

    if (forwardingType === "local") {
      // Local port forwarding: localPort -> remoteHost:remotePort
      const {
        localPort,
        remoteHost = "127.0.0.1",
        remotePort,
      } = forwardingConfig;

      if (!localPort || !remotePort) {
        return NextResponse.json(
          {
            error: "localPort and remotePort are required for local forwarding",
          },
          { status: 400 },
        );
      }

      // Check if local port is available
      try {
        const portCheck = await execOnClient(
          session.client,
          `lsof -ti:${localPort} | wc -l`,
        );
        if (parseInt(portCheck.trim()) > 0) {
          return NextResponse.json(
            { error: `Local port ${localPort} is already in use` },
            { status: 409 },
          );
        }
      } catch (_err) {
        // Port check failed, assume it's available
      }

      // Setup local port forwarding
      return new Promise((resolve) => {
        session.client.forwardIn("127.0.0.1", localPort, (err) => {
          if (err) {
            resolve(
              NextResponse.json(
                { error: `Failed to setup local forwarding: ${err.message}` },
                { status: 500 },
              ),
            );
            return;
          }

          // Listen for connections on the forwarded port
          session.client.on("tcp connection", (info, accept, reject) => {
            if (info.destPort === localPort) {
              const stream = accept();
              // Forward to remote host/port
              session.client.forwardOut(
                info.srcIP,
                info.srcPort,
                remoteHost,
                remotePort,
                (err, upstream) => {
                  if (err) {
                    stream.end();
                    return;
                  }
                  stream.pipe(upstream).pipe(stream);
                },
              );
            } else {
              reject();
            }
          });

          if (!session.portForwarding!.localForwarding) {
            session.portForwarding!.localForwarding = [];
          }

          session.portForwarding!.localForwarding.push({
            localPort,
            remoteHost,
            remotePort,
            server: "active", // Mark as active
          });

          resolve(
            NextResponse.json({
              success: true,
              message: `Local port forwarding setup: ${localPort} -> ${remoteHost}:${remotePort}`,
              portForwarding: session.portForwarding,
            }),
          );
        });
      });
    }

    if (forwardingType === "remote") {
      // Remote port forwarding: remotePort -> localHost:localPort
      const {
        remotePort,
        localHost = "127.0.0.1",
        localPort,
      } = forwardingConfig;

      if (!remotePort || !localPort) {
        return NextResponse.json(
          {
            error:
              "remotePort and localPort are required for remote forwarding",
          },
          { status: 400 },
        );
      }

      // Setup remote port forwarding
      return new Promise((resolve) => {
        session.client.forwardIn("127.0.0.1", remotePort, (err) => {
          if (err) {
            resolve(
              NextResponse.json(
                { error: `Failed to setup remote forwarding: ${err.message}` },
                { status: 500 },
              ),
            );
            return;
          }

          // Listen for connections on the remote forwarded port
          session.client.on("tcp connection", (info, accept, reject) => {
            if (info.destPort === remotePort) {
              const remoteStream = accept();
              // Connect to local host/port
              const net = require("net");
              const localSocket = net.connect(localPort, localHost, () => {
                remoteStream.pipe(localSocket).pipe(remoteStream);
              });

              localSocket.on("error", () => {
                remoteStream.end();
              });
            } else {
              reject();
            }
          });

          if (!session.portForwarding!.remoteForwarding) {
            session.portForwarding!.remoteForwarding = [];
          }

          session.portForwarding!.remoteForwarding.push({
            remotePort,
            localHost,
            localPort,
            tunnel: "active", // Mark as active
          });

          resolve(
            NextResponse.json({
              success: true,
              message: `Remote port forwarding setup: ${remotePort} -> ${localHost}:${localPort}`,
              portForwarding: session.portForwarding,
            }),
          );
        });
      });
    }

    return NextResponse.json(
      { error: `Unknown forwarding type: ${forwardingType}` },
      { status: 400 },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to setup port forwarding: ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleRemovePortForwarding(
  sessionId: string,
  forwardingType: string,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  if (!session.portForwarding) {
    return NextResponse.json(
      { error: "No port forwarding active" },
      { status: 400 },
    );
  }

  try {
    if (
      forwardingType === "dynamic" &&
      session.portForwarding.dynamicForwarding
    ) {
      // For dynamic forwarding, we can't explicitly close the SOCKS server
      // but we can mark it as inactive
      const { localPort } = session.portForwarding.dynamicForwarding;

      // Try to unforward the port
      try {
        session.client.unforwardIn("127.0.0.1", localPort);
      } catch (_err) {
        // Ignore errors during cleanup
      }

      session.portForwarding.dynamicForwarding = undefined;
    }

    if (forwardingType === "local" && session.portForwarding.localForwarding) {
      // Stop local forwarding by unforwarding each port
      for (const forwarding of session.portForwarding.localForwarding) {
        try {
          session.client.unforwardIn("127.0.0.1", forwarding.localPort);
        } catch (_err) {
          // Ignore errors during cleanup
        }
      }
      session.portForwarding.localForwarding = [];
    }

    if (
      forwardingType === "remote" &&
      session.portForwarding.remoteForwarding
    ) {
      // Stop remote forwarding by unforwarding each port
      for (const forwarding of session.portForwarding.remoteForwarding) {
        try {
          session.client.unforwardIn("127.0.0.1", forwarding.remotePort);
        } catch (_err) {
          // Ignore errors during cleanup
        }
      }
      session.portForwarding.remoteForwarding = [];
    }

    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      message: `Port forwarding removed for type: ${forwardingType}`,
      portForwarding: session.portForwarding,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to remove port forwarding: ${err.message}` },
      { status: 500 },
    );
  }
}

// ============================================================================
// Remote Development Environment Handlers
// ============================================================================

async function handleCreateTerminal(
  sessionId: string,
  terminalId: string,
  terminalConfig?: any,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  if (!session.remoteServer || session.remoteServer.status !== "running") {
    return NextResponse.json(
      { error: "Remote server not running" },
      { status: 400 },
    );
  }

  try {
    // For now, create terminal directly via SSH
    // In a full implementation, this would proxy to the remote server
    const shell = terminalConfig?.shell || "/bin/bash";
    const cwd = terminalConfig?.cwd || session.cwd || "~";

    // This is a placeholder - in a real implementation, we'd use a proper
    // PTY library or proxy to the remote server
    await execOnClient(
      session.client,
      `echo "Terminal ${terminalId} created with shell: ${shell}"`,
    );

    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      terminalId,
      message: "Terminal created successfully",
      shell,
      cwd,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to create terminal: ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleSendTerminalInput(
  sessionId: string,
  terminalId: string,
  input: string,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  try {
    // This is a placeholder - in a real implementation, we'd send input to the PTY
    // For now, just execute the input as a command
    const result = await execOnClient(session.client, input);

    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      terminalId,
      output: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to send terminal input: ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleResizeTerminal(
  sessionId: string,
  terminalId: string,
  cols: number,
  rows: number,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  try {
    // This is a placeholder - in a real implementation, we'd resize the PTY
    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      terminalId,
      cols,
      rows,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to resize terminal: ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleCloseTerminal(
  sessionId: string,
  terminalId: string,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  try {
    // This is a placeholder - in a real implementation, we'd close the PTY
    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      terminalId,
      message: "Terminal closed",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to close terminal: ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleRunGitCommand(
  sessionId: string,
  gitCommand: string,
  cwd?: string,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  try {
    const workDir = cwd || session.cwd || "~";
    const fullCommand = `cd "${workDir}" && git ${gitCommand}`;

    const result = await execOnClient(session.client, fullCommand);

    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      command: gitCommand,
      output: result,
      cwd: workDir,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to run git command: ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleRunTask(
  sessionId: string,
  taskCommand: string,
  cwd?: string,
  background?: boolean,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  try {
    const workDir = cwd || session.cwd || "~";

    if (background) {
      // Run in background
      const bgCommand = `cd "${workDir}" && nohup ${taskCommand} > /dev/null 2>&1 & echo $!`;
      const result = await execOnClient(session.client, bgCommand);

      session.lastActivity = Date.now();

      return NextResponse.json({
        success: true,
        command: taskCommand,
        background: true,
        pid: result.trim(),
        cwd: workDir,
      });
    } else {
      // Run synchronously
      const fullCommand = `cd "${workDir}" && ${taskCommand}`;
      const result = await execOnClient(session.client, fullCommand);

      session.lastActivity = Date.now();

      return NextResponse.json({
        success: true,
        command: taskCommand,
        output: result,
        cwd: workDir,
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to run task: ${err.message}` },
      { status: 500 },
    );
  }
}

async function handleSearchFiles(
  sessionId: string,
  query: string,
  cwd?: string,
  include?: string,
  exclude?: string,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  try {
    const workDir = cwd || session.cwd || "~";

    // Use grep for searching
    let grepCommand = `cd "${workDir}" && grep -r -n "${query}" .`;

    if (include) {
      grepCommand += ` --include="${include}"`;
    }

    if (exclude) {
      grepCommand += ` --exclude="${exclude}"`;
    }

    grepCommand += ` 2>/dev/null || true`; // Don't fail if no matches

    const result = await execOnClient(session.client, grepCommand);

    // Parse grep output
    const lines = result.split("\n").filter((line) => line.trim());
    const matches = lines
      .map((line) => {
        const match = line.match(/^([^:]+):(\d+):(.*)$/);
        if (match) {
          return {
            file: match[1],
            line: parseInt(match[2]),
            content: match[3],
          };
        }
        return null;
      })
      .filter(Boolean);

    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      query,
      matches,
      cwd: workDir,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to search files: ${err.message}` },
      { status: 500 },
    );
  }
}

// ============================================================================
// File Tree Handler
// ============================================================================

async function handleGetFileTree(
  sessionId: string,
  path?: string,
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  try {
    const workDir = path || session.cwd || "~";

    // Use find command to get file tree
    const { stdout } = await execCommand(
      session.client,
      `find "${workDir}" -maxdepth 3 -type f -o -type d | head -100`,
      { cwd: workDir },
    );

    const files = stdout
      .trim()
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const isDir = line.endsWith("/");
        return {
          name: line.split("/").pop() || line,
          path: line,
          type: isDir ? "directory" : "file",
        };
      });

    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      files,
      cwd: workDir,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to get file tree: ${err.message}` },
      { status: 500 },
    );
  }
}

// ============================================================================
// File Sync Handler
// ============================================================================

async function handleSyncFiles(
  sessionId: string,
  operations: any[],
): Promise<NextResponse> {
  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "No active SSH session" },
      { status: 404 },
    );
  }

  try {
    const results: Array<{
      type: string;
      path: string;
      dest?: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const op of operations) {
      switch (op.type) {
        case "create":
        case "update":
          await execCommand(
            session.client,
            `echo '${op.content?.replace(/'/g, "'\"'\"'")}' > "${op.remotePath}"`,
            { cwd: session.cwd },
          );
          results.push({ type: op.type, path: op.remotePath, success: true });
          break;

        case "delete":
          await execCommand(session.client, `rm -f "${op.remotePath}"`, {
            cwd: session.cwd,
          });
          results.push({ type: op.type, path: op.remotePath, success: true });
          break;

        case "move":
          await execCommand(
            session.client,
            `mv "${op.remotePath}" "${op.destPath}"`,
            { cwd: session.cwd },
          );
          results.push({
            type: op.type,
            path: op.remotePath,
            dest: op.destPath,
            success: true,
          });
          break;

        default:
          results.push({
            type: op.type,
            path: op.remotePath,
            success: false,
            error: "Unknown operation type",
          });
      }
    }

    session.lastActivity = Date.now();

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: `Failed to sync files: ${err.message}` },
      { status: 500 },
    );
  }
}
