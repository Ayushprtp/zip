/**
 * Example: Using Groq Models in the AI Builder
 *
 * This file demonstrates various ways to integrate Groq models
 * into your builder components.
 */

"use client";

import { useState } from "react";
import {
  createBuilderAIService,
  createCodeGenerationService,
  createChatService,
  createFastResponseService,
  createCustomAIService,
} from "./ai-service-factory";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Example 1: Basic Code Generation with Default Model
export function BasicCodeGeneration() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setResult("");

    // Uses default Groq Llama 3.3 70B
    const aiService = createBuilderAIService();

    try {
      await aiService.generateCode({
        prompt,
        context: [],
        onToken: (token) => {
          setResult((prev) => prev + token);
        },
        onComplete: (fullResponse) => {
          console.log("Generation complete:", fullResponse);
        },
        onError: (error) => {
          console.error("Generation failed:", error);
          setResult(`Error: ${error.message}`);
        },
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Basic Code Generation (Llama 3.3 70B)</h3>
      <Textarea
        placeholder="Describe what you want to build..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
      />
      <Button onClick={handleGenerate} disabled={isGenerating || !prompt}>
        {isGenerating ? "Generating..." : "Generate Code"}
      </Button>
      {result && (
        <pre className="p-4 bg-muted rounded-lg overflow-auto">
          <code>{result}</code>
        </pre>
      )}
    </div>
  );
}

// Example 2: Model Selection
export function ModelSelector() {
  const [selectedModel, setSelectedModel] = useState<string>("default");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const models = [
    { value: "default", label: "Llama 3.3 70B (Default)", speed: "280 t/s" },
    { value: "code", label: "Llama 4 Scout (Code)", speed: "750 t/s" },
    { value: "chat", label: "Llama 4 Maverick (Chat)", speed: "600 t/s" },
    { value: "fast", label: "Llama 3.1 8B (Fast)", speed: "560 t/s" },
    { value: "qwen", label: "Qwen3 32B (Multilingual)", speed: "400 t/s" },
  ];

  const handleGenerate = async () => {
    setIsGenerating(true);
    setResult("");

    // Select appropriate service based on model choice
    let aiService;
    switch (selectedModel) {
      case "code":
        aiService = createCodeGenerationService();
        break;
      case "chat":
        aiService = createChatService();
        break;
      case "fast":
        aiService = createFastResponseService();
        break;
      case "qwen":
        aiService = createCustomAIService("groq", "qwen3-32b");
        break;
      default:
        aiService = createBuilderAIService();
    }

    try {
      await aiService.generateCode({
        prompt,
        context: [],
        onToken: (token) => {
          setResult((prev) => prev + token);
        },
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Model Selection</h3>
      <Select value={selectedModel} onValueChange={setSelectedModel}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.value} value={model.value}>
              {model.label} - {model.speed}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea
        placeholder="Enter your prompt..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
      />
      <Button onClick={handleGenerate} disabled={isGenerating || !prompt}>
        {isGenerating ? "Generating..." : "Generate"}
      </Button>
      {result && (
        <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-96">
          <code>{result}</code>
        </pre>
      )}
    </div>
  );
}

// Example 3: Streaming with Progress
export function StreamingExample() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [tokenCount, setTokenCount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [tokensPerSecond, setTokensPerSecond] = useState<number>(0);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setResult("");
    setTokenCount(0);
    setStartTime(Date.now());

    const aiService = createCodeGenerationService();

    try {
      await aiService.generateCode({
        prompt,
        context: [],
        onToken: (token) => {
          setResult((prev) => prev + token);
          setTokenCount((prev) => {
            const newCount = prev + 1;
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > 0) {
              setTokensPerSecond(Math.round(newCount / elapsed));
            }
            return newCount;
          });
        },
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Streaming with Performance Metrics</h3>
      <Textarea
        placeholder="Enter your prompt..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
      />
      <div className="flex gap-4 items-center">
        <Button onClick={handleGenerate} disabled={isGenerating || !prompt}>
          {isGenerating ? "Generating..." : "Generate"}
        </Button>
        {isGenerating && (
          <div className="text-sm text-muted-foreground">
            {tokenCount} tokens • {tokensPerSecond} tokens/sec
          </div>
        )}
      </div>
      {result && (
        <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-96">
          <code>{result}</code>
        </pre>
      )}
    </div>
  );
}

// Example 4: Error Handling and Retry
export function ErrorHandlingExample() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleGenerate = async (isRetry = false) => {
    if (!isRetry) {
      setRetryCount(0);
    }

    setIsGenerating(true);
    setResult("");
    setError(null);

    const aiService = createBuilderAIService();

    try {
      await aiService.generateCode({
        prompt,
        context: [],
        onToken: (token) => {
          setResult((prev) => prev + token);
        },
        onError: (err) => {
          setError(err.message);

          // Auto-retry logic for rate limits
          if (err.message.includes("rate limit") && retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
            setTimeout(() => {
              setRetryCount((prev) => prev + 1);
              handleGenerate(true);
            }, delay);
          }
        },
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Error Handling with Auto-Retry</h3>
      <Textarea
        placeholder="Enter your prompt..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
      />
      <Button
        onClick={() => handleGenerate()}
        disabled={isGenerating || !prompt}
      >
        {isGenerating ? "Generating..." : "Generate"}
      </Button>
      {retryCount > 0 && (
        <div className="text-sm text-yellow-600">
          Retrying... (Attempt {retryCount + 1}/3)
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}
      {result && (
        <pre className="p-4 bg-muted rounded-lg overflow-auto max-h-96">
          <code>{result}</code>
        </pre>
      )}
    </div>
  );
}

// Example 5: Complete Integration
export function CompleteGroqExample() {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Groq Integration Examples</h2>
        <p className="text-muted-foreground">
          Explore different ways to use Groq models in the AI Builder
        </p>
      </div>

      <BasicCodeGeneration />
      <hr />
      <ModelSelector />
      <hr />
      <StreamingExample />
      <hr />
      <ErrorHandlingExample />
    </div>
  );
}
