import { create } from "zustand";
import { DESTRUCTIVE_PATTERNS } from "@/types/builder/remote";
import type {
  SSHConnectionConfig,
  SSHConnectionStatus,
  SSHSession,
  ExecutionContext,
  RemoteFileInfo,
  RemoteSystemInfo,
  RemoteGitStatus,
  RemoteTerminalEntry,
  SafetyConfirmation,
} from "@/types/builder/remote";

// ============================================================================
// Store Types
// ============================================================================

interface RemoteDevStore {
  // Connection state
  connectionStatus: SSHConnectionStatus;
  activeSession: SSHSession | null;
  activeConnection: SSHConnectionConfig | null;
  savedConnections: SSHConnectionConfig[];
  connectionError: string | null;

  // Execution context
  executionContext: ExecutionContext;
  preferRemote: boolean;

  // Remote filesystem
  workingDirectory: string;
  lastWorkingDirectory: string | null;
  directoryHistory: string[];
  remoteFiles: RemoteFileInfo[];

  // System info
  systemInfo: RemoteSystemInfo | null;
  gitStatus: RemoteGitStatus | null;

  // Terminal
  terminalOutput: RemoteTerminalEntry[];
  commandHistory: string[];

  // Health
  lastHeartbeat: number | null;
  reconnectAttempts: number;
  isHealthy: boolean;

  // Safety
  pendingConfirmation: SafetyConfirmation | null;

  // Actions - Connection
  setConnectionStatus: (status: SSHConnectionStatus) => void;
  setActiveSession: (session: SSHSession | null) => void;
  setActiveConnection: (conn: SSHConnectionConfig | null) => void;
  setSavedConnections: (conns: SSHConnectionConfig[]) => void;
  setConnectionError: (error: string | null) => void;

  // Actions - Execution Context
  setExecutionContext: (ctx: ExecutionContext) => void;
  setPreferRemote: (prefer: boolean) => void;
  autoSelectContext: () => void;

  // Actions - Filesystem
  setWorkingDirectory: (dir: string) => void;
  pushDirectoryHistory: (dir: string) => void;
  setRemoteFiles: (files: RemoteFileInfo[]) => void;

  // Actions - System
  setSystemInfo: (info: RemoteSystemInfo | null) => void;
  setGitStatus: (status: RemoteGitStatus | null) => void;

  // Actions - Terminal
  addTerminalEntry: (
    entry: Omit<RemoteTerminalEntry, "id" | "timestamp">,
  ) => void;
  clearTerminal: () => void;
  addCommandToHistory: (cmd: string) => void;

  // Actions - Health
  updateHeartbeat: () => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  setIsHealthy: (healthy: boolean) => void;

  // Actions - Safety
  setPendingConfirmation: (confirmation: SafetyConfirmation | null) => void;
  checkCommandSafety: (command: string) => SafetyConfirmation | null;

  // Actions - Connection lifecycle
  connect: (conn: SSHConnectionConfig) => Promise<boolean>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<boolean>;
  testConnection: (
    conn: SSHConnectionConfig,
  ) => Promise<{ success: boolean; error?: string }>;

  // Actions - Remote operations
  executeCommand: (
    command: string,
    options?: { cwd?: string; skipSafetyCheck?: boolean },
  ) => Promise<{
    output: string;
    stderr: string;
    exitCode: number;
    cwd: string;
  } | null>;
  listRemoteFiles: (path?: string) => Promise<RemoteFileInfo[]>;
  readRemoteFile: (path: string) => Promise<string | null>;
  writeRemoteFile: (path: string, content: string) => Promise<boolean>;
  deleteRemoteFile: (path: string, recursive?: boolean) => Promise<boolean>;
  createRemoteDirectory: (path: string) => Promise<boolean>;
  refreshSystemInfo: () => Promise<void>;
  refreshGitStatus: () => Promise<void>;
  initializeProject: (template: string, name: string) => Promise<boolean>;
  changeDirectory: (path: string) => Promise<boolean>;

