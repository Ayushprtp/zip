/**
 * Factory for creating AI service instances with proper configuration
 * Defaults to Groq models for fast, cost-effective code generation
 */

import { AIService, AIServiceConfig } from "./ai-service";

/**
 * Create an AI service instance configured for the builder
 * Uses Groq by default for fast inference speeds
 */
export function createBuilderAIService(
  overrides?: Partial<AIServiceConfig>,
): AIService {
  const config: AIServiceConfig = {
    // Default to Groq with Llama 3.3 70B (fast and capable)
    provider: "groq",
    modelName: "llama-3.3-70b-versatile",
    ...overrides,
  };

  return new AIService(config);
}

/**
 * Create an AI service for code generation tasks
 * Uses Llama 4 Scout for optimal code generation
 */
export function createCodeGenerationService(): AIService {
  return new AIService({
    provider: "groq",
    modelName: "llama-4-scout", // Optimized for code and reasoning
  });
}

/**
 * Create an AI service for chat/assistant tasks
 * Uses Llama 4 Maverick for better conversational abilities
 */
export function createChatService(): AIService {
  return new AIService({
    provider: "groq",
    modelName: "llama-4-maverick", // Better for chat and creative tasks
  });
}

/**
 * Create an AI service for fast responses
 * Uses the fastest available model
 */
export function createFastResponseService(): AIService {
  return new AIService({
    provider: "groq",
    modelName: "llama-3.1-8b-instant", // Fastest model
  });
}

/**
 * Create an AI service with custom model selection
 */
export function createCustomAIService(
  provider: string,
  modelName: string,
): AIService {
  return new AIService({
    provider,
    modelName,
  });
}
