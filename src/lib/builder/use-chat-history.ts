"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatMessage } from "@/types/builder";

const CHAT_HISTORY_KEY = "ai-builder-chat-history";

interface UseChatHistoryReturn {
  messages: ChatMessage[];
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void;
  clearHistory: () => void;
  isLoading: boolean;
}

/**
 * Hook for managing chat history with browser storage persistence
 */
export function useChatHistory(projectId: string): UseChatHistoryReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load chat history from browser storage on mount
  useEffect(() => {
    const loadHistory = () => {
      try {
        const stored = localStorage.getItem(`${CHAT_HISTORY_KEY}-${projectId}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          setMessages(parsed);
        }
      } catch (error) {
        console.error("Failed to load chat history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, [projectId]);

  // Save chat history to browser storage whenever messages change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(
          `${CHAT_HISTORY_KEY}-${projectId}`,
          JSON.stringify(messages),
        );
      } catch (error) {
        console.error("Failed to save chat history:", error);
      }
    }
  }, [messages, projectId, isLoading]);

  const addMessage = useCallback(
    (message: Omit<ChatMessage, "id" | "timestamp">) => {
      const newMessage: ChatMessage = {
        ...message,
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, newMessage]);
    },
    [],
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
    try {
      localStorage.removeItem(`${CHAT_HISTORY_KEY}-${projectId}`);
    } catch (error) {
      console.error("Failed to clear chat history:", error);
    }
  }, [projectId]);

  return {
    messages,
    addMessage,
    clearHistory,
    isLoading,
  };
}