  // Actions - Persistence
  loadSavedConnections: () => void;
  saveConnections: () => void;
  loadLastWorkingDirectory: (connectionId: string) => string | null;
  saveLastWorkingDirectory: (connectionId: string, dir: string) => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Storage keys
// ============================================================================

const CONNECTIONS_KEY = "flare-ssh-connections";
const LAST_CWD_KEY = "flare-ssh-last-cwd";
const PREFER_REMOTE_KEY = "flare-ssh-prefer-remote";

// ============================================================================
// Store
// ============================================================================

export const useRemoteDevStore = create<RemoteDevStore>((set, get) => ({
  // Initial state
  connectionStatus: "disconnected",
  activeSession: null,
  activeConnection: null,
  savedConnections: [],
  connectionError: null,
  executionContext: "sandbox",
  preferRemote: false,
  workingDirectory: "~",
  lastWorkingDirectory: null,
  directoryHistory: [],
  remoteFiles: [],
  systemInfo: null,
  gitStatus: null,
  terminalOutput: [],
  commandHistory: [],
  lastHeartbeat: null,
  reconnectAttempts: 0,
  isHealthy: false,
  pendingConfirmation: null,

  // Setters
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setActiveSession: (session) => set({ activeSession: session }),
  setActiveConnection: (conn) => set({ activeConnection: conn }),
  setSavedConnections: (conns) => set({ savedConnections: conns }),
  setConnectionError: (error) => set({ connectionError: error }),

  setExecutionContext: (ctx) => set({ executionContext: ctx }),
  setPreferRemote: (prefer) => {
    set({ preferRemote: prefer });
    if (typeof window !== "undefined") {
      localStorage.setItem(PREFER_REMOTE_KEY, JSON.stringify(prefer));
    }
  },
  autoSelectContext: () => {
    const { connectionStatus, preferRemote, isHealthy } = get();
    if (preferRemote && connectionStatus === "connected" && isHealthy) {
      set({ executionContext: "remote" });
    } else {
      set({ executionContext: "sandbox" });
    }
  },

  setWorkingDirectory: (dir) => set({ workingDirectory: dir }),
  pushDirectoryHistory: (dir) => {
    set((s) => ({
      directoryHistory: [
        ...s.directoryHistory.filter((d) => d !== dir),
        dir,
      ].slice(-20),
    }));
  },
  setRemoteFiles: (files) => set({ remoteFiles: files }),

  setSystemInfo: (info) => set({ systemInfo: info }),
  setGitStatus: (status) => set({ gitStatus: status }),

  addTerminalEntry: (entry) => {
    const id = `term_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({
      terminalOutput: [
        ...s.terminalOutput,
        { ...entry, id, timestamp: Date.now() },
      ].slice(-1000), // keep last 1000 entries
    }));
  },
  clearTerminal: () => set({ terminalOutput: [] }),
  addCommandToHistory: (cmd) => {
    set((s) => ({
      commandHistory: [...s.commandHistory.filter((c) => c !== cmd), cmd].slice(
        -100,
      ),
    }));
  },

  updateHeartbeat: () => set({ lastHeartbeat: Date.now() }),
  incrementReconnectAttempts: () =>
    set((s) => ({ reconnectAttempts: s.reconnectAttempts + 1 })),
  resetReconnectAttempts: () => set({ reconnectAttempts: 0 }),
  setIsHealthy: (healthy) => set({ isHealthy: healthy }),

  setPendingConfirmation: (confirmation) =>
    set({ pendingConfirmation: confirmation }),

  checkCommandSafety: (command: string): SafetyConfirmation | null => {
    for (const { pattern, riskLevel, reason } of DESTRUCTIVE_PATTERNS) {
      if (pattern.test(command)) {
        return {
          id: `confirm_${Date.now()}`,
          command,
          reason,
          riskLevel,
          timestamp: Date.now(),
          details: `Command: ${command}`,
        };
      }
    }
    return null;
  },

  // ============================================================
  // Connection lifecycle
  // ============================================================

  connect: async (conn: SSHConnectionConfig): Promise<boolean> => {
    const store = get();
    set({
      connectionStatus: "connecting",
      connectionError: null,
      activeConnection: conn,
    });

    store.addTerminalEntry({
      type: "system",
      text: `Connecting to ${conn.username}@${conn.host}:${conn.port}...`,
    });

    try {
      const res = await fetch("/api/builder/ssh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "connect",
          host: conn.host,
          port: conn.port,
          username: conn.username,
          password: conn.authMethod === "password" ? conn.password : undefined,
          privateKey: conn.authMethod === "key" ? conn.privateKey : undefined,
          passphrase: conn.passphrase,
          jumpHost: conn.jumpHost,
          keepAliveInterval: conn.keepAliveInterval,
          readyTimeout: conn.readyTimeout,
          preferredShell: conn.preferredShell,
          envVars: conn.envVars,
        }),
      });

      const data = await res.json();

      if (data.connected) {
        const session: SSHSession = {
          sessionId: data.sessionId,
          connectionId: conn.id,
          status: "connected",
          connectedAt: Date.now(),
          lastActivityAt: Date.now(),
          host: conn.host,
          username: conn.username,
          port: conn.port,
        };

        // Recover last working directory if available
        const lastDir = get().loadLastWorkingDirectory(conn.id);
        const initialDir = lastDir || data.cwd || "~";

        set({
          connectionStatus: "connected",
          activeSession: session,
          workingDirectory: initialDir,
          isHealthy: true,
          reconnectAttempts: 0,
        });

        get().addTerminalEntry({
          type: "system",
          text: `Connected to ${conn.username}@${conn.host}:${conn.port}`,
        });

        get().addTerminalEntry({
          type: "system",
          text: `Working directory: ${initialDir}`,
        });

        // Auto-switch to remote context if preferred
        get().autoSelectContext();

        // Fetch system info in background
        get().refreshSystemInfo();
        get().refreshGitStatus();
        get().listRemoteFiles(initialDir);

        // Start heartbeat
        startHeartbeat();

        return true;
      }

      set({
        connectionStatus: "error",
        connectionError: data.error || "Connection failed",
        activeConnection: null,
      });

      get().addTerminalEntry({
        type: "error",
        text: `Connection failed: ${data.error || "Unknown error"}`,
      });

      return false;
    } catch (err: any) {
      set({
        connectionStatus: "error",
        connectionError: err.message,
        activeConnection: null,
      });

      get().addTerminalEntry({
        type: "error",
        text: `Connection error: ${err.message}`,
      });

      return false;
    }
  },

  disconnect: async () => {
    const { activeSession, activeConnection, workingDirectory } = get();

    if (activeSession?.sessionId) {
      // Save last working directory
      if (activeConnection) {
        get().saveLastWorkingDirectory(activeConnection.id, workingDirectory);
      }

      try {
        await fetch("/api/builder/ssh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "disconnect",
            sessionId: activeSession.sessionId,
          }),
        });
      } catch {
        // ignore
      }
    }

    stopHeartbeat();

    set({
      connectionStatus: "disconnected",
      activeSession: null,
      activeConnection: null,
      isHealthy: false,
      systemInfo: null,
      gitStatus: null,
      remoteFiles: [],
      executionContext: "sandbox",
    });

    get().addTerminalEntry({
      type: "system",
      text: "Disconnected from remote server",
    });
  },

  reconnect: async (): Promise<boolean> => {
    const { activeConnection, reconnectAttempts } = get();
    if (!activeConnection || reconnectAttempts >= 3) {
      set({ connectionStatus: "disconnected" });
      get().addTerminalEntry({
        type: "error",
        text:
          reconnectAttempts >= 3
            ? "Max reconnection attempts reached. Falling back to sandbox."
            : "No saved connection to reconnect",
      });
      set({ executionContext: "sandbox" });
      return false;
    }

    set({ connectionStatus: "reconnecting" });
    get().incrementReconnectAttempts();
    get().addTerminalEntry({
      type: "warning",
      text: `Reconnecting... (attempt ${reconnectAttempts + 1}/3)`,
    });

    return get().connect(activeConnection);
  },

  testConnection: async (
    conn: SSHConnectionConfig,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/builder/ssh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          host: conn.host,
          port: conn.port,
          username: conn.username,
          password: conn.authMethod === "password" ? conn.password : undefined,
          privateKey: conn.authMethod === "key" ? conn.privateKey : undefined,
          passphrase: conn.passphrase,
        }),
      });

      const data = await res.json();
      return { success: data.success, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ============================================================
  // Remote operations
  // ============================================================

  executeCommand: async (command, options = {}) => {
    const { activeSession, workingDirectory } = get();
    if (!activeSession) return null;

    // Safety check
    if (!options.skipSafetyCheck) {
      const confirmation = get().checkCommandSafety(command);
      if (confirmation) {
        set({ pendingConfirmation: confirmation });
        return null; // caller should wait for confirmation
      }
    }

    const cwd = options.cwd || workingDirectory;

    get().addTerminalEntry({
      type: "input",
      text: `${cwd} $ ${command}`,
      cwd,
    });

    get().addCommandToHistory(command);

    try {
      const res = await fetch("/api/builder/ssh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "exec",
          sessionId: activeSession.sessionId,
          command,
          cwd,
        }),
      });

      const data = await res.json();

      if (data.error) {
        get().addTerminalEntry({
          type: "error",
          text: data.error,
        });
        return null;
      }

      if (data.output) {
        get().addTerminalEntry({
          type: "output",
          text: data.output,
          exitCode: data.exitCode,
          cwd: data.cwd,
        });
      }

      if (data.stderr) {
        get().addTerminalEntry({
          type: "error",
          text: data.stderr,
        });
      }

      // Update working directory if changed
      if (data.cwd && data.cwd !== workingDirectory) {
        set({ workingDirectory: data.cwd });
        get().pushDirectoryHistory(data.cwd);

        // Refresh file list for new directory
        get().listRemoteFiles(data.cwd);
        get().refreshGitStatus();
      }

      return {
        output: data.output || "",
        stderr: data.stderr || "",
        exitCode: data.exitCode ?? 0,
        cwd: data.cwd || cwd,
      };
    } catch (err: any) {
      get().addTerminalEntry({
        type: "error",
        text: `Execution error: ${err.message}`,
      });

      // Check if connection was lost
      if (
        err.message.includes("fetch") ||
        err.message.includes("network") ||
        err.message.includes("ECONNREFUSED")
      ) {
        get().reconnect();
      }

      return null;
    }
  },

  listRemoteFiles: async (path?: string): Promise<RemoteFileInfo[]> => {
    const { activeSession, workingDirectory } = get();
    if (!activeSession) return [];

    const targetPath = path || workingDirectory;

    try {
      const res = await fetch("/api/builder/ssh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "list-files",
          sessionId: activeSession.sessionId,
          path: targetPath,
        }),
      });

      const data = await res.json();
      if (data.success && data.files) {
        if (targetPath === workingDirectory || targetPath === path) {
          set({ remoteFiles: data.files });
        }
        return data.files;
      }
      return [];
    } catch {
      return [];
    }
  },

  readRemoteFile: async (path: string): Promise<string | null> => {
    const { activeSession } = get();
    if (!activeSession) return null;

    try {
      const res = await fetch("/api/builder/ssh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "read-file",
          sessionId: activeSession.sessionId,
          path,
        }),
      });

      const data = await res.json();
      if (data.success && data.file) {
        return data.file.content;
      }
      return null;
    } catch {
      return null;
    }
  },

  writeRemoteFile: async (path: string, content: string): Promise<boolean> => {
    const { activeSession } = get();
    if (!activeSession) return false;

    try {
      const res = await fetch("/api/builder/ssh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "write-file",
          sessionId: activeSession.sessionId,
          path,
          content,
        }),
      });

      const data = await res.json();
      return data.success === true;
    } catch {
      return false;
    }
  },

  deleteRemoteFile: async (
    path: string,
    recursive?: boolean,
  ): Promise<boolean> => {
    const { activeSession } = get();
    if (!activeSession) return false;

    try {
      const res = await fetch("/api/builder/ssh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete-file",
          sessionId: activeSession.sessionId,
          path,
          recursive,
        }),
      });

      const data = await res.json();
      if (data.success) {
        get().listRemoteFiles();
      }
      return data.success === true;
    } catch {
      return false;
    }
  },

  createRemoteDirectory: async (path: string): Promise<boolean> => {
    const { activeSession } = get();
    if (!activeSession) return false;

    try {
      const res = await fetch("/api/builder/ssh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mkdir",
          sessionId: activeSession.sessionId,
          path,
          recursive: true,
        }),
      });

      const data = await res.json();
      if (data.success) {
        get().listRemoteFiles();
      }
      return data.success === true;
    } catch {
      return false;
    }
  },

  refreshSystemInfo: async () => {
    const { activeSession } = get();
    if (!activeSession) return;

    try {
      const res = await fetch("/api/builder/ssh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "system-info",
          sessionId: activeSession.sessionId,
        }),
      });

      const data = await res.json();
      if (data.success && data.systemInfo) {
        set({ systemInfo: data.systemInfo });
      }
    } catch {
      // non-fatal
    }
  },

  refreshGitStatus: async () => {
    const { activeSession, workingDirectory } = get();
    if (!activeSession) return;

    try {
      const res = await fetch("/api/builder/ssh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "git-status",
          sessionId: activeSession.sessionId,
          cwd: workingDirectory,
        }),
      });

      const data = await res.json();
      if (data.success && data.gitStatus) {
        set({ gitStatus: data.gitStatus });
      }
    } catch {
      // non-fatal
    }
  },

  initializeProject: async (template, name) => {
    const { activeSession, workingDirectory } = get();
    if (!activeSession) return false;

    get().addTerminalEntry({
      type: "system",
      text: `Initializing ${template} project "${name}" in ${workingDirectory}...`,
    });

    try {
      const res = await fetch("/api/builder/ssh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "init-project",
          sessionId: activeSession.sessionId,
          template,
          projectName: name,
          cwd: workingDirectory,
        }),
      });

      const data = await res.json();

      if (data.success) {
        get().addTerminalEntry({
          type: "system",
          text: data.message,
        });

        if (data.output) {
          get().addTerminalEntry({
            type: "output",
            text: data.output,
          });
        }

        if (data.cwd) {
          set({ workingDirectory: data.cwd });
          get().pushDirectoryHistory(data.cwd);
          get().listRemoteFiles(data.cwd);
          get().refreshGitStatus();
        }

        return true;
      }

      get().addTerminalEntry({
        type: "error",
        text: data.error || "Project initialization failed",
      });

      return false;
    } catch (err: any) {
      get().addTerminalEntry({
        type: "error",
        text: `Error: ${err.message}`,
      });
      return false;
    }
  },

  changeDirectory: async (path: string): Promise<boolean> => {
    const result = await get().executeCommand(`cd "${path}" && pwd`, {
      skipSafetyCheck: true,
    });
    if (result && result.exitCode === 0) {
      get().listRemoteFiles(result.cwd);
      get().refreshGitStatus();
      return true;
    }
    return false;
  },

  // ============================================================
  // Persistence
  // ============================================================

  loadSavedConnections: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(CONNECTIONS_KEY);
      const connections = raw ? JSON.parse(raw) : [];
      set({ savedConnections: connections });

      const prefer = localStorage.getItem(PREFER_REMOTE_KEY);
      if (prefer) {
        set({ preferRemote: JSON.parse(prefer) });
      }
    } catch {
      set({ savedConnections: [] });
    }
  },

  saveConnections: () => {
    if (typeof window === "undefined") return;
    const { savedConnections } = get();
    // Strip sensitive data before saving
    const safe = savedConnections.map((c) => ({
      ...c,
      password: c.authMethod === "password" ? c.password : undefined,
      privateKey: c.authMethod === "key" ? c.privateKey : undefined,
    }));
    localStorage.setItem(CONNECTIONS_KEY, JSON.stringify(safe));
  },

  loadLastWorkingDirectory: (connectionId: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(LAST_CWD_KEY);
      const map = raw ? JSON.parse(raw) : {};
      return map[connectionId] || null;
    } catch {
      return null;
    }
  },

  saveLastWorkingDirectory: (connectionId: string, dir: string) => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LAST_CWD_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[connectionId] = dir;
      localStorage.setItem(LAST_CWD_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  },

  // Reset
  reset: () => {
    stopHeartbeat();
    set({
      connectionStatus: "disconnected",
      activeSession: null,
      activeConnection: null,
      connectionError: null,
      executionContext: "sandbox",
      workingDirectory: "~",
      lastWorkingDirectory: null,
      directoryHistory: [],
      remoteFiles: [],
      systemInfo: null,
      gitStatus: null,
      terminalOutput: [],
      commandHistory: [],
      lastHeartbeat: null,
      reconnectAttempts: 0,
      isHealthy: false,
      pendingConfirmation: null,
    });
  },
}));

// ============================================================================
// Heartbeat management
// ============================================================================

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

function startHeartbeat() {
  stopHeartbeat();
  heartbeatInterval = setInterval(async () => {
    const store = useRemoteDevStore.getState();
    const { activeSession, connectionStatus } = store;

    if (!activeSession || connectionStatus !== "connected") {
      stopHeartbeat();
      return;
    }

    try {
      const res = await fetch("/api/builder/ssh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "heartbeat",
          sessionId: activeSession.sessionId,
        }),
      });

      const data = await res.json();

      if (data.success && data.connected) {
        store.updateHeartbeat();
        store.setIsHealthy(true);
      } else {
        store.setIsHealthy(false);
        store.addTerminalEntry({
          type: "warning",
          text: "Connection health check failed. Attempting to reconnect...",
        });
        store.reconnect();
      }
    } catch {
      store.setIsHealthy(false);
      store.addTerminalEntry({
        type: "warning",
        text: "Lost connection to remote server. Falling back to sandbox...",
      });
      store.setExecutionContext("sandbox");
      store.reconnect();
    }
  }, 30000); // 30-second heartbeat
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}
