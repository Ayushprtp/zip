"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  memo,
  useMemo,
} from "react";
import { ChatMessage } from "@/types/builder";
import { Button } from "@/components/ui/button";
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  FileCode2,
  StopCircle,
  Paperclip,
  Image as ImageIcon,
  Mic,
  ChevronUp,
  X,
  GitCommitHorizontal,
  FileText,
  Plus,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (
    content: string,
    mentions?: any[],
    attachments?: File[],
  ) => void;
  isStreaming?: boolean;
  streamingContent?: string;
  condensed?: boolean;
  onStopStreaming?: () => void;
  onReviewChanges?: () => void;
  hasUncommittedChanges?: boolean;
  modelName?: string;
  onModelChange?: () => void;
}

// ─── Main Component ────────────────────────────────────────────────────────

export function ChatInterface({
  messages,
  onSendMessage,
  isStreaming = false,
  streamingContent = "",
  condensed = false,
  onStopStreaming,
  onReviewChanges,
  hasUncommittedChanges = false,
  modelName,
  onModelChange,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);

  const handleSend = useCallback(() => {
    if (input.trim() && !isStreaming) {
      onSendMessage(
        input.trim(),
        undefined,
        attachments.length > 0 ? attachments : undefined,
      );
      setInput("");
      setAttachments([]);
    }
  }, [input, onSendMessage, isStreaming, attachments]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleAttachFile = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        setAttachments((prev) => [...prev, ...Array.from(files)]);
      }
    };
    input.click();
  }, []);

  const handleAttachImage = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        setAttachments((prev) => [...prev, ...Array.from(files)]);
      }
    };
    input.click();
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="flex flex-col h-full">
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        condensed={condensed}
      />

      {/* Review Changes Button (floating above input) */}
      {hasUncommittedChanges && onReviewChanges && (
        <div className="px-3 -mb-1">
          <button
            onClick={onReviewChanges}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-t-lg bg-muted/60 hover:bg-muted/80 border border-b-0 border-border/40 text-xs text-muted-foreground hover:text-foreground transition-all group"
          >
            <GitCommitHorizontal className="h-3 w-3 text-violet-400 group-hover:text-violet-300" />
            <span className="font-medium">Review Changes</span>
          </button>
        </div>
      )}

      {/* Cursor-style Input Bar */}
      <ChatInputBar
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onKeyDown={handleKeyDown}
        isStreaming={isStreaming}
        onStopStreaming={onStopStreaming}
        onAttachFile={handleAttachFile}
        onAttachImage={handleAttachImage}
        attachments={attachments}
        onRemoveAttachment={removeAttachment}
        modelName={modelName}
        onModelChange={onModelChange}
      />
    </div>
  );
}

// ─── Message List ──────────────────────────────────────────────────────────

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  condensed?: boolean;
}

const MessageList = memo(function MessageList({
  messages,
  isStreaming,
  streamingContent,
  condensed = false,
}: MessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (messages.length !== prevCount || isStreaming) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [messages.length, isStreaming, streamingContent]);

  // Empty state
  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-[220px]">
          <div className="mx-auto w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center shadow-lg shadow-violet-500/5">
            <Sparkles className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground/80">
              Flare Builder AI
            </p>
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
              Describe what you want to build. I&apos;ll write the code directly
              into your project files.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {[
              "Build a landing page",
              "Add authentication",
              "Create an API",
              "Fix a bug",
            ].map((suggestion) => (
              <button
                key={suggestion}
                className="text-[9px] px-2 py-1.5 rounded-md border border-border/40 bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all text-left leading-tight"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
      <div className="space-y-0.5 p-2">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            condensed={condensed}
          />
        ))}
        {isStreaming && streamingContent && (
          <MessageBubble
            message={{
              id: "streaming",
              role: "assistant",
              content: streamingContent,
              mentions: [],
              timestamp: Date.now(),
            }}
            isStreaming
            condensed={condensed}
          />
        )}
        {isStreaming && !streamingContent && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center shrink-0">
              <Bot className="h-3 w-3 text-violet-400" />
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-[11px]">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
});

// ─── Message Bubble ────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  condensed?: boolean;
}

