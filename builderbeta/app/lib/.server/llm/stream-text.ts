import { streamText as _streamText, convertToCoreMessages } from 'ai';

import { getAnthropicAPIKey, getOpenAIAPIKey } from '~/lib/.server/llm/api-key';
import { getAnthropicModel } from '~/lib/.server/llm/model';
import { getSystemPrompt } from './prompts';

const MAX_TOKENS = 128000;

interface ToolResult<Name extends string, Args, Result> {
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolInvocations?: ToolResult<string, unknown, unknown>[];
}

export type Messages = Message[];

export interface LLMRuntimeContext {
  previewBaseUrls?: string[];
  browserServerUrl?: string;
  browserServerApiKey?: string;
  browserExtensionBridgeSessionId?: string;
  browserExtensionName?: string;
}

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;

export async function streamText(
  messages: Messages,
  cloudflareEnv: any,
  options?: StreamingOptions,
  modelId?: string,
  preferences?: string,
  mode?: string,
  runtimeContext?: LLMRuntimeContext,
) {
  const env = typeof process !== 'undefined' ? process.env : {};

  const openAIKey = getOpenAIAPIKey(cloudflareEnv);
  const anthropicKey = getAnthropicAPIKey(cloudflareEnv);
  const useOpenAI = !!openAIKey;
  const baseUrl = cloudflareEnv?.OPENAI_API_BASE_URL || env.OPENAI_API_BASE_URL || 'https://api.flare.tech/v1';

  if (useOpenAI) {
    const apiKey = openAIKey;
    let targetModel = modelId || 'claude-sonnet-4-20250514';

    // All agents use the user-selected model — no hardcoded overrides.
    // The model selection is controlled entirely by the user from the UI dropdown.

    const finalMessages = [
      { role: 'system', content: getSystemPrompt(undefined, preferences, mode, runtimeContext) },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    console.log(`[StreamText] Delegating to: ${targetModel} (Mode: ${mode || 'Auto'})`);

    let response;
    let retries = 3;
    let lastError;

    while (retries > 0) {
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': 'Flare/1.0 (Coder Agent; Peak Performance Built)',
            Accept: 'text/event-stream',
            Connection: 'keep-alive',
          },
          body: JSON.stringify({
            model: targetModel,
            messages: finalMessages,
            stream: true,
            max_tokens: MAX_TOKENS,
            temperature: 0.1, // Low temperature for coding precision
            top_p: 0.95,
          }),
        });

        if (response.ok) {
          break;
        } // Success!

        const errorText = await response.text();
        console.error(`[StreamText] API Error (${response.status}): ${errorText}`);

        if (response.status === 401 || response.status === 403) {
          throw new Error(`Authentication failed. Please check your API key. (Status: ${response.status})`);
        }

        throw new Error(`API error: ${response.status} - ${errorText}`);
      } catch (err: any) {
        lastError = err;
        retries--;

        if (retries > 0) {
          console.warn(`[StreamText] Fetch failed, retrying... (${retries} retries left). Error: ${err.message}`);
          await new Promise((r) => setTimeout(r, 1000 * (3 - retries))); // Exponential backoff: 1s, 2s
        }
      }
    }

    if (!response || !response.ok) {
      throw Math.max(0, retries) === 0 && lastError
        ? lastError
        : new Error('Failed to connect to the text generation API after multiple attempts.');
    }

    const encoder = new TextEncoder();

    const transformedStream = new ReadableStream({
      async start(controller) {
        console.log('[StreamText] Streaming started...');

        if (!response.body) {
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let isReasoning = false;

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();

              if (trimmedLine.startsWith('data: ')) {
                const data = trimmedLine.slice(6).trim();

                if (data === '[DONE]') {
                  continue;
                }

                try {
                  const json = JSON.parse(data);

                  // Extract reasoning/thinking block if the model provides it
                  const reasoning =
                    json.choices?.[0]?.delta?.reasoning_content ||
                    json.choices?.[0]?.delta?.reasoning ||
                    json.choices?.[0]?.message?.reasoning_content;

                  const content = json.choices?.[0]?.delta?.content || '';

                  if (reasoning) {
                    if (!isReasoning) {
                      isReasoning = true;

                      // First reasoning token: emit the opening details block
                      controller.enqueue(
                        encoder.encode(
                          `0:${JSON.stringify(`\n<details>\n<summary>Thinking Process</summary>\n\n${reasoning}`)}\n`,
                        ),
                      );
                    } else {
                      // Subsequent reasoning tokens: just emit the text
                      controller.enqueue(encoder.encode(`0:${JSON.stringify(reasoning)}\n`));
                    }
                  }

                  if (content) {
                    if (isReasoning) {
                      isReasoning = false;

                      // Finished reasoning, starting content: emit closing details block before content
                      controller.enqueue(encoder.encode(`0:${JSON.stringify(`\n\n</details>\n\n${content}`)}\n`));
                    } else {
                      controller.enqueue(encoder.encode(`0:${JSON.stringify(content)}\n`));
                    }
                  }
                } catch (e) {
                  // Ignore parse errors for incomplete chunks
                }
              }
            }
          }

          // Process remaining buffer if it starts with data:
          if (buffer.trim().startsWith('data: ')) {
            const data = buffer.trim().slice(6).trim();

            if (data !== '[DONE]') {
              try {
                const json = JSON.parse(data);
                const content = json.choices?.[0]?.delta?.content || '';

                if (content) {
                  if (isReasoning) {
                    isReasoning = false;
                    controller.enqueue(encoder.encode(`0:${JSON.stringify(`\n\n</details>\n\n${content}`)}\n`));
                  } else {
                    controller.enqueue(encoder.encode(`0:${JSON.stringify(content)}\n`));
                  }
                }
              } catch (e) {}
            }
          }
        } catch (err: any) {
          console.error('[StreamText] Stream error:', err);
          // Gracefully terminate the stream and close any potentially open UI XML tags
          // to prevent the frontend from being stuck in a "generating file" state.
          controller.enqueue(
            encoder.encode(
              `0:${JSON.stringify(
                `\n\n</flareAction>\n</flareArtifact>\n\n> [!WARNING]\n> **Generation terminated early**\n> The AI provider closed the connection before finishing (this usually happens during very large code generation requests). You can ask the AI to continue.\n\n`,
              )}\n`,
            ),
          );
        } finally {
          // If stream ended while still reasoning (e.g., interrupted or no standard content returned)
          if (isReasoning) {
            controller.enqueue(encoder.encode(`0:${JSON.stringify(`\n\n</details>\n\n`)}\n`));
          }

          console.log('[StreamText] Streaming ended successfully');
          controller.close();
        }
      }, // start
    });

    return {
      toAIStream: () => transformedStream,
    } as any;
  }

  if (!anthropicKey) {
    throw new Error('No API key found. Set OPENAI_API_KEY (or VITE_OPENAI_API_KEY) for OpenAI-compatible routing, or ANTHROPIC_API_KEY for Anthropic routing.');
  }

  // Anthropic implementation
  const model = getAnthropicModel(anthropicKey);

  return _streamText({
    model: model,
    system: getSystemPrompt(undefined, preferences, mode, runtimeContext),
    maxTokens: MAX_TOKENS,
    headers: {
      'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15',
    },
    messages: convertToCoreMessages(messages as any),
    ...options,
  });
}
