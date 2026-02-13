"use client";

import { ToolUIPart } from "ai";
import equal from "lib/equal";
import { cn, toAny } from "lib/utils";
import {
  Globe,
  Search,
  FileText,
  Camera,
  ExternalLink,
  AlertTriangleIcon,
  CheckCircle2,
  Loader2,
  BookOpen,
  Link2,
} from "lucide-react";
import { memo, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "ui/hover-card";
import JsonView from "ui/json-view";
import { Separator } from "ui/separator";
import { TextShimmer } from "ui/text-shimmer";
import { DefaultToolName } from "lib/ai/tools";

// ─── Web Page Reader ────────────────────────────────────────────────────────

function WebPageReaderInvocation({ part }: { part: ToolUIPart }) {
  const isComplete = part.state.startsWith("output");
  const input = part.input as {
    url?: string;
    maxLength?: number;
    includeLinks?: boolean;
    includeImages?: boolean;
  };
  const result = isComplete ? (part.output as any) : null;
  const isError = result?.isError;
  const [expanded, setExpanded] = useState(false);

  const domain = useMemo(() => {
    try {
      return new URL(input?.url || "").hostname;
    } catch {
      return input?.url || "unknown";
    }
  }, [input?.url]);

  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  if (!isComplete) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="relative">
          <FileText className="size-5 text-blue-500" />
          <Loader2 className="size-3 text-blue-500 absolute -bottom-0.5 -right-0.5 animate-spin" />
        </div>
        <div className="flex flex-col">
          <TextShimmer className="text-sm">{`Reading ${domain}...`}</TextShimmer>
          <span className="text-xs text-muted-foreground truncate max-w-80">
            {input?.url}
          </span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <FileText className="size-5 text-destructive" />
        <div className="flex flex-col">
          <span className="text-sm text-destructive flex items-center gap-1">
            <AlertTriangleIcon className="size-3.5" />
            Failed to read page
          </span>
          <span className="text-xs text-muted-foreground">{result.error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center gap-2 cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="p-1 rounded bg-blue-500/10">
          <FileText className="size-4 text-blue-500" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {result?.title || "Page read"}
            </span>
            <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
          </div>
          <a
            href={input?.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary truncate flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Avatar className="size-3 rounded-full">
              <AvatarImage src={favicon} />
              <AvatarFallback className="text-[6px]">W</AvatarFallback>
            </Avatar>
            {domain}
            <ExternalLink className="size-2.5" />
          </a>
        </div>
        <span className="text-xs text-muted-foreground">
          {result?.wordCount?.toLocaleString()} words
        </span>
      </div>

      {expanded && (
        <div className="flex gap-2">
          <div className="px-2.5">
            <Separator
              orientation="vertical"
              className="bg-gradient-to-b from-border to-transparent from-80%"
            />
          </div>
          <div className="flex flex-col gap-2 pb-2 text-xs text-muted-foreground max-h-60 overflow-auto">
            {result?.description && (
              <p className="italic">{result.description}</p>
            )}
            <p className="whitespace-pre-wrap line-clamp-12">
              {result?.content?.slice(0, 2000)}
              {(result?.content?.length ?? 0) > 2000 && "..."}
            </p>
            {result?.links?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="font-medium flex items-center gap-1">
                  <Link2 className="size-3" />
                  {result.links.length} links found
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Web Research ───────────────────────────────────────────────────────────

function WebResearchInvocation({ part }: { part: ToolUIPart }) {
  const isComplete = part.state.startsWith("output");
  const input = part.input as {
    topic?: string;
    depth?: string;
    sources?: number;
  };
  const result = isComplete ? (part.output as any) : null;
  const isError = result?.isError;
  const [expanded, setExpanded] = useState(true);

  if (!isComplete) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm">
          <div className="relative">
            <BookOpen className="size-5 text-emerald-500" />
            <Loader2 className="size-3 text-emerald-500 absolute -bottom-0.5 -right-0.5 animate-spin" />
          </div>
          <div className="flex flex-col">
            <TextShimmer className="text-sm">
              {`Researching: ${(input?.topic || "").slice(0, 60)}${(input?.topic?.length ?? 0) > 60 ? "..." : ""}`}
            </TextShimmer>
            <span className="text-xs text-muted-foreground">
              Depth: {input?.depth || "standard"} · Looking for{" "}
              {input?.sources || 5} sources
            </span>
          </div>
        </div>
        <div className="flex gap-2 ml-7">
          <div className="flex flex-col gap-1">
            {[
              "Searching the web...",
              "Gathering sources...",
              "Cross-referencing...",
            ].map((step, i) => (
              <div
                key={step}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <Loader2
                  className={cn("size-3 animate-spin", i > 0 && "opacity-30")}
                />
                <span className={cn(i > 0 && "opacity-30")}>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <BookOpen className="size-5 text-destructive" />
        <div className="flex flex-col">
          <span className="text-sm text-destructive flex items-center gap-1">
            <AlertTriangleIcon className="size-3.5" />
            Research failed
          </span>
          <span className="text-xs text-muted-foreground">{result.error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center gap-2 cursor-pointer group"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="p-1 rounded bg-emerald-500/10">
          <BookOpen className="size-4 text-emerald-500" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              Research: {input?.topic?.slice(0, 50)}
            </span>
            <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
          </div>
          <span className="text-xs text-muted-foreground">
            {result?.sourcesReturned} sources · {result?.queriesUsed?.length}{" "}
            queries · {input?.depth} depth
          </span>
        </div>
      </div>

      {expanded && result?.sources?.length > 0 && (
        <div className="flex gap-2">
          <div className="px-2.5">
            <Separator
              orientation="vertical"
              className="bg-gradient-to-b from-border to-transparent from-80%"
            />
          </div>
          <div className="flex flex-col gap-2 pb-2">
            {/* Queries used */}
            <div className="flex flex-wrap gap-1">
              {result.queriesUsed?.map((q: string, i: number) => (
                <span
                  key={i}
                  className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  <Search className="size-2.5 inline mr-0.5" />
                  {q.slice(0, 40)}
                </span>
              ))}
            </div>
            {/* Sources */}
            <div className="flex flex-wrap gap-1">
              {result.sources.map((source: any, i: number) => {
                const domain = (() => {
                  try {
                    return new URL(source.url).hostname;
                  } catch {
                    return source.url;
                  }
                })();
                const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
                return (
                  <HoverCard key={i} openDelay={200} closeDelay={0}>
                    <HoverCardTrigger asChild>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group rounded-full bg-secondary pl-1.5 pr-2 py-1.5 text-xs flex items-center gap-1 hover:bg-input hover:ring hover:ring-emerald-500 transition-all cursor-pointer"
                      >
                        <div className="rounded-full bg-input ring ring-input">
                          <Avatar className="size-3 rounded-full">
                            <AvatarImage src={favicon} />
                            <AvatarFallback className="text-[6px]">
                              {source.title?.slice(0, 1).toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                        <span className="truncate max-w-44">
                          {source.title || domain}
                        </span>
                      </a>
                    </HoverCardTrigger>
                    <HoverCardContent className="flex flex-col gap-1 p-4 max-w-sm">
                      <span className="font-medium text-sm">
                        {source.title}
                      </span>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 truncate hover:underline"
                      >
                        {source.url}
                      </a>
                      <div className="relative mt-2">
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-card from-80%" />
                        <p className="text-xs text-muted-foreground max-h-40 overflow-y-auto">
                          {source.text?.slice(0, 500)}
                        </p>
                      </div>
                      {source.publishedDate && (
                        <span className="text-[10px] text-muted-foreground mt-1">
                          Published:{" "}
                          {new Date(source.publishedDate).toLocaleDateString()}
                        </span>
                      )}
                    </HoverCardContent>
                  </HoverCard>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground ml-1">
              {result.totalSourcesFound} total sources found,{" "}
              {result.sourcesReturned} returned
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Web Screenshot ─────────────────────────────────────────────────────────

function WebScreenshotInvocation({ part }: { part: ToolUIPart }) {
  const isComplete = part.state.startsWith("output");
  const input = part.input as { url?: string; fullPage?: boolean };
  const result = isComplete ? (part.output as any) : null;
  const isError = result?.isError;

  const domain = useMemo(() => {
    try {
      return new URL(input?.url || "").hostname;
    } catch {
      return input?.url || "unknown";
    }
  }, [input?.url]);

  if (!isComplete) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="relative">
          <Camera className="size-5 text-purple-500" />
          <Loader2 className="size-3 text-purple-500 absolute -bottom-0.5 -right-0.5 animate-spin" />
        </div>
        <div className="flex flex-col">
          <TextShimmer className="text-sm">{`Capturing ${domain}...`}</TextShimmer>
          <span className="text-xs text-muted-foreground">
            {input?.fullPage ? "Full page" : "Viewport"} screenshot
          </span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Camera className="size-5 text-destructive" />
        <div className="flex flex-col">
          <span className="text-sm text-destructive flex items-center gap-1">
            <AlertTriangleIcon className="size-3.5" />
            Screenshot failed
          </span>
          <span className="text-xs text-muted-foreground">{result.error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="p-1 rounded bg-purple-500/10">
          <Camera className="size-4 text-purple-500" />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Screenshot captured</span>
            <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
          </div>
          <a
            href={input?.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-primary truncate flex items-center gap-1"
          >
            {domain}
            <ExternalLink className="size-2.5" />
          </a>
        </div>
        {result?.width && result?.height && (
          <span className="text-xs text-muted-foreground">
            {result.width}x{result.height}
          </span>
        )}
      </div>
      {result?.screenshotUrl && (
        <div className="ml-7">
          <a
            href={result.screenshotUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              loading="lazy"
              src={result.screenshotUrl}
              alt={`Screenshot of ${domain}`}
              className="rounded-lg border border-border max-w-md w-full shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            />
          </a>
        </div>
      )}
    </div>
  );
}

// ─── HTTP Tool Invocation (enhanced for web agent) ──────────────────────────

function HttpToolInvocation({ part }: { part: ToolUIPart }) {
  const isComplete = part.state.startsWith("output");
  const input = part.input as { method?: string; url?: string };
  const result = isComplete ? (part.output as any) : null;
  const isError = result?.isError || (result?.status && result.status >= 400);
  const [expanded, setExpanded] = useState(false);

  const domain = useMemo(() => {
    try {
      return new URL(input?.url || "").hostname;
    } catch {
      return input?.url || "unknown";
    }
  }, [input?.url]);

  if (!isComplete) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="relative">
          <Globe className="size-5 text-orange-500" />
          <Loader2 className="size-3 text-orange-500 absolute -bottom-0.5 -right-0.5 animate-spin" />
        </div>
        <TextShimmer className="text-sm">
          {`${input?.method || "GET"} ${domain}...`}
        </TextShimmer>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="p-1 rounded bg-orange-500/10">
          <Globe className="size-4 text-orange-500" />
        </div>
        <span
          className={cn(
            "text-xs font-mono font-medium px-1.5 py-0.5 rounded",
            isError
              ? "bg-destructive/10 text-destructive"
              : "bg-green-500/10 text-green-600",
          )}
        >
          {input?.method || "GET"} {result?.status || ""}
        </span>
        <span className="text-xs text-muted-foreground truncate max-w-60">
          {domain}
        </span>
        {!isError && <CheckCircle2 className="size-3.5 text-green-500" />}
        {isError && <AlertTriangleIcon className="size-3.5 text-destructive" />}
      </div>
      {expanded && (
        <div className="ml-7 mt-1">
          <div className="bg-secondary rounded p-2 max-h-40 overflow-auto">
            <JsonView data={result} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Browser Automation ─────────────────────────────────────────────────────

function BrowserAutomationInvocation({ part }: { part: ToolUIPart }) {
  const isComplete = part.state.startsWith("output");
  const input = part.input as { command?: string; timeout?: number };
  const result = isComplete ? (part.output as any) : null;
  const isError = result?.isError;
  const [expanded, setExpanded] = useState(false);
  const [showEvents, setShowEvents] = useState(false);

  const shortCommand = useMemo(() => {
    const cmd = input?.command || "Browser task";
    return cmd.length > 80 ? cmd.slice(0, 77) + "..." : cmd;
  }, [input?.command]);

  if (!isComplete) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <div className="relative">
          <Globe className="size-5 text-violet-500" />
          <Loader2 className="size-3 text-violet-500 absolute -bottom-0.5 -right-0.5 animate-spin" />
        </div>
        <div className="flex flex-col gap-0.5">
          <TextShimmer className="text-sm">
            {`Browser automating...`}
          </TextShimmer>
          <span className="text-xs text-muted-foreground truncate max-w-96">
            {shortCommand}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
        title="Click to expand/collapse"
      >
        <Globe
          className={cn(
            "size-5",
            isError ? "text-destructive" : "text-violet-500",
          )}
        />
        <span className="text-sm font-medium truncate max-w-96">
          {shortCommand}
        </span>
        {!isError && <CheckCircle2 className="size-3.5 text-green-500" />}
        {isError && <AlertTriangleIcon className="size-3.5 text-destructive" />}
        {!isError && result?.totalSteps != null && (
          <span className="text-xs text-muted-foreground">
            {result.totalSteps} steps &middot;{" "}
            {((result.durationMs || 0) / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {expanded && (
        <div className="ml-7 flex flex-col gap-2 mt-1">
          {/* Final result */}
          {result?.result && !isError && (
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-md p-3">
              <p className="text-xs font-medium text-violet-400 mb-1">Result</p>
              <p className="text-sm whitespace-pre-wrap">{result.result}</p>
            </div>
          )}

          {/* Plan */}
          {result?.plan && (
            <div className="bg-secondary/60 rounded-md p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Plan
              </p>
              <p className="text-sm whitespace-pre-wrap">{result.plan}</p>
            </div>
          )}

          {/* Steps */}
          {result?.steps?.length > 0 && (
            <div className="bg-secondary/40 rounded-md p-3">
              <button
                className="text-xs font-medium text-muted-foreground mb-1 hover:text-foreground transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEvents(!showEvents);
                }}
              >
                {showEvents ? "▼" : "▶"} Steps ({result.steps.length})
              </button>
              {showEvents && (
                <div className="mt-2 flex flex-col gap-1">
                  {result.steps.map((step: string, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-xs text-muted-foreground"
                    >
                      <span className="text-violet-400 font-mono shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <p className="text-xs font-medium text-destructive mb-1">Error</p>
              <p className="text-sm text-destructive/80">{result.error}</p>
              {result.solution && (
                <p className="text-xs text-muted-foreground mt-1">
                  {result.solution}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Dispatcher component ───────────────────────────────────────────────────

interface WebAgentToolInvocationProps {
  part: ToolUIPart;
  toolName: string;
}

function PureWebAgentToolInvocation({
  part,
  toolName,
}: WebAgentToolInvocationProps) {
  switch (toolName) {
    case DefaultToolName.WebPageReader:
      return <WebPageReaderInvocation part={part} />;
    case DefaultToolName.WebResearch:
      return <WebResearchInvocation part={part} />;
    case DefaultToolName.WebScreenshot:
      return <WebScreenshotInvocation part={part} />;
    case DefaultToolName.Http:
      return <HttpToolInvocation part={part} />;
    case DefaultToolName.BrowserAutomation:
      return <BrowserAutomationInvocation part={part} />;
    default:
      return null;
  }
}

function areEqual(
  { part: prevPart, toolName: prevName }: WebAgentToolInvocationProps,
  { part: nextPart, toolName: nextName }: WebAgentToolInvocationProps,
) {
  if (prevName !== nextName) return false;
  if (prevPart.state !== nextPart.state) return false;
  if (!equal(prevPart.input, nextPart.input)) return false;
  if (
    prevPart.state.startsWith("output") &&
    !equal(prevPart.output, toAny(nextPart).output)
  )
    return false;
  return true;
}

export const WebAgentToolInvocation = memo(
  PureWebAgentToolInvocation,
  areEqual,
);
