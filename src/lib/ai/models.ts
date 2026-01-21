import "server-only";

// Disable AI SDK warnings
process.env.AI_SDK_LOG_WARNINGS = "false";

import { LanguageModel } from "ai";
import { ChatModel } from "app-types/chat";
import {
  DEFAULT_FILE_PART_MIME_TYPES,
  GEMINI_FILE_MIME_TYPES,
} from "./file-support";

// --- Custom Gemini Proxy Setup ---
function createCustomGeminiModel(modelId: string): any {
  const baseURL = process.env.CUSTOM_GEMINI_BASE_URL;
  const apiKey = process.env.CUSTOM_GEMINI_API_KEY;

  return {
    specificationVersion: "v2",
    provider: "customGemini",
    modelId: modelId,
    defaultObjectGenerationMode: "json",
    doGenerate: async (options: any) => {
      const modelMessages = (options.prompt.messages || []).map((m: any) => ({
        role: m.role,
        content:
          typeof m.content === "string"
            ? m.content
            : Array.isArray(m.content)
              ? m.content
                  .filter((c: any) => c && c.type === "text")
                  .map((c: any) => c.text || "")
                  .join("")
              : "",
      }));

      const resp = await fetch(`${baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: modelMessages,
          stream: false,
        }),
      });
      const data = await resp.json();
      return {
        text: data.choices?.[0]?.message?.content || "",
        finishReason: "stop",
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
        },
        rawCall: { rawPrompt: modelMessages, rawSettings: {} },
      };
    },
    doStream: async (options: any) => {
      const modelMessages = (options.prompt.messages || []).map((m: any) => ({
        role: m.role,
        content:
          typeof m.content === "string"
            ? m.content
            : Array.isArray(m.content)
              ? m.content
                  .filter((c: any) => c && c.type === "text")
                  .map((c: any) => c.text || "")
                  .join("")
              : "",
      }));

      const stream = new ReadableStream({
        async start(controller) {
          const resp = await fetch(`${baseURL}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              Accept: "text/event-stream",
            },
            body: JSON.stringify({
              model: modelId,
              messages: modelMessages,
              stream: true,
            }),
          });

          if (!resp.body) {
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
              if (!line.startsWith("data: ")) continue;
              const dataStr = line.slice(6).trim();
              if (dataStr === "[DONE]") continue;
              try {
                const json = JSON.parse(dataStr);
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                  controller.enqueue({
                    type: "text-delta",
                    textDelta: delta,
                  });
                }
              } catch (_e) {}
            }
          }
          controller.enqueue({
            type: "finish",
            finishReason: "stop",
            usage: { promptTokens: 0, completionTokens: 0 },
          });
          controller.close();
        },
      });

      return {
        stream,
        rawCall: { rawPrompt: modelMessages, rawSettings: {} },
      };
    },
  };
}

// --- Groq Model Setup ---
import { createGroq } from "@ai-sdk/groq";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: process.env.GROQ_BASE_URL,
});

