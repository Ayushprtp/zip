"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Globe,
  Wifi,
  WifiOff,
  X,
  Maximize2,
  Minimize2,
  Loader2,
  Settings,
  ArrowUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  SSHConnectionManager,
  type SSHConnection,
} from "./SSHConnectionManager";

interface SSHTerminalProps {
  onClose?: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

const SSH_CONNECTIONS_KEY = "flare-ssh-connections";

function loadConnections(): SSHConnection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SSH_CONNECTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConnectionsToStorage(connections: SSHConnection[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SSH_CONNECTIONS_KEY, JSON.stringify(connections));
}

export function SSHTerminal({
  onClose,
  isMaximized,
  onToggleMaximize,
}: SSHTerminalProps) {
  const [connections, setConnections] = useState<SSHConnection[]>(() =>
    loadConnections(),
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
    null,
  );
  const [connecting, setConnecting] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [history, setHistory] = useState<
    Array<{ type: "input" | "output" | "error" | "system"; text: string }>
  >([]);
  const [input, setInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cwd, setCwd] = useState("~");

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  // Focus input
  useEffect(() => {
    if (!showManager) {
      inputRef.current?.focus();
    }
  }, [showManager, sessionId]);

  const handleSaveConnections = useCallback((updated: SSHConnection[]) => {
    setConnections(updated);
    saveConnectionsToStorage(updated);
  }, []);

  const handleConnect = useCallback(async (conn: SSHConnection) => {
    setConnecting(true);
    setHistory([
      {
        type: "system",
        text: `Connecting to ${conn.username}@${conn.host}:${conn.port}...`,
      },
    ]);

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
        }),
      });

      const data = await res.json();

      if (data.connected) {
        setSessionId(data.sessionId);
        setActiveConnectionId(conn.id);
        setShowManager(false);
        setCwd("~");
        setHistory((h) => [
          ...h,
          {
            type: "system",
            text: `✓ ${data.message}`,
          },
          {
            type: "system",
            text: "Type commands below. Use 'exit' to disconnect.",
          },
        ]);
        toast.success(`Connected to ${conn.host}`);
      } else {
        setHistory((h) => [
          ...h,
          {
            type: "error",
            text: `✗ ${data.error || "Connection failed"}`,
          },
        ]);
        toast.error(data.error || "Connection failed");
      }
    } catch (err: any) {
      setHistory((h) => [
        ...h,
        { type: "error", text: `✗ ${err.message || "Connection failed"}` },
      ]);
      toast.error(err.message || "Connection failed");
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    if (sessionId) {
      try {
        await fetch("/api/builder/ssh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "disconnect", sessionId }),
        });
      } catch {
        // ignore
      }
    }
    setSessionId(null);
    setActiveConnectionId(null);
    setCwd("~");
    setHistory((h) => [
      ...h,
      { type: "system", text: "Disconnected from remote server." },
    ]);
    toast.info("SSH disconnected");
  }, [sessionId]);

  const executeCommand = useCallback(
    async (command: string) => {
      if (!sessionId || !command.trim()) return;

      const trimmed = command.trim();

      // Handle exit
      if (trimmed === "exit" || trimmed === "logout") {
        await handleDisconnect();
        return;
      }

      // Handle clear
      if (trimmed === "clear") {
        setHistory([]);
        return;
      }

      setHistory((h) => [...h, { type: "input", text: `${cwd} $ ${trimmed}` }]);
      setCommandHistory((h) => [...h, trimmed]);
      setHistoryIndex(-1);
      setExecuting(true);

      try {
        // Wrap with cd tracking
        const wrappedCommand = `${trimmed}; echo "___CWD___$(pwd)"`;

        const res = await fetch("/api/builder/ssh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "exec",
            sessionId,
            command: wrappedCommand,
          }),
        });

        const data = await res.json();

        if (data.error) {
          setHistory((h) => [...h, { type: "error", text: data.error }]);
        } else {
          let output = data.output || "";

          // Extract CWD from output
          const cwdMatch = output.match(/___CWD___(.*?)$/m);
          if (cwdMatch) {
            setCwd(cwdMatch[1].trim());
            output = output.replace(/___CWD___.*$/m, "").trimEnd();
          }

          if (output) {
            setHistory((h) => [...h, { type: "output", text: output }]);
          }
          if (data.stderr) {
            setHistory((h) => [...h, { type: "error", text: data.stderr }]);
          }
        }
      } catch (err: any) {
        setHistory((h) => [
          ...h,
          { type: "error", text: err.message || "Command failed" },
        ]);
      } finally {
        setExecuting(false);
      }
    },
    [sessionId, cwd, handleDisconnect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        executeCommand(input);
        setInput("");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (commandHistory.length > 0) {
          const newIndex =
            historyIndex === -1
              ? commandHistory.length - 1
              : Math.max(0, historyIndex - 1);
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex]);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex >= 0) {
          const newIndex = historyIndex + 1;
          if (newIndex >= commandHistory.length) {
            setHistoryIndex(-1);
            setInput("");
          } else {
            setHistoryIndex(newIndex);
            setInput(commandHistory[newIndex]);
          }
        }
      } else if (e.key === "c" && e.ctrlKey) {
        setInput("");
        setHistory((h) => [...h, { type: "system", text: "^C" }]);
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        setHistory([]);
      }
    },
    [input, commandHistory, historyIndex, executeCommand],
  );

  // If showing manager
  if (showManager) {
    return (
      <SSHConnectionManager
        connections={connections}
        activeSessionId={sessionId}
        activeConnectionId={activeConnectionId}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onSaveConnections={handleSaveConnections}
        onClose={() => setShowManager(false)}
      />
    );
  }

  // If not connected, show connect prompt
  if (!sessionId) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">SSH Remote</span>
            <WifiOff className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              Not connected
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            {onToggleMaximize && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onToggleMaximize}
                className="h-5 w-5"
              >
                {isMaximized ? (
                  <Minimize2 className="h-3 w-3" />
                ) : (
                  <Maximize2 className="h-3 w-3" />
                )}
              </Button>
            )}
            {onClose && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onClose}
                className="h-5 w-5"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Connection Prompt */}
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
            <Globe className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">SSH Remote Connection</p>
            <p className="text-xs text-muted-foreground mt-1">
              Connect to a remote server to execute commands
            </p>
          </div>

          {connecting ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting...
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={() => setShowManager(true)}
                className="h-8 text-xs"
              >
                <Settings className="h-3 w-3 mr-1" />
                Manage Connections
              </Button>
              {connections.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleConnect(connections[0])}
                  className="h-8 text-xs"
                >
                  <Wifi className="h-3 w-3 mr-1" />
                  Quick Connect
                </Button>
              )}
            </div>
          )}

          {/* Recent output */}
          {history.length > 0 && (
            <div className="w-full max-w-md mt-2">
              {history.slice(-3).map((entry, i) => (
                <p
                  key={`history-${i}`}
                  className={`text-[10px] font-mono ${
                    entry.type === "error"
                      ? "text-red-500"
                      : entry.type === "system"
                        ? "text-blue-500"
                        : "text-muted-foreground"
                  }`}
                >
                  {entry.text}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Connected — show terminal
  const activeConn = connections.find((c) => c.id === activeConnectionId);

  return (
    <div
      className="flex flex-col h-full bg-[#1a1b26] text-[#a9b1d6] font-mono text-xs"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-[#2a2b3d] bg-[#16161e] shrink-0">
        <div className="flex items-center gap-2">
          <Wifi className="h-3 w-3 text-green-400" />
          <span className="text-[10px] text-green-400 font-medium">
            {activeConn
              ? `${activeConn.username}@${activeConn.host}`
              : "Connected"}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowManager(true)}
            className="h-5 w-5 text-[#a9b1d6] hover:text-white hover:bg-[#2a2b3d]"
            title="Connections"
          >
            <Settings className="h-3 w-3" />
          </Button>
          {onToggleMaximize && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onToggleMaximize}
              className="h-5 w-5 text-[#a9b1d6] hover:text-white hover:bg-[#2a2b3d]"
            >
              {isMaximized ? (
                <Minimize2 className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </Button>
          )}
          {onClose && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                handleDisconnect();
                onClose();
              }}
              className="h-5 w-5 text-[#a9b1d6] hover:text-white hover:bg-[#2a2b3d]"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Terminal Output */}
      <div ref={outputRef} className="flex-1 overflow-y-auto p-2 min-h-0">
        {history.map((entry, i) => (
          <div
            key={`line-${i}`}
            className="leading-5 whitespace-pre-wrap break-all"
          >
            {entry.type === "input" && (
              <span className="text-[#7aa2f7]">{entry.text}</span>
            )}
            {entry.type === "output" && (
              <span className="text-[#a9b1d6]">{entry.text}</span>
            )}
            {entry.type === "error" && (
              <span className="text-[#f7768e]">{entry.text}</span>
            )}
            {entry.type === "system" && (
              <span className="text-[#9ece6a]">{entry.text}</span>
            )}
          </div>
        ))}
        {executing && (
          <div className="flex items-center gap-1 text-[#bb9af7]">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>executing...</span>
          </div>
        )}
      </div>

      {/* Input Line */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-t border-[#2a2b3d] bg-[#16161e] shrink-0">
        <span className="text-[#7aa2f7] shrink-0 text-[11px]">{cwd} $</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={executing}
          className="flex-1 bg-transparent outline-none text-[#a9b1d6] text-[11px] placeholder:text-[#565f89] caret-[#7aa2f7]"
          placeholder={executing ? "waiting..." : "type a command..."}
          autoFocus
          spellCheck={false}
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            executeCommand(input);
            setInput("");
          }}
          disabled={executing || !input.trim()}
          className="h-5 w-5 shrink-0 text-[#7aa2f7] hover:text-white hover:bg-[#2a2b3d]"
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
