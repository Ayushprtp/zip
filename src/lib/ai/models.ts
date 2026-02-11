import "server-only";

// Disable AI SDK warnings
process.env.AI_SDK_LOG_WARNINGS = "false";

import { LanguageModel } from "ai";
import { ChatModel } from "app-types/chat";
import {
  DEFAULT_FILE_PART_MIME_TYPES,
  GEMINI_FILE_MIME_TYPES,
} from "./file-support";

// --- Custom Gemini Proxy Setup (OpenAI-Compatible API) ---
const FLARE_BASE_URL =
  process.env.CUSTOM_GEMINI_BASE_URL || "https://api.flare-sh.tech/v1";
const FLARE_API_KEY = process.env.CUSTOM_GEMINI_API_KEY || "";

/**
 * Creates a LanguageModelV3-compliant model object that proxies to the
 * Flare OpenAI-compatible API.
 */
function CustomModel(modelId: string): any {
  const baseURL = FLARE_BASE_URL;
  const apiKey = FLARE_API_KEY;

  /**
   * Converts AI SDK v3 prompt messages into OpenAI-compatible messages.
   */
  function convertPromptToMessages(prompt: any[]): any[] {
    return prompt
      .map((m: any) => {
        if (m.role === "system") {
          return {
            role: "system",
            content: typeof m.content === "string" ? m.content : "",
          };
        }

        // For user/assistant/tool roles, content can be a string or array of parts
        let textContent = "";
        if (typeof m.content === "string") {
          textContent = m.content;
        } else if (Array.isArray(m.content)) {
          textContent = m.content
            .filter(
              (c: any) => c && (c.type === "text" || c.type === "reasoning"),
            )
            .map((c: any) => c.text || "")
            .join("");
        }

        return {
          role: m.role === "tool" ? "user" : m.role,
          content: textContent || " ", // Ensure non-empty content
        };
      })
      .filter((m: any) => m.content && m.content.trim().length > 0);
  }

  return {
    specificationVersion: "v3" as const,
    provider: "customGemini",
    modelId: modelId,
    supportedUrls: {} as Record<string, RegExp[]>,

    doGenerate: async (options: any) => {
      const messages = convertPromptToMessages(options.prompt || []);

      const resp = await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          stream: false,
        }),
      });

      if (!resp.ok) {
        const errorBody = await resp.text().catch(() => "Unknown error");
        throw new Error(`API error ${resp.status}: ${errorBody}`);
      }

      const data = await resp.json();
      const content: any[] = [];

      // Extract reasoning content if present
      const reasoningContent = data.choices?.[0]?.message?.reasoning_content;
      if (reasoningContent) {
        content.push({ type: "reasoning", text: reasoningContent });
      }

      // Extract text content
      const textContent = data.choices?.[0]?.message?.content || "";
      if (textContent) {
        content.push({ type: "text", text: textContent });
      }

      return {
        content,
        finishReason: {
          unified: "stop" as const,
          raw: data.choices?.[0]?.finish_reason || "stop",
        },
        usage: {
          inputTokens: {
            total: data.usage?.prompt_tokens || 0,
            noCache: undefined,
            cacheRead: undefined,
            cacheWrite: undefined,
          },
          outputTokens: {
            total: data.usage?.completion_tokens || 0,
            text: undefined,
            reasoning: undefined,
          },
        },
        request: { body: { model: modelId, messages } },
        response: {
          id: data.id,
          modelId: data.model || modelId,
        },
        warnings: [],
      };
    },

    doStream: async (options: any) => {
      const messages = convertPromptToMessages(options.prompt || []);

      const resp = await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          stream: true,
        }),
        signal: options.abortSignal,
      });

      if (!resp.ok) {
        const errorBody = await resp.text().catch(() => "Unknown error");
        throw new Error(`API error ${resp.status}: ${errorBody}`);
      }

      // Generate unique IDs for text/reasoning segments
      let textIdCounter = 0;
      let reasoningIdCounter = 0;
      const genTextId = () => `text-${textIdCounter++}`;
      const genReasoningId = () => `reasoning-${reasoningIdCounter++}`;

      const stream = new ReadableStream({
        async start(controller) {
          // Emit stream-start as required by v3
          controller.enqueue({
            type: "stream-start",
            warnings: [],
          });

          let hasStartedText = false;
          let hasStartedReasoning = false;
          let currentTextId = genTextId();
          let currentReasoningId = genReasoningId();
          let totalPromptTokens = 0;
          let totalCompletionTokens = 0;
          let rawFinishReason: string | undefined;

          try {
            if (!resp.body) {
              // No body, just finish
              controller.enqueue({
                type: "finish",
                finishReason: { unified: "stop" as const, raw: undefined },
                usage: {
                  inputTokens: {
                    total: 0,
                    noCache: undefined,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: {
                    total: 0,
                    text: undefined,
                    reasoning: undefined,
                  },
                },
              });
              controller.close();
              return;
            }

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (line.trim() === "") continue;
                if (!line.startsWith("data: ")) continue;

                const dataStr = line.slice(6).trim();
                if (dataStr === "[DONE]") continue;

                try {
                  const json = JSON.parse(dataStr);

                  // Extract usage from the final chunk if present
                  if (json.usage) {
                    totalPromptTokens = json.usage.prompt_tokens || 0;
                    totalCompletionTokens = json.usage.completion_tokens || 0;
                  }

                  const choice = json.choices?.[0];
                  if (!choice) continue;

                  if (choice.finish_reason) {
                    rawFinishReason = choice.finish_reason;
                  }

                  const delta = choice.delta;
                  if (!delta) continue;

                  // Handle reasoning_content
                  const reasoningDelta = delta.reasoning_content;
                  if (reasoningDelta) {
                    if (controller.desiredSize === null) return;

                    // End any current text segment before starting reasoning
                    if (hasStartedText) {
                      controller.enqueue({
                        type: "text-end",
                        id: currentTextId,
                      });
                      hasStartedText = false;
                      currentTextId = genTextId();
                    }

                    if (!hasStartedReasoning) {
                      controller.enqueue({
                        type: "reasoning-start",
                        id: currentReasoningId,
                      });
                      hasStartedReasoning = true;
                    }
                    controller.enqueue({
                      type: "reasoning-delta",
                      id: currentReasoningId,
                      delta: reasoningDelta,
                    });
                  }

                  // Handle content
                  const contentDelta = delta.content;
                  if (contentDelta) {
                    if (controller.desiredSize === null) return;

                    // End any current reasoning segment before starting text
                    if (hasStartedReasoning) {
                      controller.enqueue({
                        type: "reasoning-end",
                        id: currentReasoningId,
                      });
                      hasStartedReasoning = false;
                      currentReasoningId = genReasoningId();
                    }

                    if (!hasStartedText) {
                      controller.enqueue({
                        type: "text-start",
                        id: currentTextId,
                      });
                      hasStartedText = true;
                    }
                    controller.enqueue({
                      type: "text-delta",
                      id: currentTextId,
                      delta: contentDelta,
                    });
                  }
                } catch (e: any) {
                  if (controller.desiredSize === null) return;
                  if (
                    e.code === "ERR_INVALID_STATE" ||
                    (typeof e.message === "string" &&
                      e.message.includes("closed"))
                  ) {
                    return;
                  }
                  // Silently ignore JSON parse errors from partial chunks
                }
              }
            }
          } catch (err: any) {
            if (err.name === "AbortError" || err.name === "Abort") {
              // Intentionally ignored
              return;
            }
            console.error("Stream reading error", err);
            try {
              controller.error(err);
            } catch {}
            return;
          }

          // Close any open segments
          try {
            if (controller.desiredSize === null) return;

            if (hasStartedReasoning) {
              controller.enqueue({
                type: "reasoning-end",
                id: currentReasoningId,
              });
            }
            if (hasStartedText) {
              controller.enqueue({ type: "text-end", id: currentTextId });
            }

            // Map raw finish_reason to v3 unified reason
            let unified:
              | "stop"
              | "length"
              | "content-filter"
              | "tool-calls"
              | "error"
              | "other" = "stop";
            if (rawFinishReason === "length") unified = "length";
            else if (rawFinishReason === "content_filter")
              unified = "content-filter";
            else if (
              rawFinishReason === "tool_calls" ||
              rawFinishReason === "function_call"
            )
              unified = "tool-calls";
            else if (rawFinishReason === "error") unified = "error";
            else if (rawFinishReason && rawFinishReason !== "stop")
              unified = "other";

            controller.enqueue({
              type: "finish",
              finishReason: { unified, raw: rawFinishReason },
              usage: {
                inputTokens: {
                  total: totalPromptTokens,
                  noCache: undefined,
                  cacheRead: undefined,
                  cacheWrite: undefined,
                },
                outputTokens: {
                  total: totalCompletionTokens,
                  text: undefined,
                  reasoning: undefined,
                },
              },
            });
            controller.close();
          } catch {
            // ignore closure errors
          }
        },
      });

      return {
        stream,
        request: { body: { model: modelId, messages } },
        response: { headers: undefined },
      };
    },
  };
}

