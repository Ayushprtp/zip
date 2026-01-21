/**
 * ChatMode Layout - Full-screen chat interface
 * Displays chat interface only, hiding code editor and preview
 */

"use client";

import { ChatInterface } from "./chat-interface";
import type { ChatMessage } from "@/types/builder";

// ============================================================================
// ChatMode Component
// ============================================================================

interface ChatModeProps {
  className?: string;
  messages: ChatMessage[];
  onSendMessage: (content: string, mentions: any[]) => void;
}

/**
 * ChatMode displays a full-screen chat interface
 * Requirements: 10.2 - Display full-screen chat interface, hide code editor and preview
 */
export function ChatMode({
  className,
  messages,
  onSendMessage,
}: ChatModeProps) {
  return (
    <div className={`flex h-full w-full flex-col ${className || ""}`}>
      <ChatInterface messages={messages} onSendMessage={onSendMessage} />
    </div>
  );
}
