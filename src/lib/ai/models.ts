import "server-only";

import { createGroq } from "@ai-sdk/groq";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { xai } from "@ai-sdk/xai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { LanguageModel } from "ai";
import crypto from "node:crypto";
import { ChatModel } from "app-types/chat";
import {
  DEFAULT_FILE_PART_MIME_TYPES,
  GEMINI_FILE_MIME_TYPES,
} from "./file-support";

// --- Groq Setup ---
const groq = createGroq({
  baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

// --- GLM Proxy (chat.z.ai) Setup ---
const GLM_MODEL_ALIASES: Record<string, string> = {
  "glm-4.7": "glm-4.7",
  "glm-4.6": "GLM-4-6-API-V1",
  "glm-4.6v": "glm-4.6v",
  "glm-4.5": "0727-360B-API",
  "glm-4.5-air": "0727-106B-API",
  "glm-4.5v": "glm-4.5v",
  "glm-4.1v-9b-thinking": "GLM-4.1V-Thinking-FlashX",
  "z1-rumination": "deep-research",
  "z1-32b": "zero",
  chatglm: "glm-4-flash",
  "0808-360b-dr": "0808-360B-DR",
  "glm-4-32b": "glm-4-air-250414",
};

let glmAuthCache: { token: string; id: string; expiresAt: number } | null =
  null;
const SIGNATURE_KEY = "key-@@@@)))()((9))-xxxx&&&%%%%%";

async function getGLMAuth() {
  if (glmAuthCache && glmAuthCache.expiresAt > Date.now()) return glmAuthCache;
  try {
    const resp = await fetch("https://chat.z.ai/api/v1/auths/", {
      cache: "no-store",
    });
    if (resp.ok) {
      const data = await resp.json();
      glmAuthCache = {
        token: data.token,
        id: data.id,
        expiresAt: Date.now() + 240000, // 4 minutes
      };
      return glmAuthCache;
    }
  } catch (error) {
    console.error("[GLM Auth] Failed:", error);
  }
  return null;
}

function createGLMSignature(payloadString: string, prompt: string) {
  const currentTime = Date.now();
  const b64Prompt = Buffer.from(prompt).toString("base64");
  const dataString = `${payloadString}|${b64Prompt}|${currentTime}`;
  const timeWindow = Math.floor(currentTime / (5 * 60 * 1000));

  const baseSignature = crypto
    .createHmac("sha256", SIGNATURE_KEY)
    .update(String(timeWindow))
    .digest("hex");

  const signature = crypto
    .createHmac("sha256", baseSignature)
    .update(dataString)
    .digest("hex");

  return { signature, currentTime };
}

// --- ZeroVault Gemini Proxy Setup ---
async function fetchZeroVault(body: any) {
  return fetch(
    "https://us-central1-infinite-chain-295909.cloudfunctions.net/gemini-proxy-staging-v1",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
        "x-powered-by": "zerovault.shop",
      },
      body: JSON.stringify(body),
    },
  );
}

