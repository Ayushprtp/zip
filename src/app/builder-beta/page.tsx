"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useStore } from "@nanostores/react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { generateUUID } from "lib/utils";
import { motion } from "framer-motion";
import {
  Send,
  Square,
  Wand2,
  FlaskConical,
  CheckSquare,
  Newspaper,
  Gamepad2,
  LayoutDashboard,
} from "lucide-react";

import { workbenchStore } from "@/lib/builder-beta/stores/workbench";
import { selectedModelStore } from "@/lib/builder-beta/stores/model";
import {
  activeMode,
  MODES,
  type NativeMode,
} from "@/lib/builder-beta/stores/modes";
import { Messages } from "@/components/builder-beta/chat/Messages";
import { Workbench } from "@/components/builder-beta/workbench/Workbench";

/**
 * Builder Beta — Main Page
 *
 * Full IDE-like experience: Chat + Workbench (editor, terminal, preview).
 * Uses Nanostores for workbench state, AI SDK v6 for chat.
 */

const EXAMPLE_PROMPTS = [
  { text: "Build a todo app in React using Tailwind", icon: CheckSquare },
  { text: "Build a simple blog using Astro", icon: Newspaper },
  { text: "Make a space invaders game", icon: Gamepad2 },
  { text: "Create a dashboard with charts", icon: LayoutDashboard },
];

export default function BuilderBetaPage() {
  const [chatStarted, setChatStarted] = useState(false);
  const selectedModel = useStore(selectedModelStore);
  const currentMode = useStore(activeMode);
  const showWorkbench = useStore(workbenchStore.showWorkbench);
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

  const isStreaming = useMemo(
    () => status === "streaming" || status === "submitted",
    [status],
  );

  /** Extract text from UIMessage parts */
  function getMessageText(msg: UIMessage): string {
    return (msg.parts || [])
      .filter((p) => p.type === "text")
      .map((p) => (p as { type: "text"; text: string }).text)
      .join("");
  }

  /** Convert UIMessages to simple { role, content } for Messages component */
  const simpleMessages = useMemo(
    () =>
      messages.map((m) => ({
        role: m.role,
        content: getMessageText(m),
      })),
    [messages],
  );

  const handleSendMessage = useCallback(
    async (_event?: React.UIEvent, messageInput?: string) => {
      const text = messageInput || input.trim();
      if (text.length === 0 || isStreaming) return;

      if (!chatStarted) {
        setChatStarted(true);
      }

      sendMessage({
        role: "user",
        parts: [{ type: "text", text }],
      });

      setInput("");
      textareaRef.current?.blur();
    },
    [input, isStreaming, chatStarted, sendMessage],
  );

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
      const maxH = chatStarted ? 400 : 200;
      textarea.style.height = `${Math.min(scrollHeight, maxH)}px`;
      textarea.style.overflowY = scrollHeight > maxH ? "auto" : "hidden";
    }
  }, [input, chatStarted]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-full w-full bg-zinc-950 relative">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <FlaskConical className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-sm font-semibold text-zinc-100">
              Builder Beta
            </h1>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-medium">
            Preview
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode Toggle */}
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

          {/* Model Selector */}
          <select
            value={selectedModel}
            onChange={(e) => selectedModelStore.set(e.target.value)}
            className="bg-zinc-800 text-zinc-300 text-xs rounded-lg px-2.5 py-1.5 border border-zinc-700 focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
          >
            <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
            <option value="claude-3-5-sonnet-20240620">
              Claude 3.5 Sonnet
            </option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="deepseek-chat">DeepSeek Chat</option>
          </select>

          {/* Workbench Toggle */}
          {chatStarted && (
            <button
              onClick={() => workbenchStore.showWorkbench.set(!showWorkbench)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-all font-medium ${
                showWorkbench
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700"
              }`}
            >
              {showWorkbench ? "Hide" : "Show"} Workbench
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Chat Panel */}
        <div
          className={`flex flex-col h-full transition-all duration-300 ${
            showWorkbench ? "w-[40%]" : "w-full"
          }`}
        >
          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            {!chatStarted && messages.length === 0 && (
              <motion.div
                className="flex flex-col items-center justify-center h-full"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              >
                <motion.div
                  className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-xl shadow-violet-500/25 mb-6"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <FlaskConical className="w-8 h-8 text-white" />
                </motion.div>
                <motion.h2
                  className="text-4xl font-bold text-white mb-2 tracking-tight"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  Ignite your vision.
                </motion.h2>
                <motion.p
                  className="text-zinc-500 text-base font-medium mb-8"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                >
                  The state-of-the-art AI workspace for creators and developers.
                </motion.p>
              </motion.div>
            )}

            {chatStarted && (
              <Messages
                className="max-w-4xl mx-auto px-4 py-6"
                messages={simpleMessages}
                isStreaming={isStreaming}
              />
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="px-4 pb-4">
            <div
              className={`relative max-w-4xl mx-auto ${
                showWorkbench ? "max-w-full" : ""
              }`}
            >
              <motion.div
                className="rounded-2xl overflow-hidden border border-zinc-700/50 bg-zinc-800/30 backdrop-blur-sm shadow-2xl focus-within:border-violet-500/40 focus-within:ring-1 focus-within:ring-violet-500/20 transition-all"
                initial={!chatStarted ? { opacity: 0, y: 20 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
              >
                <textarea
                  ref={textareaRef}
                  className="w-full pl-4 pt-4 pr-16 focus:outline-none resize-none text-sm text-white placeholder-zinc-500 bg-transparent"
                  onKeyDown={handleKeyDown}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  style={{ minHeight: 76, maxHeight: chatStarted ? 400 : 200 }}
                  placeholder="How can Builder Beta help you today?"
                  translate="no"
                />
                <div className="flex justify-between items-center text-sm p-3 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      disabled={input.length === 0}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-zinc-500 hover:text-violet-300 hover:bg-violet-500/10 disabled:opacity-30 transition-all text-xs"
                      title="Enhance prompt"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Enhance</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    {isStreaming ? (
                      <button
                        onClick={() => stop()}
                        className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        title="Stop generating"
                      >
                        <Square className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendMessage()}
                        disabled={input.trim().length === 0}
                        className="p-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-lg shadow-violet-500/20"
                        title="Send message"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Example Prompts */}
              {!chatStarted && (
                <motion.div
                  className="flex flex-col items-center mt-6 gap-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 1.0 }}
                >
                  {EXAMPLE_PROMPTS.map((prompt, index) => {
                    const Icon = prompt.icon;
                    return (
                      <motion.button
                        key={index}
                        onClick={() =>
                          handleSendMessage(undefined, prompt.text)
                        }
                        className="group flex items-center gap-3 text-zinc-500 hover:text-zinc-200 transition-all duration-200 text-sm"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.3,
                          delay: 1.0 + index * 0.08,
                        }}
                        whileHover={{ x: 4 }}
                      >
                        <Icon className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                        {prompt.text}
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}

              <div className="flex items-center justify-between mt-2 px-1">
                <p className="text-[10px] text-zinc-600">
                  Press{" "}
                  <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-500 text-[10px]">
                    Enter
                  </kbd>{" "}
                  to send,{" "}
                  <kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-500 text-[10px]">
                    Shift+Enter
                  </kbd>{" "}
                  for new line
                </p>
                <p className="text-[10px] text-zinc-700">Builder Beta v0.1</p>
              </div>
            </div>
          </div>
        </div>

        {/* Workbench */}
        <Workbench chatStarted={chatStarted} isStreaming={isStreaming} />
      </div>
    </div>
  );
}
