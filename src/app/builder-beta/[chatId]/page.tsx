"use client";

import { useParams } from "next/navigation";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useStore } from "@nanostores/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { generateUUID } from "lib/utils";
import { Send, Square, FlaskConical } from "lucide-react";

import { workbenchStore } from "@/lib/builder-beta/stores/workbench";
import { selectedModelStore } from "@/lib/builder-beta/stores/model";
import { activeMode, MODES, type NativeMode } from "@/lib/builder-beta/stores/modes";
import { Messages } from "@/components/builder-beta/chat/Messages";
import { Workbench } from "@/components/builder-beta/workbench/Workbench";

/**
 * Builder Beta — Chat Session Page
 * Renders a specific chat session by ID with full workbench integration.
 */

export default function BuilderBetaChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const selectedModel = useStore(selectedModelStore);
  const currentMode = useStore(activeMode);
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, status, sendMessage, stop } = useChat({
    id: chatId,
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

  const isStreaming = useMemo(
    () => status === "streaming" || status === "submitted",
    [status],
  );

  function getMessageText(msg: UIMessage): string {
    return (msg.parts || [])
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("");
  }

  const simpleMessages = useMemo(
    () =>
      messages.map((m) => ({
        role: m.role,
        content: getMessageText(m),
      })),
    [messages],
  );

  const handleSendMessage = useCallback(async () => {
    if (input.trim().length === 0 || isStreaming) return;

    sendMessage({
      role: "user",
      parts: [{ type: "text", text: input }],
    });

    setInput("");
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(scrollHeight, 400)}px`;
    }
  }, [input]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <FlaskConical className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="text-sm font-semibold text-zinc-100">
              Builder Beta
            </h1>
          </div>
          <span className="text-xs text-zinc-500 font-mono">
            {chatId?.slice(0, 8)}...
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5 bg-zinc-800 rounded-full p-0.5 border border-zinc-700/50">
            {Object.entries(MODES).map(([key, m]) => (
              <button
                key={key}
                onClick={() => activeMode.set(key as NativeMode)}
                className={`px-3 py-1 text-[11px] rounded-full transition-all font-medium ${
                  currentMode === key
                    ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {m.label.replace(" Mode", "")}
              </button>
            ))}
          </div>

          <select
            value={selectedModel}
            onChange={(e) => selectedModelStore.set(e.target.value)}
            className="bg-zinc-800 text-zinc-300 text-xs rounded-lg px-2 py-1.5 border border-zinc-700"
          >
            <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
            <option value="claude-3-5-sonnet-20240620">
              Claude 3.5 Sonnet
            </option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
          </select>

          <button
            onClick={() =>
              workbenchStore.showWorkbench.set(!showWorkbench)
            }
            className={`px-3 py-1.5 text-xs rounded-lg transition-all font-medium ${
              showWorkbench
                ? "bg-violet-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700"
            }`}
          >
            {showWorkbench ? "Hide" : "Show"} Workbench
          </button>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden relative">
        <div
          className={`flex flex-col h-full transition-all duration-300 ${
            showWorkbench ? "w-[40%]" : "w-full"
          }`}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <Messages
              className={`mx-auto px-4 py-6 ${showWorkbench ? "max-w-full" : "max-w-4xl"}`}
              messages={simpleMessages}
              isStreaming={isStreaming}
            />
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-zinc-800">
            <div className="relative flex items-end gap-2 bg-zinc-800/30 rounded-xl border border-zinc-700/50 focus-within:border-violet-500/40 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Continue the conversation..."
                rows={1}
                className="flex-1 bg-transparent text-zinc-100 text-sm px-4 py-3 resize-none focus:outline-none placeholder:text-zinc-500"
              />
              <div className="flex items-center gap-1 px-2 pb-2">
                {isStreaming ? (
                  <button
                    onClick={() => stop()}
                    className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleSendMessage}
                    disabled={input.trim().length === 0}
                    className="p-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Workbench */}
        <Workbench chatStarted={true} isStreaming={isStreaming} />
      </div>
    </div>
  );
}
