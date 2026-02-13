/**
 * Autonomous Agent Intent Classifier
 *
 * Analyzes user messages to detect intent and automatically route to
 * the best model, tool configuration, and response strategy — similar
 * to how ChatGPT transparently handles image generation, code execution,
 * web search, analysis and general conversation.
 */

import { ChatModel } from "app-types/chat";

// ---------------------------------------------------------------------------
// Intent types the autonomous agent can detect
// ---------------------------------------------------------------------------
export enum UserIntent {
  /** General conversational chat */
  Chat = "chat",
  /** User wants an image to be generated */
  ImageGeneration = "image_generation",
  /** User wants code written, debugged, or explained */
  Coding = "coding",
  /** User wants data/math analysis, charts, tables */
  Analysis = "analysis",
  /** User wants to search the web for current information */
  WebSearch = "web_search",
  /** User wants to summarize or analyze a document / file */
  DocumentAnalysis = "document_analysis",
  /** User wants creative writing (stories, poems, scripts) */
  CreativeWriting = "creative_writing",
  /** User wants translation */
  Translation = "translation",
  /** User wants reasoning / complex problem solving */
  Reasoning = "reasoning",
}

// ---------------------------------------------------------------------------
// Classification result
// ---------------------------------------------------------------------------
export interface IntentClassification {
  /** Primary detected intent */
  intent: UserIntent;
  /** Confidence 0–1 */
  confidence: number;
  /** Recommended model for this intent */
  recommendedModel: ChatModel;
  /** Recommended image provider if intent is image generation */
  imageProvider?: "google" | "openai" | "flux";
  /** Whether to enable tool calling */
  enableTools: boolean;
  /** Specific tools to enable */
  suggestedToolkits: string[];
  /** Brief reasoning for the classification (shown to user) */
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Keyword / pattern banks for classification
// ---------------------------------------------------------------------------
const IMAGE_PATTERNS = [
  /\b(generate|create|make|draw|design|paint|sketch|render|produce)\b.{0,30}\b(image|picture|photo|illustration|art|artwork|icon|logo|banner|poster|wallpaper|avatar|thumbnail|graphic|visual|portrait|landscape|diagram)\b/i,
  /\b(image|picture|photo|illustration|art|artwork)\b.{0,30}\b(of|with|showing|depicting|featuring)\b/i,
  /\bshow me\b.{0,20}\b(image|picture|what.*looks like)\b/i,
  /\b(dall-?e|midjourney|stable diffusion|flux|image gen)\b/i,
  /\b(visualize|visualise)\b.{0,20}\b(as|into|like)\b.*\b(image|picture)\b/i,
  /\bdraw\s+(me\s+)?(a|an|the)\b/i,
  /\bcreate\s+(me\s+)?(a|an)\s+(cool|nice|beautiful|stunning)?\s*(image|picture|photo)\b/i,
  /\bgenerate\s+(a|an)\s+\w+\s+(image|picture|photo)\b/i,
];

const CODE_PATTERNS = [
  /\b(write|code|implement|program|develop|build|create|fix|debug|refactor|optimize)\b.{0,30}\b(function|class|component|api|endpoint|script|program|app|module|package|library|service|server|client|hook|middleware|route)\b/i,
  /\b(python|javascript|typescript|java|c\+\+|rust|go|ruby|swift|kotlin|php|sql|html|css|react|vue|angular|node|express|django|flask|next\.?js)\b/i,
  /\b(bug|error|exception|stack trace|traceback|syntax error|runtime|compile|lint)\b/i,
  /```[\s\S]*```/,
  /\b(algorithm|data structure|sorting|recursion|linked list|binary tree|hash map)\b/i,
  /\b(how to|how do I)\b.{0,20}\b(code|implement|write|create|build)\b/i,
  /\bregex|regular expression\b/i,
];

const ANALYSIS_PATTERNS = [
  /\b(analyze|analyse|calculate|compute|evaluate|compare|statistics|stats|data|dataset|chart|graph|plot|visualize|visualise|metric|kpi)\b/i,
  /\b(average|mean|median|mode|standard deviation|variance|correlation|regression|probability|percentage|ratio)\b/i,
  /\b(spreadsheet|excel|csv|table|pivot)\b/i,
  /\b(forecast|predict|trend|projection|growth rate)\b/i,
  /\bmath|equation|formula|integral|derivative|matrix|vector|linear algebra\b/i,
];

const WEB_SEARCH_PATTERNS = [
  /\b(search|look up|find|google|browse|lookup)\b.{0,30}\b(web|internet|online|latest|recent|current|today|news|live)\b/i,
  /\b(what is|what are|who is|when did|where is|how many|how much)\b.{0,30}\b(latest|current|recent|today|now|2024|2025|2026)\b/i,
  /\b(latest|breaking|current|recent)\s+(news|updates|events|score|price|weather)\b/i,
  /\b(weather|stock price|exchange rate|sports score|election)\b.{0,10}\b(today|now|current|live)\b/i,
  /\bwhat happened\b/i,
];

const DOCUMENT_PATTERNS = [
  /\b(summarize|summarise|summary|extract|read|parse|analyze|analyse)\b.{0,30}\b(document|file|pdf|article|paper|report|text|page|book|chapter|email)\b/i,
  /\b(tldr|tl;?dr|key (points|takeaways|findings))\b/i,
  /\b(uploaded|attached|this file|the file|this document)\b/i,
];

const CREATIVE_PATTERNS = [
  /\b(write|compose|create)\b.{0,30}\b(story|poem|song|lyrics|essay|blog|article|script|screenplay|novel|haiku|limerick|joke|riddle|fiction|narrative)\b/i,
  /\b(creative writing|storytelling|worldbuilding|character development)\b/i,
  /\b(once upon a time|tell me a story|make up a)\b/i,
  /\b(brainstorm|ideate|come up with)\b.{0,20}\b(ideas|names|titles|concepts)\b/i,
];

const TRANSLATION_PATTERNS = [
  /\b(translate|translation|translating)\b/i,
  /\b(in|to|into)\s+(english|spanish|french|german|chinese|japanese|korean|arabic|hindi|portuguese|russian|italian|dutch|swedish|norwegian)\b/i,
  /\b(what does .+ mean in|how do you say .+ in)\b/i,
];

const REASONING_PATTERNS = [
  /\b(think|reason|explain|why|analyze|prove|deduce|infer|logic|argument|debate|pros? and cons?|trade-?offs?|compare and contrast)\b/i,
  /\b(step by step|chain of thought|think through|let'?s think|break down|work through)\b/i,
  /\b(philosophical|ethical|moral|hypothetical|thought experiment)\b/i,
  /\b(should I|what would happen if|what if|is it better)\b/i,
];

// ---------------------------------------------------------------------------
// Model recommendations per intent
// ---------------------------------------------------------------------------
const MODEL_ROUTES: Record<UserIntent, ChatModel> = {
  [UserIntent.Chat]: { provider: "openai", model: "gpt-4.1-mini" },
  [UserIntent.ImageGeneration]: { provider: "openai", model: "gpt-4.1-mini" },
  [UserIntent.Coding]: { provider: "anthropic", model: "claude-sonnet-4.5" },
  [UserIntent.Analysis]: { provider: "openai", model: "gpt-4.1-mini" },
  [UserIntent.WebSearch]: { provider: "openai", model: "gpt-4.1-mini" },
  [UserIntent.DocumentAnalysis]: {
    provider: "google",
    model: "gemini-2.5-flash-lite",
  },
  [UserIntent.CreativeWriting]: {
    provider: "anthropic",
    model: "claude-sonnet-4.5",
  },
  [UserIntent.Translation]: { provider: "openai", model: "gpt-4.1-mini" },
  [UserIntent.Reasoning]: { provider: "reasoning", model: "claude-3.7-sonnet" },
};

const TOOLKIT_ROUTES: Record<UserIntent, string[]> = {
  [UserIntent.Chat]: [],
  [UserIntent.ImageGeneration]: [],
  [UserIntent.Coding]: ["code"],
  [UserIntent.Analysis]: ["code", "visualization"],
  [UserIntent.WebSearch]: ["webSearch"],
  [UserIntent.DocumentAnalysis]: [],
  [UserIntent.CreativeWriting]: [],
  [UserIntent.Translation]: [],
  [UserIntent.Reasoning]: [],
};

const INTENT_LABELS: Record<UserIntent, string> = {
  [UserIntent.Chat]: "General conversation",
  [UserIntent.ImageGeneration]: "Image generation",
  [UserIntent.Coding]: "Code assistance",
  [UserIntent.Analysis]: "Data analysis",
  [UserIntent.WebSearch]: "Web search",
  [UserIntent.DocumentAnalysis]: "Document analysis",
  [UserIntent.CreativeWriting]: "Creative writing",
  [UserIntent.Translation]: "Translation",
  [UserIntent.Reasoning]: "Deep reasoning",
};

// ---------------------------------------------------------------------------
// Score a message against pattern banks
// ---------------------------------------------------------------------------
function scorePatterns(message: string, patterns: RegExp[]): number {
  let hits = 0;
  for (const p of patterns) {
    if (p.test(message)) hits++;
  }
  return Math.min(hits / Math.max(patterns.length * 0.3, 1), 1);
}

// ---------------------------------------------------------------------------
// Main classifier function
// ---------------------------------------------------------------------------
export function classifyIntent(
  message: string,
  hasAttachments: boolean = false,
  _conversationContext?: string,
): IntentClassification {
  const msg = message.toLowerCase().trim();

  // Score each intent
  const scores: Record<UserIntent, number> = {
    [UserIntent.Chat]: 0.15, // base score for chat (always a fallback)
    [UserIntent.ImageGeneration]: scorePatterns(msg, IMAGE_PATTERNS),
    [UserIntent.Coding]: scorePatterns(msg, CODE_PATTERNS),
    [UserIntent.Analysis]: scorePatterns(msg, ANALYSIS_PATTERNS),
    [UserIntent.WebSearch]: scorePatterns(msg, WEB_SEARCH_PATTERNS),
    [UserIntent.DocumentAnalysis]: scorePatterns(msg, DOCUMENT_PATTERNS),
    [UserIntent.CreativeWriting]: scorePatterns(msg, CREATIVE_PATTERNS),
    [UserIntent.Translation]: scorePatterns(msg, TRANSLATION_PATTERNS),
    [UserIntent.Reasoning]: scorePatterns(msg, REASONING_PATTERNS),
  };

  // Boost document analysis if files are attached
  if (hasAttachments) {
    scores[UserIntent.DocumentAnalysis] += 0.4;
  }

  // Boost reasoning for long complex questions
  if (msg.length > 200) {
    scores[UserIntent.Reasoning] += 0.15;
  }

  // Boost chat for short simple messages
  if (msg.length < 30 && Object.values(scores).every((s) => s < 0.3)) {
    scores[UserIntent.Chat] += 0.3;
  }

  // Find the top intent
  let topIntent = UserIntent.Chat;
  let topScore = scores[UserIntent.Chat];

  for (const [intent, score] of Object.entries(scores)) {
    if (score > topScore) {
      topScore = score;
      topIntent = intent as UserIntent;
    }
  }

  // Normalize confidence
  const confidence = Math.min(Math.max(topScore, 0.2), 1.0);

  // Select image provider
  let imageProvider: "google" | "openai" | "flux" | undefined;
  if (topIntent === UserIntent.ImageGeneration) {
    // Default to Google (Gemini) for best quality, unless specific provider mentioned
    if (/dall-?e|openai/i.test(msg)) {
      imageProvider = "openai";
    } else if (/flux|stable/i.test(msg)) {
      imageProvider = "flux";
    } else {
      imageProvider = "google";
    }
  }

  const enableTools =
    topIntent === UserIntent.Coding ||
    topIntent === UserIntent.Analysis ||
    topIntent === UserIntent.WebSearch;

  return {
    intent: topIntent,
    confidence,
    recommendedModel: MODEL_ROUTES[topIntent],
    imageProvider,
    enableTools,
    suggestedToolkits: TOOLKIT_ROUTES[topIntent],
    reasoning: `${INTENT_LABELS[topIntent]} detected → using ${MODEL_ROUTES[topIntent].model}`,
  };
}

// ---------------------------------------------------------------------------
// Available models check — filters recommendation to only available models
// ---------------------------------------------------------------------------
export function resolveModelWithFallback(
  classification: IntentClassification,
  availableModels: Array<{ provider: string; models: Array<{ name: string }> }>,
): IntentClassification {
  const rec = classification.recommendedModel;

  // Check if recommended model is available
  const providerAvailable = availableModels.find(
    (p) => p.provider === rec.provider,
  );
  if (providerAvailable) {
    const modelAvailable = providerAvailable.models.find(
      (m) => m.name === rec.model,
    );
    if (modelAvailable) return classification;
  }

  // Fall back to gpt-4.1-mini (always available via custom proxy)
  return {
    ...classification,
    recommendedModel: { provider: "openai", model: "gpt-4.1-mini" },
    reasoning: `${classification.reasoning} (using gpt-4.1-mini as fallback)`,
  };
}
