import {
  BlendIcon,
  BrainIcon,
  CpuIcon,
  SparklesIcon,
  ZapIcon,
  AtomIcon,
  MoonIcon,
  MonitorIcon,
  CircuitBoardIcon,
  RocketIcon,
  BoxIcon,
} from "lucide-react";
import { ClaudeIcon } from "./claude-icon";
import { GeminiIcon } from "./gemini-icon";
import { GrokIcon } from "./grok-icon";
import { OpenAIIcon } from "./openai-icon";
import { OllamaIcon } from "./ollama-icon";
import { OpenRouterIcon } from "./open-router-icon";

export function ModelProviderIcon({
  provider,
  className,
}: { provider: string; className?: string }) {
  switch (provider) {
    case "openai":
      return <OpenAIIcon className={className} />;
    case "xai":
      return <GrokIcon className={className} />;
    case "anthropic":
      return <ClaudeIcon className={className} />;
    case "google":
      return <GeminiIcon className={className} />;
    case "ollama":
      return <OllamaIcon className={className} />;
    case "openRouter":
      return <OpenRouterIcon className={className} />;
    case "deepseek":
      return <BrainIcon className={className} />;
    case "qwen":
      return <SparklesIcon className={className} />;
    case "meta":
      return <AtomIcon className={className} />;
    case "mistral":
      return <ZapIcon className={className} />;
    case "minimax":
      return <BoxIcon className={className} />;
    case "moonshot":
      return <MoonIcon className={className} />;
    case "microsoft":
      return <MonitorIcon className={className} />;
    case "nvidia":
      return <CircuitBoardIcon className={className} />;
    case "stepfun":
      return <RocketIcon className={className} />;
    case "glm":
      return <CpuIcon className={className} />;
    default:
      return <BlendIcon className={className} />;
  }
}
