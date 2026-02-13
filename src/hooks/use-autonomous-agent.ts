"use client";

import { useCallback, useRef, useState } from "react";
import { appStore } from "@/app/store";
import { ChatModel } from "app-types/chat";
import {
  IntentClassification,
  UserIntent,
} from "lib/ai/agent/intent-classifier";

export interface AutonomousRouteResult {
  model?: ChatModel;
  imageProvider?: "google" | "openai" | "flux";
  intent: UserIntent;
  reasoning: string;
}

/**
 * Hook that provides autonomous agent capabilities.
 * Before sending a message, call `classifyAndRoute` to determine the
 * best model, whether to generate an image, and which tools to enable.
 */
export function useAutonomousAgent() {
  const [isClassifying, setIsClassifying] = useState(false);
  const [lastClassification, setLastClassification] =
    useState<IntentClassification | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const classifyAndRoute = useCallback(
    async (
      message: string,
      hasAttachments: boolean,
    ): Promise<AutonomousRouteResult | null> => {
      const autonomousMode = appStore.getState().autonomousMode;
      if (!autonomousMode) return null;

      // Abort any in-flight classification
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsClassifying(true);
      try {
        const res = await fetch("/api/chat/auto-route", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, hasAttachments }),
          signal: controller.signal,
        });

        if (!res.ok) {
          console.warn("Auto-route failed, using defaults");
          return null;
        }

        const classification: IntentClassification = await res.json();
        setLastClassification(classification);

        return {
          model: classification.recommendedModel,
          imageProvider: classification.imageProvider,
          intent: classification.intent,
          reasoning: classification.reasoning,
        };
      } catch (err: any) {
        if (err.name === "AbortError") return null;
        console.warn("Auto-route error:", err);
        return null;
      } finally {
        setIsClassifying(false);
      }
    },
    [],
  );

  /**
   * Lightweight synchronous classifier that runs entirely client-side.
   * This avoids the network round-trip and is used inline before send.
   */
  const classifyLocally = useCallback(
    (
      message: string,
      hasAttachments: boolean,
    ): AutonomousRouteResult | null => {
      const autonomousMode = appStore.getState().autonomousMode;
      if (!autonomousMode) return null;

      // Import the classifier function — it's isomorphic (no server-only)
      // We replicate the core logic inline for the client bundle.
      const result = localClassify(message, hasAttachments);
      setLastClassification(result);

      return {
        model: result.recommendedModel,
        imageProvider: result.imageProvider,
        intent: result.intent,
        reasoning: result.reasoning,
      };
    },
    [],
  );

  return {
    isClassifying,
    lastClassification,
    classifyAndRoute,
    classifyLocally,
  };
}

// ---------------------------------------------------------------------------
// Client-side lightweight classifier (mirrors server logic, no fetch needed)
// ---------------------------------------------------------------------------

const IMAGE_PATTERNS = [
  /\b(generate|create|make|draw|design|paint|sketch|render|produce)\b.{0,30}\b(image|picture|photo|illustration|art|artwork|icon|logo|banner|poster|wallpaper|avatar|thumbnail|graphic|visual|portrait|landscape|diagram)\b/i,
  /\b(image|picture|photo|illustration|art|artwork)\b.{0,30}\b(of|with|showing|depicting|featuring)\b/i,
  /\bshow me\b.{0,20}\b(image|picture|what.*looks like)\b/i,
  /\b(dall-?e|midjourney|stable diffusion|flux|image gen)\b/i,
  /\bdraw\s+(me\s+)?(a|an|the)\b/i,
  /\bcreate\s+(me\s+)?(a|an)\s+(cool|nice|beautiful|stunning)?\s*(image|picture|photo)\b/i,
  /\bgenerate\s+(a|an)\s+\w+\s+(image|picture|photo)\b/i,
];

const CODE_PATTERNS = [
  /\b(write|code|implement|program|develop|build|create|fix|debug|refactor|optimize)\b.{0,30}\b(function|class|component|api|endpoint|script|program|app|module|package|library|service|server|client|hook|middleware|route)\b/i,
  /\b(python|javascript|typescript|java|c\+\+|rust|go|ruby|swift|kotlin|php|sql|html|css|react|vue|angular|node|express|django|flask|next\.?js)\b/i,
  /\b(bug|error|exception|stack trace|traceback|syntax error)\b/i,
  /```[\s\S]*```/,
  /\b(algorithm|data structure|sorting|recursion)\b/i,
];

const ANALYSIS_PATTERNS = [
  /\b(analyze|analyse|calculate|compute|evaluate|compare|statistics|stats|data|chart|graph|plot|visualize|visualise)\b/i,
  /\b(average|mean|median|standard deviation|correlation|regression|probability|percentage)\b/i,
  /\bmath|equation|formula|integral|derivative|matrix\b/i,
];

