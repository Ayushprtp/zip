/**
 * ChatMode Layout - Full-screen chat interface
 * Displays chat interface only, hiding code editor and preview
 */

"use client";

import React from "react";
import { ChatInterface } from "./chat-interface";

// ============================================================================
// ChatMode Component
// ============================================================================

interface ChatModeProps {
  className?: string;
}

/**
 * ChatMode displays a full-screen chat interface
 * Requirements: 10.2 - Display full-screen chat interface, hide code editor and preview
 */
export function ChatMode({ className }: ChatModeProps) {
  return (
    <div className={`flex h-full w-full flex-col ${className || ""}`}>
      <ChatInterface />
    </div>
  );
}
