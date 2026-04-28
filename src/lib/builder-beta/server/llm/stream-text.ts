/**
 * Builder Beta LLM Stream Text
 * Ported from builderbeta Remix/Cloudflare to Next.js server-side.
 * All Cloudflare env references replaced with process.env.
 */

import { streamText as _streamText, convertToModelMessages } from 'ai';
import { getAnthropicAPIKey, getOpenAIAPIKey } from './api-key';
import { getAnthropicModel } from './model';
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
  options?: StreamingOptions,
  modelId?: string,
  preferences?: string,
  mode?: string,
  runtimeContext?: LLMRuntimeContext,
) {
  const openAIKey = getOpenAIAPIKey();
  const anthropicKey = getAnthropicAPIKey();
  const useOpenAI = !!openAIKey;
  const baseUrl = process.env.OPENAI_API_BASE_URL || 'https://api.flare.tech/v1';

  if (useOpenAI) {
    const apiKey = openAIKey;
    let targetModel = modelId || 'claude-sonnet-4-20250514';

    const finalMessages = [
      { role: 'system', content: getSystemPrompt(undefined, preferences, mode, runtimeContext) },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    console.log(`[Builder Beta StreamText] Delegating to: ${targetModel} (Mode: ${mode || 'Auto'})`);

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
            'User-Agent': 'Flare/1.0 (Builder Beta; Next.js)',
            Accept: 'text/event-stream',
            Connection: 'keep-alive',
          },
          body: JSON.stringify({
            model: targetModel,
            messages: finalMessages,
            stream: true,
            max_tokens: MAX_TOKENS,
            temperature: 0.1,
            top_p: 0.95,
          }),
        });

        if (response.ok) {
          break;
        }

        const errorText = await response.text();
        console.error(`[Builder Beta StreamText] API Error (${response.status}): ${errorText}`);

        if (response.status === 401 || response.status === 403) {
          throw new Error(`Authentication failed. Please check your API key. (Status: ${response.status})`);
        }

        throw new Error(`API error: ${response.status} - ${errorText}`);
      } catch (err: any) {
        lastError = err;
        retries--;

        if (retries > 0) {
          console.warn(`[Builder Beta StreamText] Fetch failed, retrying... (${retries} retries left). Error: ${err.message}`);
          await new Promise((r) => setTimeout(r, 1000 * (3 - retries)));
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
        console.log('[Builder Beta StreamText] Streaming started...');

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

                  const reasoning =
                    json.choices?.[0]?.delta?.reasoning_content ||
                    json.choices?.[0]?.delta?.reasoning ||
                    json.choices?.[0]?.message?.reasoning_content;

                  const content = json.choices?.[0]?.delta?.content || '';

                  if (reasoning) {
                    if (!isReasoning) {
                      isReasoning = true;
                      controller.enqueue(
                        encoder.encode(
                          `0:${JSON.stringify(`\n<details>\n<summary>Thinking Process</summary>\n\n${reasoning}`)}\n`,
                        ),
                      );
                    } else {
                      controller.enqueue(encoder.encode(`0:${JSON.stringify(reasoning)}\n`));
                    }
                  }

                  if (content) {
                    if (isReasoning) {
                      isReasoning = false;
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

          // Process remaining buffer
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
          console.error('[Builder Beta StreamText] Stream error:', err);
          controller.enqueue(
            encoder.encode(
              `0:${JSON.stringify(
                `\n\n</flareAction>\n</flareArtifact>\n\n> [!WARNING]\n> **Generation terminated early**\n> The AI provider closed the connection before finishing.\n\n`,
              )}\n`,
            ),
          );
        } finally {
          if (isReasoning) {
            controller.enqueue(encoder.encode(`0:${JSON.stringify(`\n\n</details>\n\n`)}\n`));
          }

          console.log('[Builder Beta StreamText] Streaming ended successfully');
          controller.close();
        }
      },
    });

    return {
      toAIStream: () => transformedStream,
    } as any;
  }

  if (!anthropicKey) {
    throw new Error('No API key found. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.');
  }

  // Anthropic implementation
  const model = getAnthropicModel(anthropicKey);

  return _streamText({
    model: model,
    system: getSystemPrompt(undefined, preferences, mode, runtimeContext),
    maxOutputTokens: MAX_TOKENS,
    headers: {
      'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15',
    },
    messages: await convertToModelMessages(messages as any),
    ...options,
  });
}