const WEB_SEARCH_PATTERNS = [
  /\b(search|look up|find|google|browse|lookup)\b.{0,30}\b(web|internet|online|latest|recent|current|today|news)\b/i,
  /\b(latest|breaking|current|recent)\s+(news|updates|events|score|price|weather)\b/i,
  /\b(weather|stock price|exchange rate|sports score)\b.{0,10}\b(today|now|current|live)\b/i,
];

const CREATIVE_PATTERNS = [
  /\b(write|compose|create)\b.{0,30}\b(story|poem|song|lyrics|essay|blog|article|script|screenplay|novel|haiku)\b/i,
  /\b(brainstorm|ideate|come up with)\b.{0,20}\b(ideas|names|titles)\b/i,
];

const REASONING_PATTERNS = [
  /\b(step by step|chain of thought|think through|let'?s think|break down|work through)\b/i,
  /\b(philosophical|ethical|moral|hypothetical|thought experiment)\b/i,
  /\b(pros? and cons?|trade-?offs?|compare and contrast)\b/i,
];

const DOCUMENT_PATTERNS = [
  /\b(summarize|summarise|summary|extract|read|parse)\b.{0,30}\b(document|file|pdf|article|paper|report)\b/i,
  /\b(tldr|tl;?dr|key (points|takeaways))\b/i,
  /\b(uploaded|attached|this file|the file|this document)\b/i,
];

const TRANSLATION_PATTERNS = [
  /\b(translate|translation|translating)\b/i,
  /\b(in|to|into)\s+(english|spanish|french|german|chinese|japanese|korean|arabic|hindi|portuguese|russian|italian)\b/i,
];

function scorePatterns(text: string, patterns: RegExp[]): number {
  let hits = 0;
  for (const p of patterns) {
    if (p.test(text)) hits++;
  }
  return Math.min(hits / Math.max(patterns.length * 0.3, 1), 1);
}

const MODEL_ROUTES: Record<string, ChatModel> = {
  chat: { provider: "openai", model: "gpt-4.1-mini" },
  image_generation: { provider: "openai", model: "gpt-4.1-mini" },
  coding: { provider: "anthropic", model: "claude-sonnet-4.5" },
  analysis: { provider: "openai", model: "gpt-4.1-mini" },
  web_search: { provider: "openai", model: "gpt-4.1-mini" },
  document_analysis: { provider: "google", model: "gemini-2.5-flash-lite" },
  creative_writing: { provider: "anthropic", model: "claude-sonnet-4.5" },
  translation: { provider: "openai", model: "gpt-4.1-mini" },
  reasoning: { provider: "reasoning", model: "claude-3.7-sonnet" },
};

const INTENT_LABELS: Record<string, string> = {
  chat: "General conversation",
  image_generation: "Image generation",
  coding: "Code assistance",
  analysis: "Data analysis",
  web_search: "Web search",
  document_analysis: "Document analysis",
  creative_writing: "Creative writing",
  translation: "Translation",
  reasoning: "Deep reasoning",
};

function localClassify(
  message: string,
  hasAttachments: boolean,
): IntentClassification {
  const msg = message.toLowerCase().trim();

  const scores: Record<string, number> = {
    chat: 0.15,
    image_generation: scorePatterns(msg, IMAGE_PATTERNS),
    coding: scorePatterns(msg, CODE_PATTERNS),
    analysis: scorePatterns(msg, ANALYSIS_PATTERNS),
    web_search: scorePatterns(msg, WEB_SEARCH_PATTERNS),
    document_analysis: scorePatterns(msg, DOCUMENT_PATTERNS),
    creative_writing: scorePatterns(msg, CREATIVE_PATTERNS),
    translation: scorePatterns(msg, TRANSLATION_PATTERNS),
    reasoning: scorePatterns(msg, REASONING_PATTERNS),
  };

  if (hasAttachments) scores.document_analysis += 0.4;
  if (msg.length > 200) scores.reasoning += 0.15;
  if (msg.length < 30 && Object.values(scores).every((s) => s < 0.3)) {
    scores.chat += 0.3;
  }

  let topIntent = "chat";
  let topScore = scores.chat;
  for (const [intent, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score;
      topIntent = intent;
    }
  }

  const confidence = Math.min(Math.max(topScore, 0.2), 1.0);

  let imageProvider: "google" | "openai" | "flux" | undefined;
  if (topIntent === "image_generation") {
    if (/dall-?e|openai/i.test(msg)) imageProvider = "openai";
    else if (/flux|stable/i.test(msg)) imageProvider = "flux";
    else imageProvider = "google";
  }

  const enableTools =
    topIntent === "coding" ||
    topIntent === "analysis" ||
    topIntent === "web_search";

  return {
    intent: topIntent as UserIntent,
    confidence,
    recommendedModel: MODEL_ROUTES[topIntent] || MODEL_ROUTES.chat,
    imageProvider,
    enableTools,
    suggestedToolkits: [],
    reasoning: `${INTENT_LABELS[topIntent] || "Chat"} detected → using ${(MODEL_ROUTES[topIntent] || MODEL_ROUTES.chat).model}`,
  };
}