// --- Model Registration ---
const staticModels = {
  groq: {
    // Production Models
    "llama-3.1-8b-instant": groq("llama-3.1-8b-instant"),
    "llama-3.3-70b-versatile": groq("llama-3.3-70b-versatile"),
    "llama-guard-4-12b": groq("meta-llama/llama-guard-4-12b"),
    "gpt-oss-120b": groq("openai/gpt-oss-120b"),
    "gpt-oss-20b": groq("openai/gpt-oss-20b"),

    // Preview Models (Latest Llama 4)
    "llama-4-maverick": groq("meta-llama/llama-4-maverick-17b-128e-instruct"),
    "llama-4-scout": groq("meta-llama/llama-4-scout-17b-16e-instruct"),
    "kimi-k2": groq("moonshotai/kimi-k2-instruct-0905"),
    "qwen3-32b": groq("qwen/qwen3-32b"),

    // Systems
    compound: groq("groq/compound"),
    "compound-mini": groq("groq/compound-mini"),
  },
  google: {
    "gemini-pro": createCustomGeminiModel("gemini-pro"),
    "gemini-3-pro": createCustomGeminiModel("gemini-3-pro"),
    "gemini-advanced": createCustomGeminiModel("gemini-advanced"),
    "gemini-2.5-flash-lite": createCustomGeminiModel("gemini-2.5-flash-lite"),
  },
  anthropic: {
    "claude-opus-4.5": createCustomGeminiModel("anthropic/claude-opus-4.5"),
    "claude-sonnet-4.5": createCustomGeminiModel("anthropic/claude-sonnet-4.5"),
    "claude-haiku-4.5": createCustomGeminiModel("anthropic/claude-haiku-4.5"),
    "claude-3.7-sonnet": createCustomGeminiModel("reasoning/claude-3.7-sonnet"),
  },
  openai: {
    "gpt-4.1-mini": createCustomGeminiModel("openai/gpt-4.1-mini"),
    "gpt-5.2": createCustomGeminiModel("openai/gpt-5.2"),
  },
  xai: {
    "grok-4.1-fast": createCustomGeminiModel("xai/grok-4.1-fast"),
    "grok-code-fast": createCustomGeminiModel("reasoning/grok-code-fast"),
  },
  glm: {
    "glm-4.5": createCustomGeminiModel("glm-4.5"),
    "glm-4.5v": createCustomGeminiModel("glm-4.5v"),
    "glm-4.5-air": createCustomGeminiModel("glm-4.5-air"),
    "glm-4.6v": createCustomGeminiModel("glm-4.6v"),
    "glm-4.7": createCustomGeminiModel("glm-4.7"),
    "glm-4-32b": createCustomGeminiModel("glm-4-32b"),
    "glm-4.1v-9b-thinking": createCustomGeminiModel("glm-4.1v-9b-thinking"),
    chatglm: createCustomGeminiModel("chatglm"),
  },
  custom: {
    "z1-32b": createCustomGeminiModel("z1-32b"),
    "z1-rumination": createCustomGeminiModel("z1-rumination"),
    "0808-360b-dr": createCustomGeminiModel("0808-360b-dr"),
  },
  // Backward compatibility alias for existing chat threads
  customGemini: {
    "gemini-pro": createCustomGeminiModel("gemini-pro"),
    "gemini-3-pro": createCustomGeminiModel("gemini-3-pro"),
    "gemini-advanced": createCustomGeminiModel("gemini-advanced"),
    "gemini-2.5-flash-lite": createCustomGeminiModel("gemini-2.5-flash-lite"),
    "reasoning/claude-3.7-sonnet": createCustomGeminiModel(
      "reasoning/claude-3.7-sonnet",
    ),
    "0808-360b-dr": createCustomGeminiModel("0808-360b-dr"),
    "glm-4.6v": createCustomGeminiModel("glm-4.6v"),
    "anthropic/claude-opus-4.5": createCustomGeminiModel(
      "anthropic/claude-opus-4.5",
    ),
    "reasoning/grok-code-fast": createCustomGeminiModel(
      "reasoning/grok-code-fast",
    ),
    chatglm: createCustomGeminiModel("chatglm"),
    "glm-4.5": createCustomGeminiModel("glm-4.5"),
    "glm-4.5v": createCustomGeminiModel("glm-4.5v"),
    "google/gemini-pro": createCustomGeminiModel("google/gemini-pro"),
    "anthropic/claude-sonnet-4.5": createCustomGeminiModel(
      "anthropic/claude-sonnet-4.5",
    ),
    "openai/gpt-4.1-mini": createCustomGeminiModel("openai/gpt-4.1-mini"),
    "glm-4-32b": createCustomGeminiModel("glm-4-32b"),
    "glm-4.1v-9b-thinking": createCustomGeminiModel("glm-4.1v-9b-thinking"),
    "glm-4.7": createCustomGeminiModel("glm-4.7"),
    "z1-rumination": createCustomGeminiModel("z1-rumination"),
    "anthropic/claude-haiku-4.5": createCustomGeminiModel(
      "anthropic/claude-haiku-4.5",
    ),
    "google/gemini-3-pro": createCustomGeminiModel("google/gemini-3-pro"),
    "openai/gpt-5.2": createCustomGeminiModel("openai/gpt-5.2"),
    "xai/grok-4.1-fast": createCustomGeminiModel("xai/grok-4.1-fast"),
    "glm-4.5-air": createCustomGeminiModel("glm-4.5-air"),
    "z1-32b": createCustomGeminiModel("z1-32b"),
    "google/gemini-2.5-flash-lite": createCustomGeminiModel(
      "google/gemini-2.5-flash-lite",
    ),
  },
};

const staticFilePartSupportByModel = new Map<any, readonly string[]>();

function registerFileSupport(
  model: any,
  mimeTypes: readonly string[] = DEFAULT_FILE_PART_MIME_TYPES,
) {
  if (!model) return;
  staticFilePartSupportByModel.set(model, Array.from(mimeTypes));
}

// Register file support for Google models
Object.values(staticModels.google).forEach((m) =>
  registerFileSupport(m, GEMINI_FILE_MIME_TYPES),
);

// Exports required by other files
export const isToolCallUnsupportedModel = (_model: any) => {
  // All models now use the custom proxy which supports tool calls (OpenAI-compatible)
  return false;
};

export const isImageInputUnsupportedModel = (model: any) => {
  return (
    !model?.modelId?.includes("gemini") &&
    !model?.modelId?.includes("glm") &&
    !model?.modelId?.includes("gpt") &&
    !model?.modelId?.includes("z1")
  );
};

export const getFilePartSupportedMimeTypes = (model: any) => {
  return staticFilePartSupportByModel.get(model) ?? [];
};

// --- Default Model ---
export const DEFAULT_CHAT_MODEL: ChatModel = {
  provider: "groq",
  model: "llama-3.3-70b-versatile",
};

// --- Custom Model Provider ---
export const customModelProvider = {
  modelsInfo: Object.entries(staticModels).map(([provider, models]) => ({
    provider,
    models: Object.entries(models).map(([name, model]) => ({
      name,
      isToolCallUnsupported: isToolCallUnsupportedModel(model),
      isImageInputUnsupported: isImageInputUnsupportedModel(model),
      supportedFileMimeTypes: [...getFilePartSupportedMimeTypes(model)],
    })),
    hasAPIKey: true,
  })),
  getModel: (
    chatModel?: ChatModel,
    _userApiKeys?: { openAIKey?: string; googleGeminiKey?: string },
  ): LanguageModel => {
    const { provider, model } = chatModel || DEFAULT_CHAT_MODEL;

    const models = staticModels[provider as keyof typeof staticModels];
    if (!models) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    const languageModel = models[model as keyof typeof models];
    if (!languageModel) {
      throw new Error(`Unknown model: ${provider}/${model}`);
    }
    return languageModel;
  },
};
