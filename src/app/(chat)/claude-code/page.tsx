"use client";

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";
import {
  SendIcon,
  TerminalIcon,
  GitCommitIcon,
  RotateCcwIcon,
  Loader2,
  CopyIcon,
  CheckIcon,
  Code2Icon,
  FolderGit2Icon,
  PlayIcon,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

interface GitCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

// ─── Component ────────────────────────────────────────────────────────────
export default function ClaudeCodePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "terminal" | "git">(
    "chat",
  );
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalOutput, setTerminalOutput] = useState<
    Array<{ type: "cmd" | "output" | "error"; text: string }>
  >([]);
  const [gitCommits, setGitCommits] = useState<GitCommit[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalOutput]);

  // ─── Chat ──────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const resp = await fetch("/api/claude-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!resp.ok) {
        throw new Error(`API error: ${resp.status}`);
      }

      // Parse SSE stream
      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response body");

      let fullContent = "";
      const assistantId = `msg-${Date.now()}-assistant`;

      // Add placeholder message
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        },
      ]);

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") continue;

          try {
            const json = JSON.parse(dataStr);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: fullContent } : m,
                ),
              );
            }
          } catch {
            // Skip parse errors
          }
        }
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-error`,
          role: "assistant",
          content: `Error: ${err.message}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ─── Terminal ──────────────────────────────────────────────────────────
  const runCommand = useCallback(async () => {
    if (!terminalInput.trim()) return;

    const cmd = terminalInput.trim();
    setTerminalOutput((prev) => [...prev, { type: "cmd", text: `$ ${cmd}` }]);
    setTerminalInput("");

    try {
      const resp = await fetch("/api/sandbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cmd, language: "shell" }),
      });

      const result = await resp.json();
      if (result.stdout) {
        setTerminalOutput((prev) => [
          ...prev,
          { type: "output", text: result.stdout },
        ]);
      }
      if (result.stderr) {
        setTerminalOutput((prev) => [
          ...prev,
          { type: "error", text: result.stderr },
        ]);
      }
    } catch (err: any) {
      setTerminalOutput((prev) => [
        ...prev,
        { type: "error", text: err.message },
      ]);
    }
  }, [terminalInput]);

  // ─── Git ───────────────────────────────────────────────────────────────
  const loadGitHistory = useCallback(async () => {
    try {
      const resp = await fetch("/api/git/auto-commit?projectPath=default");
      const data = await resp.json();
      if (data.commits) {
        setGitCommits(data.commits);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    if (activeTab === "git") {
      loadGitHistory();
    }
  }, [activeTab, loadGitHistory]);

  // ─── Copy ──────────────────────────────────────────────────────────────
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Code2Icon className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold">Claude Code</h1>
            <p className="text-xs text-muted-foreground">
              AI-powered coding agent
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="ml-auto flex gap-1 bg-muted/50 rounded-lg p-0.5">
          {[
            { id: "chat" as const, label: "Chat", icon: Code2Icon },
            { id: "terminal" as const, label: "Terminal", icon: TerminalIcon },
            { id: "git" as const, label: "Git", icon: FolderGit2Icon },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Tab */}
      {activeTab === "chat" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/20 flex items-center justify-center">
                  <Code2Icon className="w-8 h-8 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">
                    Welcome to Claude Code
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 max-w-md">
                    Ask me to write code, debug issues, refactor, or explain
                    anything. I can also execute code in a sandbox and manage
                    git.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 max-w-sm w-full mt-4">
                  {[
                    "Write a Python web scraper",
                    "Debug this React component",
                    "Explain async/await",
                    "Create a REST API",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="text-left text-xs p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 border border-border/30"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium opacity-70">
                      {msg.role === "user" ? "You" : "Claude Code"}
                    </span>
                    {msg.role === "assistant" && (
                      <button
                        onClick={() => copyToClipboard(msg.content, msg.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {copiedId === msg.id ? (
                          <CheckIcon className="w-3 h-3 text-green-500" />
                        ) : (
                          <CopyIcon className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="text-sm whitespace-pre-wrap break-words">
                    {msg.content || (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Thinking...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border/50 p-4">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Claude Code anything..."
                  rows={1}
                  className="w-full resize-none bg-muted/30 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                  style={{
                    minHeight: "44px",
                    maxHeight: "200px",
                  }}
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                className="h-11 w-11 flex items-center justify-center rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <SendIcon className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terminal Tab */}
      {activeTab === "terminal" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto bg-zinc-950 p-4 font-mono text-sm">
            {terminalOutput.length === 0 && (
              <div className="text-zinc-500 text-center mt-8">
                <TerminalIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>E2B Cloud Sandbox Terminal</p>
                <p className="text-xs mt-1">
                  Commands run in a secure, isolated sandbox
                </p>
              </div>
            )}
            {terminalOutput.map((entry, i) => (
              <div
                key={i}
                className={`mb-1 ${
                  entry.type === "cmd"
                    ? "text-green-400"
                    : entry.type === "error"
                      ? "text-red-400"
                      : "text-zinc-300"
                }`}
              >
                <pre className="whitespace-pre-wrap break-all">
                  {entry.text}
                </pre>
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>
          <div className="border-t border-zinc-800 bg-zinc-950 p-2">
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-mono text-sm">$</span>
              <input
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runCommand();
                  }
                }}
                placeholder="Enter command..."
                className="flex-1 bg-transparent text-zinc-200 font-mono text-sm focus:outline-none placeholder-zinc-600"
              />
              <button
                onClick={runCommand}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1"
              >
                <PlayIcon className="w-3 h-3" />
                Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Git Tab */}
      {activeTab === "git" && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <FolderGit2Icon className="w-4 h-4" />
              Git Version History
            </h2>
            <button
              onClick={loadGitHistory}
              className="text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcwIcon className="w-3 h-3" />
              Refresh
            </button>
          </div>

          {gitCommits.length === 0 ? (
            <div className="text-center text-muted-foreground mt-8 space-y-2">
              <GitCommitIcon className="w-8 h-8 mx-auto opacity-50" />
              <p className="text-sm">No commits yet</p>
              <p className="text-xs">
                AI agent changes will be automatically committed here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {gitCommits.map((commit, i) => (
                <div
                  key={commit.sha || i}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/30 hover:bg-muted/30 transition-colors"
                >
                  <div className="mt-0.5">
                    <GitCommitIcon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {commit.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <code className="bg-muted/50 px-1.5 py-0.5 rounded font-mono">
                        {commit.sha?.slice(0, 7)}
                      </code>
                      <span>{commit.author}</span>
                      <span>{commit.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