// --- Generic Custom Model Implementation ---
function createCustomModel(
  provider: "glm" | "zerovault" | "dotkey",
  modelId: string,
): any {
  const isGLM = provider === "glm";
  const isDotKey = provider === "dotkey";

  return {
    specificationVersion: "v2",
    provider: provider,
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

      const lastUserMessage = options.prompt.messages
        ?.filter((m: any) => m.role === "user")
        .at(-1);

      const promptText = Array.isArray(lastUserMessage?.content)
        ? (lastUserMessage.content as any[]).find((c) => c.type === "text")
            ?.text || ""
        : typeof lastUserMessage?.content === "string"
          ? lastUserMessage.content
          : "";

      if (isGLM) {
        const auth = await getGLMAuth();
        if (!auth) throw new Error("GLM Auth failed");

        const basicParams: any = {
          timestamp: String(Date.now()),
          requestId: crypto.randomUUID(),
          user_id: auth.id,
        };
        const sortedKeys = Object.keys(basicParams).sort();
        const sortedPayload = sortedKeys
          .map((k) => `${k},${basicParams[k]}`)
          .join(",");
        const { signature, currentTime } = createGLMSignature(
          sortedPayload,
          promptText,
        );

        const urlParams = new URLSearchParams({
          ...basicParams,
          version: "0.0.1",
          platform: "web",
          token: auth.token,
          timezone: "Asia/Makassar",
        }).toString();

        const resp = await fetch(
          `https://chat.z.ai/api/v2/chat/completions?${urlParams}&signature_timestamp=${currentTime}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${auth.token}`,
              "X-Signature": signature,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: GLM_MODEL_ALIASES[modelId] || modelId,
              messages: modelMessages,
              stream: false,
            }),
          },
        );
        const data = await resp.json();
        return {
          text: data.choices?.[0]?.message?.content || "",
          finishReason: "stop",
          usage: { promptTokens: 0, completionTokens: 0 },
          rawCall: { rawPrompt: modelMessages, rawSettings: {} },
        };
      } else if (isDotKey) {
        const resp = await fetch(
          `https://gemini.dotkey.workers.dev/api?text=${encodeURIComponent(promptText)}`,
        );
        const data = await resp.json();
        return {
          text: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
          finishReason: "stop",
          usage: { promptTokens: 0, completionTokens: 0 },
          rawCall: { rawPrompt: modelMessages, rawSettings: {} },
        };
      } else {
        const resp = await fetchZeroVault({
          model: modelId,
          contents: modelMessages.map((m: any) => ({
            role: m.role === "user" ? "user" : "model",
            parts: [{ text: m.content }],
          })),
        });
        const data = await resp.json();
        return {
          text: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
          finishReason: "stop",
          usage: { promptTokens: 0, completionTokens: 0 },
          rawCall: { rawPrompt: modelMessages, rawSettings: {} },
        };
      }
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

      const lastUserMessage = options.prompt.messages
        ?.filter((m: any) => m.role === "user")
        .at(-1);

      const promptText = Array.isArray(lastUserMessage?.content)
        ? (lastUserMessage.content as any[]).find((c) => c.type === "text")
            ?.text || ""
        : typeof lastUserMessage?.content === "string"
          ? lastUserMessage.content
          : "";

      const stream = new ReadableStream({
        async start(controller) {
          if (isGLM) {
            const auth = await getGLMAuth();
            if (!auth) {
              controller.error("GLM Auth failed");
              return;
            }

            const basicParams: any = {
              timestamp: String(Date.now()),
              requestId: crypto.randomUUID(),
              user_id: auth.id,
            };
            const sortedKeys = Object.keys(basicParams).sort();
            const sortedPayload = sortedKeys
              .map((k) => `${k},${basicParams[k]}`)
              .join(",");
            const { signature, currentTime } = createGLMSignature(
              sortedPayload,
              promptText,
            );

            const urlParams = new URLSearchParams({
              ...basicParams,
              version: "0.0.1",
              platform: "web",
              token: auth.token,
              timezone: "Asia/Makassar",
            }).toString();

            const resp = await fetch(
              `https://chat.z.ai/api/v2/chat/completions?${urlParams}&signature_timestamp=${currentTime}`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${auth.token}`,
                  "X-Signature": signature,
                  "Content-Type": "application/json",
                  Accept: "text/event-stream",
                },
                body: JSON.stringify({
                  model: GLM_MODEL_ALIASES[modelId] || modelId,
                  messages: modelMessages,
                  stream: true,
                  features: { enable_thinking: true },
                }),
              },
            );

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
                try {
                  const json = JSON.parse(line.slice(6));
                  if (json.type === "chat:completion") {
                    const delta = json.data?.delta_content;
                    if (delta) {
                      controller.enqueue({
                        type: "text-delta",
                        textDelta: delta,
                      });
                    }
                    const reasoning = json.data?.reasoning_content;
                    if (reasoning) {
                      controller.enqueue({
                        type: "reasoning-delta",
                        reasoningDelta: reasoning,
                      });
                    }
                  }
                } catch (_e) {}
              }
            }
            controller.enqueue({
              type: "finish",
              finishReason: "stop",
              usage: { promptTokens: 0, completionTokens: 0 },
            });
          } else if (isDotKey) {
            const resp = await fetch(
              `https://gemini.dotkey.workers.dev/api?text=${encodeURIComponent(promptText)}`,
            );
            const data = await resp.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            controller.enqueue({ type: "text-delta", textDelta: text });
            controller.enqueue({
              type: "finish",
              finishReason: "stop",
              usage: { promptTokens: 0, completionTokens: 0 },
            });
          } else {
            const resp = await fetchZeroVault({
              model: modelId,
              contents: modelMessages.map((m: any) => ({
                role: m.role === "user" ? "user" : "model",
                parts: [{ text: m.content }],
              })),
            });
            const data = await resp.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            controller.enqueue({ type: "text-delta", textDelta: text });
            controller.enqueue({
              type: "finish",
              finishReason: "stop",
              usage: { promptTokens: 0, completionTokens: 0 },
            });
          }
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

// --- Model Registration ---
const staticModels = {
  openai: {
    "gpt-4o": openai("gpt-4o"),
    "gpt-4o-mini": openai("gpt-4o-mini"),
  },
  xai: {
    "grok-2": xai("grok-2"),
  },
  groq: {
    "kimi-k2-instruct": groq("moonshotai/kimi-k2-instruct"),
    "llama-4-scout-17b": groq("meta-llama/llama-4-scout-17b-16e-instruct"),
    "gpt-oss-20b": groq("openai/gpt-oss-20b"),
    "gpt-oss-120b": groq("openai/gpt-oss-120b"),
    "qwen3-32b": groq("qwen/qwen3-32b"),
  },
  glm: {
    "glm-4.5": createCustomModel("glm", "glm-4.5"),
    "glm-4.5v": createCustomModel("glm", "glm-4.5v"),
    "glm-4.5-air": createCustomModel("glm", "glm-4.5-air"),
    "glm-4.6": createCustomModel("glm", "glm-4.6"),
    "glm-4.6v": createCustomModel("glm", "glm-4.6v"),
    "glm-4.7": createCustomModel("glm", "glm-4.7"),
    "glm-4.1v-9b-thinking": createCustomModel("glm", "glm-4.1v-9b-thinking"),
    "z1-rumination": createCustomModel("glm", "z1-rumination"),
    "z1-32b": createCustomModel("glm", "z1-32b"),
    chatglm: createCustomModel("glm", "chatglm"),
    "0808-360b-dr": createCustomModel("glm", "0808-360b-dr"),
    "glm-4-32b": createCustomModel("glm", "glm-4-32b"),
  },
  google: {
    "gemini-2.0-flash": createCustomModel("zerovault", "gemini-2.0-flash"),
    "gemini-2.0-flash-lite": createCustomModel(
      "dotkey",
      "gemini-2.0-flash-lite",
    ),
    "gemini-2.5-flash-lite": createCustomModel(
      "zerovault",
      "gemini-2.5-flash-lite",
    ),
    "gemini-2.5-flash": createCustomModel("zerovault", "gemini-2.5-flash"),
    "gemini-2.5-pro": createCustomModel("zerovault", "gemini-2.5-pro"),
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

Object.values(staticModels.google).forEach((m) =>
  registerFileSupport(m, GEMINI_FILE_MIME_TYPES),
);

// Exports required by other files
export const isToolCallUnsupportedModel = (model: any) => {
  return (
    model?.modelId?.startsWith("glm") ||
    model?.modelId?.startsWith("z1") ||
    model?.modelId?.includes("gemini") ||
    model?.modelId?.includes("grok") ||
    model?.modelId?.includes("thinking")
  );
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
  provider: "openai",
  model: "gpt-4o-mini",
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
    userApiKeys?: { openAIKey?: string; googleGeminiKey?: string },
  ): LanguageModel => {
    const { provider, model } = chatModel || DEFAULT_CHAT_MODEL;

    // Use user's personal API key if provided
    if (provider === "openai" && userApiKeys?.openAIKey) {
      const userOpenAI = createOpenAI({ apiKey: userApiKeys.openAIKey });
      return userOpenAI(model);
    }

    if (provider === "google" && userApiKeys?.googleGeminiKey) {
      const userGoogle = createGoogleGenerativeAI({
        apiKey: userApiKeys.googleGeminiKey,
      });
      return userGoogle(model);
    }

    // Fall back to system models
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
