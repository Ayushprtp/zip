// Types from Void
export type VoidStaticModelInfo = {
  contextWindow: number;
  reservedOutputTokenSpace: number | null;
  supportsSystemMessage: false | "system-role" | "developer-role" | "separated";
  specialToolFormat?: "openai-style" | "anthropic-style" | "gemini-style";
  supportsFIM: boolean;
  reasoningCapabilities:
    | false
    | {
        readonly supportsReasoning: true;
        readonly canTurnOffReasoning: boolean;
        readonly canIOReasoning: boolean;
        readonly reasoningReservedOutputTokenSpace?: number;
        readonly reasoningSlider?:
          | undefined
          | { type: "budget_slider"; min: number; max: number; default: number }
          | { type: "effort_slider"; values: string[]; default: string };
        readonly openSourceThinkTags?: [string, string];
      };
  cost: {
    input: number;
    output: number;
    cache_read?: number;
    cache_write?: number;
  };
  downloadable:
    | false
    | {
        sizeGb: number | "not-known";
      };
};

export const VOID_MODELS: Record<string, VoidStaticModelInfo> = {
  // Anthropic
  "claude-3-7-sonnet-20250219": {
    contextWindow: 200_000,
    reservedOutputTokenSpace: 8_192,
    cost: { input: 3.0, cache_read: 0.3, cache_write: 3.75, output: 15.0 },
    downloadable: false,
    supportsFIM: false,
    specialToolFormat: "anthropic-style",
    supportsSystemMessage: "separated",
    reasoningCapabilities: {
      supportsReasoning: true,
      canTurnOffReasoning: true,
      canIOReasoning: true,
      reasoningReservedOutputTokenSpace: 8192,
      reasoningSlider: {
        type: "budget_slider",
        min: 1024,
        max: 8192,
        default: 1024,
      },
    },
  },
  "claude-3-5-sonnet-20241022": {
    contextWindow: 200_000,
    reservedOutputTokenSpace: 8_192,
    cost: { input: 3.0, cache_read: 0.3, cache_write: 3.75, output: 15.0 },
    downloadable: false,
    supportsFIM: false,
    specialToolFormat: "anthropic-style",
    supportsSystemMessage: "separated",
    reasoningCapabilities: false,
  },
  // OpenAI
  "gpt-4o": {
    contextWindow: 128_000,
    reservedOutputTokenSpace: 16_384,
    cost: { input: 2.5, cache_read: 1.25, output: 10.0 },
    downloadable: false,
    supportsFIM: false,
    specialToolFormat: "openai-style",
    supportsSystemMessage: "system-role",
    reasoningCapabilities: false,
  },
  o1: {
    contextWindow: 128_000,
    reservedOutputTokenSpace: 100_000,
    cost: { input: 15.0, cache_read: 7.5, output: 60.0 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "developer-role",
    reasoningCapabilities: {
      supportsReasoning: true,
      canTurnOffReasoning: false,
      canIOReasoning: false,
      reasoningSlider: {
        type: "effort_slider",
        values: ["low", "medium", "high"],
        default: "low",
      },
    },
  },
  // xAI
  "grok-3": {
    contextWindow: 131_072,
    reservedOutputTokenSpace: null,
    cost: { input: 3.0, output: 15.0 },
    downloadable: false,
    supportsFIM: false,
    supportsSystemMessage: "system-role",
    specialToolFormat: "openai-style",
    reasoningCapabilities: false,
  },
  // DeepSeek
  "deepseek-r1": {
    supportsFIM: false,
    supportsSystemMessage: false,
    reasoningCapabilities: {
      supportsReasoning: true,
      canTurnOffReasoning: false,
      canIOReasoning: true,
      openSourceThinkTags: ["<think>", "</think>"],
    },
    contextWindow: 32_000,
    reservedOutputTokenSpace: 4_096,
    cost: { input: 0, output: 0 }, // Placeholder
    downloadable: false,
  },
};

export function getVoidModelInfo(
  modelName: string,
): VoidStaticModelInfo | null {
  return VOID_MODELS[modelName] || null;
}

export function getAllVoidModels() {
  return Object.keys(VOID_MODELS);
}
