"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Wifi,
  X,
  Maximize2,
  Minimize2,
  Loader2,
  Settings,
  ArrowUp,
  GitBranch,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRemoteDevStore } from "@/stores/remote-dev-store";
import { RemoteConnectionPanel } from "./RemoteConnectionPanel";

interface RemoteTerminalProps {
  onClose?: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export function RemoteTerminal({
  onClose,
  isMaximized,
  onToggleMaximize,
}: RemoteTerminalProps) {
  const {
    connectionStatus,
    activeConnection,
    workingDirectory,
    terminalOutput,
    commandHistory,
    gitStatus,
    isHealthy,
    executionContext,
    pendingConfirmation,
    disconnect,
    executeCommand,
    addTerminalEntry,
    clearTerminal,
    setPendingConfirmation,
    refreshGitStatus,
    loadSavedConnections,
  } = useRemoteDevStore();

  const [input, setInput] = useState("");
  const [executing, setExecuting] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showConnectionPanel, setShowConnectionPanel] = useState(false);

  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isConnected = connectionStatus === "connected";

  // Load saved connections on mount
  useEffect(() => {
    loadSavedConnections();
  }, [loadSavedConnections]);

  // Auto-scroll
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // Focus input
  useEffect(() => {
    if (!showConnectionPanel && isConnected) {
      inputRef.current?.focus();
    }
  }, [showConnectionPanel, isConnected]);

  const handleExecute = useCallback(
    async (command: string) => {
      if (!command.trim()) return;

      const trimmed = command.trim();

      if (trimmed === "exit" || trimmed === "logout") {
        await disconnect();
        return;
      }

      if (trimmed === "clear") {
        clearTerminal();
        return;
      }

      setExecuting(true);
      setHistoryIndex(-1);

      try {
        await executeCommand(trimmed);
      } finally {
        setExecuting(false);
      }
    },
    [disconnect, clearTerminal, executeCommand],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleExecute(input);
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
        addTerminalEntry({ type: "system", text: "^C" });
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        clearTerminal();
      }
    },
    [
      input,
      commandHistory,
      historyIndex,
      handleExecute,
      addTerminalEntry,
      clearTerminal,
    ],
  );

  const handleConfirmDangerous = useCallback(async () => {
    if (!pendingConfirmation) return;

    const command = pendingConfirmation.command;
    setPendingConfirmation(null);

    setExecuting(true);
    try {
      await executeCommand(command, { skipSafetyCheck: true });
    } finally {
      setExecuting(false);
    }
  }, [pendingConfirmation, executeCommand, setPendingConfirmation]);

  const handleDenyDangerous = useCallback(() => {
    if (pendingConfirmation) {
      addTerminalEntry({
        type: "warning",
        text: `Command cancelled: ${pendingConfirmation.command}`,
      });
      setPendingConfirmation(null);
    }
  }, [pendingConfirmation, addTerminalEntry, setPendingConfirmation]);

  // Show connection panel if not connected
  if (showConnectionPanel || !isConnected) {
    return (
      <RemoteConnectionPanel
        onClose={() => {
          setShowConnectionPanel(false);
          if (!isConnected && onClose) onClose();
        }}
        isMaximized={isMaximized}
        onToggleMaximize={onToggleMaximize}
      />
    );
  }

  // Connected — show terminal
  return (
    <div
      className="flex flex-col h-full bg-[#1a1b26] text-[#a9b1d6] font-mono text-xs"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-[#2a2b3d] bg-[#16161e] shrink-0">
        <div className="flex items-center gap-2">
          {/* Connection status indicator */}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isHealthy ? "bg-green-400 animate-pulse" : "bg-yellow-400"
              }`}
            />
            <Wifi className="h-3 w-3 text-green-400" />
            <span className="text-[10px] text-green-400 font-medium">
              {activeConnection
                ? `${activeConnection.username}@${activeConnection.host}`
                : "Connected"}
            </span>
          </div>

          {/* Execution context badge */}
          <span
            className={`px-1 py-0.5 text-[8px] rounded-sm uppercase font-bold ${
              executionContext === "remote"
                ? "bg-green-500/20 text-green-400"
                : "bg-blue-500/20 text-blue-400"
            }`}
          >
            {executionContext}
          </span>

          {/* Git branch */}
          {gitStatus?.isRepo && gitStatus.branch && (
            <div className="flex items-center gap-0.5 text-[10px] text-[#bb9af7]">
              <GitBranch className="h-2.5 w-2.5" />
              <span>{gitStatus.branch}</span>
              {(gitStatus.ahead || 0) > 0 && (
                <span className="text-green-400">↑{gitStatus.ahead}</span>
              )}
              {(gitStatus.behind || 0) > 0 && (
                <span className="text-red-400">↓{gitStatus.behind}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => refreshGitStatus()}
            className="h-5 w-5 text-[#a9b1d6] hover:text-white hover:bg-[#2a2b3d]"
            title="Refresh status"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setShowConnectionPanel(true)}
            className="h-5 w-5 text-[#a9b1d6] hover:text-white hover:bg-[#2a2b3d]"
            title="Connection settings"
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
                disconnect();
                onClose();
              }}
              className="h-5 w-5 text-[#a9b1d6] hover:text-white hover:bg-[#2a2b3d]"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Safety confirmation banner */}
      {pendingConfirmation && (
        <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/30 shrink-0">
          <div className="flex items-start gap-2">
            <span
              className={`px-1.5 py-0.5 text-[9px] rounded font-bold uppercase ${
                pendingConfirmation.riskLevel === "critical"
                  ? "bg-red-600 text-white"
                  : pendingConfirmation.riskLevel === "high"
                    ? "bg-orange-500 text-white"
                    : pendingConfirmation.riskLevel === "medium"
                      ? "bg-yellow-500 text-black"
                      : "bg-blue-500 text-white"
              }`}
            >
              {pendingConfirmation.riskLevel}
            </span>
            <div className="flex-1">
              <p className="text-[11px] text-red-400 font-medium">
                {pendingConfirmation.reason}
              </p>
              <p className="text-[10px] text-[#a9b1d6] mt-0.5 font-mono">
                $ {pendingConfirmation.command}
              </p>
            </div>
          </div>
          <div className="flex gap-1.5 mt-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleConfirmDangerous}
              className="h-6 text-[10px] px-2"
            >
              Confirm & Execute
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDenyDangerous}
              className="h-6 text-[10px] px-2 border-[#2a2b3d] text-[#a9b1d6]"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Terminal Output */}
      <div ref={outputRef} className="flex-1 overflow-y-auto p-2 min-h-0">
        {terminalOutput.map((entry) => (
          <div
            key={entry.id}
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
            {entry.type === "warning" && (
              <span className="text-[#e0af68]">{entry.text}</span>
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
        <span className="text-[#7aa2f7] shrink-0 text-[11px]">
          {workingDirectory} $
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={executing || !!pendingConfirmation}
          className="flex-1 bg-transparent outline-none text-[#a9b1d6] text-[11px] placeholder:text-[#565f89] caret-[#7aa2f7]"
          placeholder={
            pendingConfirmation
              ? "confirm or cancel the command above..."
              : executing
                ? "waiting..."
                : "type a command..."
          }
          autoFocus
          spellCheck={false}
        />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            handleExecute(input);
            setInput("");
          }}
          disabled={executing || !input.trim() || !!pendingConfirmation}
          className="h-5 w-5 shrink-0 text-[#7aa2f7] hover:text-white hover:bg-[#2a2b3d]"
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
