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
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  FileCode2,
  StopCircle,
} from "lucide-react";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, mentions?: any[]) => void;
  isStreaming?: boolean;
  streamingContent?: string;
  condensed?: boolean;
  onStopStreaming?: () => void;
}

export function ChatInterface({
  messages,
  onSendMessage,
  isStreaming = false,
  streamingContent = "",
  condensed = false,
  onStopStreaming,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");

  const handleSend = useCallback(() => {
    if (input.trim() && !isStreaming) {
      onSendMessage(input.trim());
      setInput("");
    }
  }, [input, onSendMessage, isStreaming]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex flex-col h-full">
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        condensed={condensed}
      />
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onKeyDown={handleKeyDown}
        isStreaming={isStreaming}
        onStopStreaming={onStopStreaming}
        condensed={condensed}
      />
    </div>
  );
}

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

  // Auto-scroll when new messages or streaming content changes
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
        <div className="text-center space-y-3 max-w-[200px]">
          <div className="mx-auto w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-foreground/80">Builder AI</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
              Describe what you want to build and I&apos;ll generate the code
              directly into your project files.
            </p>
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

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  condensed?: boolean;
}

/** Detect if a message contains file code blocks */
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
        {/* Code indicator */}
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

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isStreaming?: boolean;
  onStopStreaming?: () => void;
  condensed?: boolean;
}

function ChatInput({
  value,
  onChange,
  onSend,
  onKeyDown,
  isStreaming = false,
  onStopStreaming,
}: ChatInputProps) {
  return (
    <div className="border-t border-border/50 p-2 bg-muted/20">
      <div className="flex gap-1.5 items-end">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            isStreaming ? "Waiting for response..." : "Ask AI to build..."
          }
          className="min-h-[36px] max-h-[100px] resize-none text-[11px] bg-background/50 border-border/50 rounded-lg px-2.5 py-2 focus-visible:ring-1 focus-visible:ring-violet-500/30"
          disabled={isStreaming}
          data-testid="chat-input"
        />
        {isStreaming ? (
          <Button
            onClick={onStopStreaming}
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-red-400 hover:text-red-300 hover:bg-red-400/10"
            data-testid="stop-button"
          >
            <StopCircle className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={onSend}
            disabled={!value.trim()}
            size="icon"
            className="h-8 w-8 shrink-0 bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-30"
            data-testid="send-button"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