// --- Helper: Categorize a model ID into a provider group ---
function categorizeModel(modelId: string): { provider: string; name: string } {
  // Models with explicit provider prefix (e.g. "anthropic/claude-opus-4.5")
  const slashIndex = modelId.indexOf("/");
  if (slashIndex !== -1) {
    return {
      provider: modelId.substring(0, slashIndex),
      name: modelId.substring(slashIndex + 1),
    };
  }

  // Models without prefix - categorize by known patterns
  if (modelId.startsWith("glm-") || modelId === "chatglm")
    return { provider: "glm", name: modelId };
  if (modelId.startsWith("z1-")) return { provider: "custom", name: modelId };
  if (modelId.startsWith("0808-") || modelId.startsWith("dr-"))
    return { provider: "custom", name: modelId };

  // Fallback
  return { provider: "custom", name: modelId };
}

// --- Build models from the known API model list ---
// We fetch models from the API at startup time and cache them.
// For the initial static build, we use a hardcoded list that matches
// the API's current models (from /v1/models).

const KNOWN_MODEL_IDS = [
  "0808-360b-dr",
  "anthropic/claude-haiku-4.5",
  "anthropic/claude-opus-4.5",
  "anthropic/claude-sonnet-4.5",
  "chatglm",
  "glm-4-32b",
  "glm-4.1v-9b-thinking",
  "glm-4.5",
  "glm-4.5-air",
  "glm-4.5v",
  "glm-4.6",
  "glm-4.6v",
  "glm-4.7",
  "google/gemini-2.5-flash-lite",
  "google/gemini-3-pro",
  "openai/gpt-4.1-mini",
  "openai/gpt-5.2",
  "reasoning/claude-3.7-sonnet",
  "reasoning/grok-code-fast",
  "xai/grok-4.1-fast",
  "z1-32b",
  "z1-rumination",
  // Void models (used by builder page)
  "void/claude-3-7-sonnet-20250219",
  "void/claude-3-5-sonnet-20241022",
  "void/gpt-4o",
  "void/o1",
  "void/grok-3",
  "void/deepseek-r1",
];

