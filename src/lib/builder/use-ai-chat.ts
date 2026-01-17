"use client";

import { useState, useCallback } from "react";
import { AIService, GenerateCodeOptions } from "./ai-service";
import { ContextMention, LibraryType } from "@/types/builder";
import { useChatHistory } from "./use-chat-history";
import { useStreamingResponse } from "./use-streaming-response";

interface UseAIChatOptions {
  projectId: string;
  aiService: AIService;
  systemPrompt?: string;
  libraryPreference?: LibraryType;
}

export function useAIChat({
  projectId,
  aiService,
  systemPrompt,
  libraryPreference,
}: UseAIChatOptions) {
  const { messages, addMessage } = useChatHistory(projectId);
  const {
    isStreaming,
    streamingContent,
    startStreaming,
    appendToken,
    finishStreaming,
    cancelStreaming,
  } = useStreamingResponse();

  const [error, setError] = useState<Error | null>(null);

  const sendMessage = useCallback(
    async (content: string, mentions: ContextMention[]) => {
      // Add user message immediately
      addMessage({
        role: "user",
        content,
        mentions,
      });

      // Start streaming
      startStreaming();
      setError(null);

      try {
        // Generate AI response
        await aiService.generateCode({
          prompt: content,
          context: mentions,
          systemPrompt,
          libraryPreference,
          onToken: (token) => {
            appendToken(token);
          },
          onComplete: (fullResponse) => {
            finishStreaming();

            // Add assistant message
            addMessage({
              role: "assistant",
              content: fullResponse,
              mentions: [],
            });
          },
          onError: (err) => {
            cancelStreaming();
            setError(err);

            // Add error message
            addMessage({
              role: "assistant",
              content: `Error: ${err.message}`,
              mentions: [],
            });
          },
        });
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        cancelStreaming();
      }
    },
    [
      aiService,
      systemPrompt,
      addMessage,
      startStreaming,
      appendToken,
      finishStreaming,
      cancelStreaming,
    ],
  );

  const cancelGeneration = useCallback(() => {
    aiService.cancel();
    cancelStreaming();
  }, [aiService, cancelStreaming]);

  return {
    messages,
    isStreaming,
    streamingContent,
    error,
    sendMessage,
    cancelGeneration,
  };
}
