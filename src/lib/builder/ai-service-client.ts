/**
 * Client-side AI Service for Builder
 * Makes direct streaming requests without using the chat API
 */

import { ContextMention, LibraryType } from "@/types/builder";

export interface AIServiceConfig {
  apiKey?: string;
  model?: "claude" | "gemini" | "groq";
  baseUrl?: string;
  provider?: string;
  modelName?: string;
}

export interface GenerateCodeOptions {
  prompt: string;
  context: ContextMention[];
  systemPrompt?: string;
  libraryPreference?: LibraryType;
  existingFiles?: Record<string, string>;
  onFileCreated?: (path: string, content: string) => void;
  onDependenciesNeeded?: (
    dependencies: Record<string, string>,
    devDependencies: Record<string, string>,
  ) => void;
  onToken?: (token: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Client-side AI Service for generating code
 * Uses a dedicated builder AI endpoint
 */
export class AIServiceClient {
  private abortController: AbortController | null = null;

  constructor(private config: AIServiceConfig = {}) {}

  /**
   * Generate code using streaming API
   */
  async generateCode(options: GenerateCodeOptions): Promise<string> {
    const {
      prompt,
      systemPrompt = "You are an expert code generator for a web development IDE.",
      existingFiles = {},
      onToken,
      onComplete,
      onError,
    } = options;

    try {
      this.abortController = new AbortController();

      // Build the prompt with instructions
      const fullPrompt = `${systemPrompt}

When generating or modifying code:
1. Wrap each file in a code block with the file path
2. Use format: \`\`\`filepath:/path/to/file.ext
3. Include complete, working code
4. Follow best practices and modern standards
5. Add helpful comments
6. Ensure code is production-ready

Example response format:
\`\`\`filepath:/src/App.jsx
import React from 'react';

export default function App() {
  return <div>Hello World</div>;
}
\`\`\`

Current files in project:
${Object.keys(existingFiles).join(", ") || "No files yet"}

User request: ${prompt}`;

      // Call the dedicated builder AI endpoint
      const response = await fetch("/api/builder/ai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          provider: this.config.provider || "groq",
          model: this.config.modelName || "llama-3.3-70b-versatile",
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      // Read the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        onToken?.(chunk);
      }

      onComplete?.(fullText);
      return fullText;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      throw err;
    }
  }

  /**
   * Cancel ongoing generation
   */
  cancel(): void {
    this.abortController?.abort();
  }
}

/**
 * Create AI service instance for builder
 */
export function createBuilderAIService(
  config: AIServiceConfig = {},
): AIServiceClient {
  return new AIServiceClient({
    provider: "groq",
    modelName: "llama-3.3-70b-versatile",
    ...config,
  });
}
