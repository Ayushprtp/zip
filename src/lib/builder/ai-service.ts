import { ContextMention, LibraryType } from "@/types/builder";
import { getLibraryConfig } from "./library-configs";
import { autoConfigureShadcn } from "./shadcn-auto-config";

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
 * AI Service for generating code with streaming support
 * Integrates with Groq/Claude/Gemini APIs via AI SDK
 */
export class AIService {
  private abortController: AbortController | null = null;
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig = {}) {
    this.config = config;
  }

  /**
   * Generate code with streaming support
   */
  async generateCode(options: GenerateCodeOptions): Promise<string> {
    const {
      prompt,
      context,
      systemPrompt = "You are an expert software developer. Generate clean, working code.",
      libraryPreference,
      existingFiles = {},
      onFileCreated,
      onDependenciesNeeded,
      onToken,
      onComplete,
      onError,
    } = options;

    try {
      // Build context from mentions
      const contextString = this.buildContextString(context);

      // Build full system prompt with library preference
      const fullSystemPrompt = this.buildSystemPrompt(
        systemPrompt,
        libraryPreference,
      );

      // Create full prompt
      const fullPrompt = `${fullSystemPrompt}\n\n${contextString}\n\nUser Request: ${prompt}`;

      // Make API call with streaming
      const response = await this.streamCompletion(fullPrompt, onToken);

      // Parse response for file creations (if AI generated code with file paths)
      // This is a simplified version - in a real implementation, you'd parse the AI response
      // to extract file paths and contents
      if (
        libraryPreference === "shadcn" &&
        onFileCreated &&
        onDependenciesNeeded
      ) {
        this.handleShadcnAutoConfiguration(
          response,
          existingFiles,
          libraryPreference,
          onFileCreated,
          onDependenciesNeeded,
        );
      }

      onComplete?.(response);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      throw err;
    }
  }

  /**
   * Handle Shadcn auto-configuration when files are created
   */
  private handleShadcnAutoConfiguration(
    aiResponse: string,
    existingFiles: Record<string, string>,
    libraryPreference: LibraryType,
    onFileCreated: (path: string, content: string) => void,
    onDependenciesNeeded: (
      dependencies: Record<string, string>,
      devDependencies: Record<string, string>,
    ) => void,
  ): void {
    // Extract file paths from AI response (simplified - looks for common patterns)
    // In a real implementation, this would be more sophisticated
    const filePathPattern = /(?:\/src\/components\/ui\/[\w-]+\.tsx?)/g;
    const matches = aiResponse.match(filePathPattern);

    if (!matches || matches.length === 0) {
      return;
    }

    // Auto-configure for each detected Shadcn component
    for (const filePath of matches) {
      const autoConfig = autoConfigureShadcn(
        filePath,
        existingFiles,
        libraryPreference,
      );

      if (autoConfig) {
        // Create any needed files (like utils.ts)
        for (const [path, content] of Object.entries(
          autoConfig.filesToCreate,
        )) {
          onFileCreated(path, content);
        }

        // Notify about needed dependencies
        if (
          Object.keys(autoConfig.dependenciesToAdd).length > 0 ||
          Object.keys(autoConfig.devDependenciesToAdd).length > 0
        ) {
          onDependenciesNeeded(
            autoConfig.dependenciesToAdd,
            autoConfig.devDependenciesToAdd,
          );
        }
      }
    }
  }

  /**
   * Build system prompt with library preference
   */
  private buildSystemPrompt(
    basePrompt: string,
    libraryPreference?: LibraryType,
  ): string {
    if (!libraryPreference) {
      return basePrompt;
    }

    const libraryConfig = getLibraryConfig(libraryPreference);
    return `${basePrompt}\n\n${libraryConfig.systemPromptAddition}`;
  }

  /**
   * Build context string from mentions
   */
  private buildContextString(mentions: ContextMention[]): string {
    const contextParts: string[] = [];

    for (const mention of mentions) {
      if (mention.type === "files") {
        contextParts.push("=== Referenced Files ===");
        for (const file of mention.data) {
          contextParts.push(`\nFile: ${file.path}`);
          contextParts.push("```");
          contextParts.push(file.content);
          contextParts.push("```\n");
        }
      } else if (mention.type === "terminal") {
        contextParts.push("=== Console Output ===");
        for (const log of mention.data.logs) {
          contextParts.push(`[${log.level}] ${log.message}`);
        }
        contextParts.push("");
      } else if (mention.type === "docs") {
        contextParts.push("=== Documentation ===");
        contextParts.push(`Query: ${mention.data.query}`);
        if (mention.data.content) {
          contextParts.push(mention.data.content);
        }
        contextParts.push("");
      }
    }

    return contextParts.join("\n");
  }

  /**
   * Stream completion from AI API using AI SDK with Groq
   */
  private async streamCompletion(
    prompt: string,
    onToken?: (token: string) => void,
  ): Promise<string> {
    this.abortController = new AbortController();

    try {
      // Import dynamically to avoid server-side issues
      const { customModelProvider, DEFAULT_CHAT_MODEL } = await import(
        "@/lib/ai/models"
      );
      const { streamText } = await import("ai");

      // Get the model from config or use default (Groq)
      const chatModel =
        this.config.provider && this.config.modelName
          ? { provider: this.config.provider, model: this.config.modelName }
          : DEFAULT_CHAT_MODEL;

      const model = customModelProvider.getModel(chatModel);

      // Build system prompt for code generation
      const systemPrompt = `You are an expert code generator for a web development IDE. 
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

Always provide complete file contents, not just snippets.`;

      // Stream the response
      const result = await streamText({
        model,
        system: systemPrompt,
        prompt,
        abortSignal: this.abortController.signal,
      });

      let fullText = "";

      // Process the stream
      for await (const textPart of result.textStream) {
        fullText += textPart;
        onToken?.(textPart);
      }

      return fullText;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Request aborted");
      }
      throw error;
    }
  }

  /**
   * Cancel ongoing generation
   */
  cancel(): void {
    this.abortController?.abort();
  }

  /**
   * Retry with exponential backoff
   * Reserved for future use
   */
  // private async retryWithBackoff<T>(
  //   fn: () => Promise<T>,
  //   maxRetries: number = 3,
  // ): Promise<T> {
  //   for (let i = 0; i < maxRetries; i++) {
  //     try {
  //       return await fn();
  //     } catch (error) {
  //       if (i === maxRetries - 1) throw error;

  //       // Exponential backoff: 1s, 2s, 4s
  //       const delay = Math.pow(2, i) * 1000;
  //       await new Promise((resolve) => setTimeout(resolve, delay));
  //     }
  //   }

  //   throw new Error("Max retries exceeded");
  // }

  /**
   * Handle API errors
   * Reserved for future use
   */
  // private handleAPIError(error: any): Error {
  //   if (error.status === 429) {
  //     return new Error("Rate limit exceeded. Please try again later.");
  //   } else if (error.status >= 500) {
  //     return new Error(
  //       "AI service is temporarily unavailable. Please try again.",
  //     );
  //   } else if (error.status === 401) {
  //     return new Error("Invalid API key. Please check your configuration.");
  //   } else {
  //     return new Error(`AI service error: ${error.message || "Unknown error"}`);
  //   }
  // }
}

/**
 * Create AI service instance with configuration
 */
export function createAIService(config: AIServiceConfig): AIService {
  return new AIService(config);
}