// Build staticModels dynamically from the known model list
const staticModels: Record<string, Record<string, any>> = {};

for (const modelId of KNOWN_MODEL_IDS) {
  const { provider, name } = categorizeModel(modelId);
  if (!staticModels[provider]) {
    staticModels[provider] = {};
  }
  staticModels[provider][name] = CustomModel(modelId);
}

// --- Dynamic model fetching (background refresh) ---
let dynamicModelsLoaded = false;

async function fetchAndRegisterModels() {
  if (!FLARE_API_KEY || dynamicModelsLoaded) return;
  try {
    const resp = await fetch(`${FLARE_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${FLARE_API_KEY}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return;
    const data = await resp.json();
    if (!data?.data || !Array.isArray(data.data)) return;

    for (const model of data.data) {
      const modelId = model.id;
      if (!modelId) continue;
      const { provider, name } = categorizeModel(modelId);
      if (!staticModels[provider]) {
        staticModels[provider] = {};
      }
      // Only add if not already present (don't overwrite)
      if (!staticModels[provider][name]) {
        staticModels[provider][name] = CustomModel(modelId);
      }
    }
    dynamicModelsLoaded = true;
    // Rebuild modelsInfo cache
    rebuildModelsInfo();
  } catch (err) {
    console.error("Failed to fetch models from API:", err);
  }
}

// Fire-and-forget model fetch on startup
fetchAndRegisterModels();

// --- File part support ---
const staticFilePartSupportByModel = new Map<any, readonly string[]>();

function registerFileSupport(
  model: any,
  mimeTypes: readonly string[] = DEFAULT_FILE_PART_MIME_TYPES,
) {
  if (!model) return;
  staticFilePartSupportByModel.set(model, Array.from(mimeTypes));
}

// Register file support for Google models
if (staticModels.google) {
  Object.values(staticModels.google).forEach((m) =>
    registerFileSupport(m, GEMINI_FILE_MIME_TYPES),
  );
}

// Exports required by other files
export const isToolCallUnsupportedModel = (_model: any) => {
  // Disable all tools by default
  return true;
};

export const isImageInputUnsupportedModel = (model: any) => {
  return (
    !model?.modelId?.includes("gemini") &&
    !model?.modelId?.includes("glm") &&
    !model?.modelId?.includes("gpt") &&
    !model?.modelId?.includes("z1") &&
    !model?.modelId?.includes("claude") &&
    !model?.modelId?.includes("grok")
  );
};

export const getFilePartSupportedMimeTypes = (model: any) => {
  return staticFilePartSupportByModel.get(model) ?? [];
};

// --- Default Model ---
export const DEFAULT_CHAT_MODEL: ChatModel = {
  provider: "openai",
  model: "gpt-4.1-mini",
};

// --- Models Info Builder ---
function buildModelsInfo() {
  return Object.entries(staticModels).map(([provider, models]) => ({
    provider,
    models: Object.entries(models).map(([name, model]) => ({
      name,
      isToolCallUnsupported: isToolCallUnsupportedModel(model),
      isImageInputUnsupported: isImageInputUnsupportedModel(model),
      supportedFileMimeTypes: [...getFilePartSupportedMimeTypes(model)],
    })),
    hasAPIKey: true,
  }));
}

let cachedModelsInfo = buildModelsInfo();

function rebuildModelsInfo() {
  cachedModelsInfo = buildModelsInfo();
}

// --- Custom Model Provider ---
export const customModelProvider = {
  get modelsInfo() {
    return cachedModelsInfo;
  },
  getModel: (
    chatModel?: ChatModel,
    _userApiKeys?: { openAIKey?: string; googleGeminiKey?: string },
  ): LanguageModel => {
    const { provider, model } = chatModel || DEFAULT_CHAT_MODEL;

    const models = staticModels[provider];
    if (!models) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    const languageModel = models[model];
    if (!languageModel) {
      throw new Error(`Unknown model: ${provider}/${model}`);
    }
    return languageModel;
  },
};
