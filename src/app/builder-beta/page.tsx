"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { generateUUID } from "lib/utils";

/**
 * Builder Beta — Main Page
 *
 * This is the entry point for the Builder Beta system.
 * It provides an IDE-like chat interface with a workbench (editor, terminal, preview).
 */

export default function BuilderBetaPage() {
  const [chatStarted, setChatStarted] = useState(false);
  const [selectedModel, setSelectedModel] = useState(
    "claude-sonnet-4-20250514",
  );
  const [currentMode, setCurrentMode] = useState<"auto" | "planning">("auto");
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, status, sendMessage, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/builder-beta/chat",
      body: {
        model: selectedModel,
        mode: currentMode,
      },
    }),
    generateId: generateUUID,
    onError: (error) => {
      console.error("[Builder Beta] Request failed:", error);
    },
  });

  const isLoading = useMemo(
    () => status === "streaming" || status === "submitted",
    [status],
  );

  const handleSendMessage = useCallback(async () => {
    if (input.trim().length === 0 || isLoading) return;

    if (!chatStarted) {
      setChatStarted(true);
    }

    sendMessage({
      role: "user",
      parts: [{ type: "text", text: input }],
    });

    setInput("");
    textareaRef.current?.blur();
  }, [input, isLoading, chatStarted, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, 400)}px`;
      textarea.style.overflowY = scrollHeight > 400 ? "auto" : "hidden";
    }
  }, [input]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /** Extract text from a UIMessage's parts */
  function getMessageText(message: UIMessage): string {
    return (message.parts || [])
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("");
  }

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950">
      {/* Header Bar */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">β</span>
            </div>
            <h1 className="text-sm font-semibold text-zinc-100">
              Builder Beta
            </h1>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-medium">
            Preview
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode Toggle */}
          <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-0.5">
            <button
              onClick={() => setCurrentMode("auto")}
              className={`px-3 py-1 text-xs rounded-md transition-all ${
                currentMode === "auto"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Auto
            </button>
            <button
              onClick={() => setCurrentMode("planning")}
              className={`px-3 py-1 text-xs rounded-md transition-all ${
                currentMode === "planning"
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Plan
            </button>
          </div>

          {/* Model Selector */}
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-zinc-800 text-zinc-300 text-xs rounded-lg px-2 py-1.5 border border-zinc-700 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
            <option value="claude-3-5-sonnet-20240620">
              Claude 3.5 Sonnet
            </option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="deepseek-chat">DeepSeek Chat</option>
          </select>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <div className="flex flex-col w-full max-w-4xl mx-auto">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!chatStarted && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                  <span className="text-white text-2xl font-bold">β</span>
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-semibold text-zinc-100 mb-2">
                    Builder Beta
                  </h2>
                  <p className="text-zinc-400 text-sm max-w-md">
                    An advanced AI coding environment with agentic capabilities,
                    real-time code editing, terminal access, and browser preview.
                  </p>
                </div>

                {/* Quick Start Examples */}
                <div className="grid grid-cols-2 gap-3 max-w-lg w-full mt-4">
                  {[
                    "Build a full-stack Next.js app with auth",
                    "Create a real-time chat application",
                    "Design a dashboard with charts",
                    "Build a REST API with Express",
                  ].map((example) => (
                    <button
                      key={example}
                      onClick={() => {
                        setInput(example);
                        textareaRef.current?.focus();
                      }}
                      className="p-3 text-left text-xs text-zinc-400 bg-zinc-800/50 hover:bg-zinc-800 rounded-xl border border-zinc-700/50 hover:border-violet-500/30 transition-all"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                    message.role === "user"
                      ? "bg-violet-600 text-white"
                      : "bg-zinc-800 text-zinc-200 border border-zinc-700/50"
                  }`}
                >
                  <pre className="whitespace-pre-wrap font-sans">
                    {getMessageText(message)}
                  </pre>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 text-zinc-400 rounded-xl px-4 py-3 text-sm border border-zinc-700/50">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span
                        className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                    <span>Generating...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-zinc-800">
            <div className="relative flex items-end gap-2 bg-zinc-800/50 rounded-xl border border-zinc-700/50 focus-within:border-violet-500/50 transition-colors">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe what you want to build..."
                rows={1}
                className="flex-1 bg-transparent text-zinc-100 text-sm px-4 py-3 resize-none focus:outline-none placeholder:text-zinc-500"
              />
              <div className="flex items-center gap-1 px-2 pb-2">
                {isLoading ? (
                  <button
                    onClick={() => stop()}
                    className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    title="Stop generating"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={handleSendMessage}
                    disabled={input.trim().length === 0}
                    className="p-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Send message"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19V5m0 0l-7 7m7-7l7 7"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <p className="text-xs text-zinc-500">
                Press{" "}
                <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">
                  Enter
                </kbd>{" "}
                to send,{" "}
                <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">
                  Shift+Enter
                </kbd>{" "}
                for new line
              </p>
              <p className="text-xs text-zinc-600">Builder Beta v0.1</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
