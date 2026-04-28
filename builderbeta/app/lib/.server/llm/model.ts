import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

export function getAnthropicModel(apiKey: string) {
  const anthropic = createAnthropic({
    apiKey,
  });

  return anthropic('claude-3-5-sonnet-20240620');
}

export function getOpenAIModel(apiKey: string, modelId: string = 'gpt-4o', baseUrl?: string) {
  const openai = createOpenAI({
    apiKey,
    baseURL: baseUrl,
  });

  return openai(modelId);
}
