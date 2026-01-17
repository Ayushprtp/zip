"use client";

import React, { useEffect, useRef, useState } from "react";
import { ChatMessage } from "@/types/builder";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, mentions: any[]) => void;
  isStreaming?: boolean;
  streamingContent?: string;
  condensed?: boolean;
}

export function ChatInterface({
  messages,
  onSendMessage,
  isStreaming = false,
  streamingContent = "",
  condensed = false,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input, []);
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={`flex flex-col h-full ${condensed ? "text-sm" : ""}`}>
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        messagesEndRef={messagesEndRef}
        condensed={condensed}
      />
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onKeyDown={handleKeyDown}
        disabled={isStreaming}
        condensed={condensed}
      />
    </div>
  );
}

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  condensed?: boolean;
}

function MessageList({
  messages,
  isStreaming,
  streamingContent,
  messagesEndRef,
  condensed = false,
}: MessageListProps) {
  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
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
        <div ref={messagesEndRef} />
      </div>
    </ScrollArea>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  condensed?: boolean;
}

function MessageBubble({
  message,
  isStreaming = false,
  condensed = false,
}: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
      data-testid={`message-${message.id}`}
    >
      <div
        className={`${condensed ? "max-w-full" : "max-w-[80%]"} rounded-lg px-4 py-2 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        {isStreaming && (
          <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
        )}
        {!condensed && (
          <div className="text-xs opacity-70 mt-1">
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  condensed?: boolean;
}

function ChatInput({
  value,
  onChange,
  onSend,
  onKeyDown,
  disabled = false,
  condensed = false,
}: ChatInputProps) {
  return (
    <div className={`border-t ${condensed ? "p-2" : "p-4"}`}>
      <div className="flex gap-2">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message... (Shift+Enter for new line)"
          className={`${condensed ? "min-h-[40px] max-h-[120px]" : "min-h-[60px] max-h-[200px]"} resize-none`}
          disabled={disabled}
          data-testid="chat-input"
        />
        <Button
          onClick={onSend}
          disabled={disabled || !value.trim()}
          size={condensed ? "sm" : "icon"}
          data-testid="send-button"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