function hasCodeBlocks(content: string): boolean {
  return /```[\w./-]*\n/.test(content);
}

const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming = false,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const containsCode = useMemo(
    () => !isUser && hasCodeBlocks(message.content),
    [isUser, message.content],
  );

  return (
    <div
      className={`flex gap-2 px-2 py-1.5 rounded-md transition-colors ${isUser ? "bg-transparent" : "bg-muted/30"}`}
      data-testid={`message-${message.id}`}
    >
      {/* Avatar */}
      <div
        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
          isUser
            ? "bg-primary/10"
            : "bg-gradient-to-br from-violet-500/20 to-indigo-500/20"
        }`}
      >
        {isUser ? (
          <User className="h-3 w-3 text-primary/70" />
        ) : (
          <Bot className="h-3 w-3 text-violet-400" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] leading-relaxed break-words whitespace-pre-wrap text-foreground/90">
          {message.content}
        </div>
        {containsCode && !isStreaming && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-500/70">
            <FileCode2 className="h-3 w-3" />
            <span>Files updated</span>
          </div>
        )}
        {isStreaming && (
          <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-violet-400 animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  );
});

// ─── Cursor-Style Chat Input Bar ───────────────────────────────────────────

interface ChatInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isStreaming?: boolean;
  onStopStreaming?: () => void;
  onAttachFile?: () => void;
  onAttachImage?: () => void;
  attachments?: File[];
  onRemoveAttachment?: (index: number) => void;
  modelName?: string;
  onModelChange?: () => void;
}

function ChatInputBar({
  value,
  onChange,
  onSend,
  onKeyDown,
  isStreaming = false,
  onStopStreaming,
  onAttachFile,
  onAttachImage,
  attachments = [],
  onRemoveAttachment,
  modelName = "GPT-4.1 Mini",
  onModelChange,
}: ChatInputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [value]);

  return (
    <div className="border-t border-border/40 bg-background/80 backdrop-blur-sm">
      {/* Attachment Preview Strip */}
      {attachments.length > 0 && (
        <div className="flex gap-2 px-3 pt-2 pb-1 overflow-x-auto">
          {attachments.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 border border-border/40 text-[10px] text-muted-foreground shrink-0 group"
            >
              {file.type.startsWith("image/") ? (
                <ImageIcon className="h-3 w-3 text-blue-400" />
              ) : (
                <FileText className="h-3 w-3 text-amber-400" />
              )}
              <span className="max-w-[80px] truncate">{file.name}</span>
              <button
                onClick={() => onRemoveAttachment?.(index)}
                className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Input Area */}
      <div className="px-3 py-2">
        <div className="relative rounded-xl border border-border/50 bg-muted/20 focus-within:border-violet-500/40 focus-within:ring-1 focus-within:ring-violet-500/20 transition-all">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              isStreaming
                ? "Waiting for response..."
                : "Ask anything (⌘L), @ to mention, / for workflow"
            }
            className="w-full min-h-[40px] max-h-[120px] resize-none text-[12px] bg-transparent px-3 pt-2.5 pb-9 focus:outline-none text-foreground placeholder:text-muted-foreground/60 leading-relaxed"
            disabled={isStreaming}
            data-testid="chat-input"
            rows={1}
          />

          {/* Bottom Toolbar */}
          <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between px-1.5 py-0.5">
            {/* Left side — action buttons */}
            <div className="flex items-center gap-0.5">
              {/* Add/Attach Menu */}
              <button
                onClick={onAttachFile}
                className="p-1.5 rounded-md hover:bg-muted/80 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                title="Attach file"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>

              {/* File attachment */}
              <button
                onClick={onAttachFile}
                className="p-1.5 rounded-md hover:bg-muted/80 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                title="Attach file"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>

              {/* Image attachment */}
              <button
                onClick={onAttachImage}
                className="p-1.5 rounded-md hover:bg-muted/80 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                title="Attach image"
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Right side — model selector, mic, send */}
            <div className="flex items-center gap-1">
              {/* Model Selector */}
              <button
                onClick={onModelChange}
                className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted/80 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                title="Change AI model"
              >
                <ChevronUp className="h-3 w-3" />
                <span className="text-[10px] font-medium">{modelName}</span>
              </button>

              {/* Mic button */}
              <button
                className="p-1.5 rounded-md hover:bg-muted/80 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                title="Voice input"
              >
                <Mic className="h-3.5 w-3.5" />
              </button>

              {/* Send / Stop */}
              {isStreaming ? (
                <Button
                  onClick={onStopStreaming}
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg"
                  data-testid="stop-button"
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={onSend}
                  disabled={!value.trim()}
                  size="icon"
                  className="h-7 w-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-20 disabled:bg-muted/60 disabled:text-muted-foreground/40 transition-all shadow-sm"
                  data-testid="send-button"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
