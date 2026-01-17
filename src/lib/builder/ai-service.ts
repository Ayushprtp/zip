import { ContextMention, LibraryType } from "@/types/builder";
import { getLibraryConfig } from "./library-configs";
import {
  autoConfigureShadcn,
  mergeDependenciesIntoPackageJson,
} from "./shadcn-auto-config";

export interface AIServiceConfig {
  apiKey: string;
  model: "claude" | "gemini";
  baseUrl?: string;
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
 * Integrates with Claude/Gemini APIs
 */
export class AIService {
  private config: AIServiceConfig;
  private abortController: AbortController | null = null;

  constructor(config: AIServiceConfig) {
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
   * Stream completion from AI API
   */
  private async streamCompletion(
    _prompt: string,
    onToken?: (token: string) => void,
  ): Promise<string> {
    this.abortController = new AbortController();

    // This is a placeholder implementation
    // In a real implementation, this would call the actual AI API
    // For now, we'll simulate streaming

    return new Promise((resolve, reject) => {
      const simulatedResponse = "Generated code response";
      let index = 0;

      const interval = setInterval(() => {
        if (this.abortController?.signal.aborted) {
          clearInterval(interval);
          reject(new Error("Request aborted"));
          return;
        }

        if (index < simulatedResponse.length) {
          const token = simulatedResponse[index];
          onToken?.(token);
          index++;
        } else {
          clearInterval(interval);
          resolve(simulatedResponse);
        }
      }, 50);
    });
  }

  /**
   * Cancel ongoing generation
   */
  cancel(): void {
    this.abortController?.abort();
  }

  /**
   * Retry with exponential backoff
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
  ): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error;

        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, i) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error("Max retries exceeded");
  }

  /**
   * Handle API errors
   */
  private handleAPIError(error: any): Error {
    if (error.status === 429) {
      return new Error("Rate limit exceeded. Please try again later.");
    } else if (error.status >= 500) {
      return new Error(
        "AI service is temporarily unavailable. Please try again.",
      );
    } else if (error.status === 401) {
      return new Error("Invalid API key. Please check your configuration.");
    } else {
      return new Error(`AI service error: ${error.message || "Unknown error"}`);
    }
  }
}

/**
 * Create AI service instance with configuration
 */
export function createAIService(config: AIServiceConfig): AIService {
  return new AIService(config);
}
