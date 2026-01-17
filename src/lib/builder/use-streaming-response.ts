"use client";

import { useState, useCallback } from "react";

interface UseStreamingResponseReturn {
  isStreaming: boolean;
  streamingContent: string;
  startStreaming: () => void;
  appendToken: (token: string) => void;
  finishStreaming: () => string;
  cancelStreaming: () => void;
}

/**
 * Hook for managing token-by-token streaming display
 */
export function useStreamingResponse(): UseStreamingResponseReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");

  const startStreaming = useCallback(() => {
    setIsStreaming(true);
    setStreamingContent("");
  }, []);

  const appendToken = useCallback((token: string) => {
    setStreamingContent((prev) => prev + token);
  }, []);

  const finishStreaming = useCallback(() => {
    setIsStreaming(false);
    const finalContent = streamingContent;
    setStreamingContent("");
    return finalContent;
  }, [streamingContent]);

  const cancelStreaming = useCallback(() => {
    setIsStreaming(false);
    setStreamingContent("");
  }, []);

  return {
    isStreaming,
    streamingContent,
    startStreaming,
    appendToken,
    finishStreaming,
    cancelStreaming,
  };
}
