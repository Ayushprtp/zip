"use client";

import { ToolUIPart } from "ai";
import equal from "lib/equal";
import { toAny } from "lib/utils";
import { AlertTriangleIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { memo, useMemo } from "react";
import { GlobalIcon } from "ui/global-icon";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "ui/hover-card";
import JsonView from "ui/json-view";
import { Separator } from "ui/separator";
import { TextShimmer } from "ui/text-shimmer";

/** TheAgenticBrowser returns a flat result string + steps array */
interface BrowserSearchResult {
  query?: string;
  result?: string | null;
  steps?: string[];
  durationMs?: number;
  isError?: boolean;
  error?: string;
}

interface WebSearchToolInvocationProps {
  part: ToolUIPart;
}

function PureWebSearchToolInvocation({ part }: WebSearchToolInvocationProps) {
  const t = useTranslations();

  const result = useMemo(() => {
    if (!part.state.startsWith("output")) return null;
    return part.output as BrowserSearchResult;
  }, [part.state]);

  const options = useMemo(() => {
    return (
      <HoverCard openDelay={200} closeDelay={0}>
        <HoverCardTrigger asChild>
          <span className="hover:text-primary transition-colors text-xs text-muted-foreground">
            {t("Chat.Tool.searchOptions")}
          </span>
        </HoverCardTrigger>
        <HoverCardContent className="max-w-xs md:max-w-md! w-full! overflow-auto flex flex-col">
          <p className="text-xs text-muted-foreground px-2 mb-2">
            {t("Chat.Tool.searchOptionsDescription")}
          </p>
          <div className="p-2">
            <JsonView data={part.input} />
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }, [part.input]);

  if (!part.state.startsWith("output"))
    return (
      <div className="flex items-center gap-2 text-sm">
        <GlobalIcon className="size-5 wiggle text-muted-foreground" />
        <TextShimmer>{t("Chat.Tool.webSearching")}</TextShimmer>
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <GlobalIcon className="size-5 text-muted-foreground" />
        <span className="text-sm font-semibold">
          {t("Chat.Tool.searchedTheWeb")}
        </span>
        {options}
      </div>
      <div className="flex gap-2">
        <div className="px-2.5">
          <Separator
            orientation="vertical"
            className="bg-gradient-to-b from-border to-transparent from-80%"
          />
        </div>
        <div className="flex flex-col gap-2 pb-2">
          {result?.isError ? (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangleIcon className="size-3.5" />
              {result.error || "Error"}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {result?.result && (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {result.result}
                </p>
              )}
              {result?.steps && result.steps.length > 0 && (
                <HoverCard openDelay={200} closeDelay={0}>
                  <HoverCardTrigger asChild>
                    <span className="text-xs text-muted-foreground hover:text-primary cursor-pointer transition-colors">
                      {result.steps.length} step
                      {result.steps.length !== 1 ? "s" : ""} completed
                      {result.durationMs
                        ? ` in ${(result.durationMs / 1000).toFixed(1)}s`
                        : ""}
                    </span>
                  </HoverCardTrigger>
                  <HoverCardContent className="flex flex-col gap-1 p-4 max-w-md max-h-80 overflow-y-auto">
                    {result.steps.map((step, i) => (
                      <p key={i} className="text-xs text-muted-foreground">
                        {i + 1}. {step}
                      </p>
                    ))}
                  </HoverCardContent>
                </HoverCard>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function areEqual(
  { part: prevPart }: WebSearchToolInvocationProps,
  { part: nextPart }: WebSearchToolInvocationProps,
) {
  if (prevPart.state != nextPart.state) return false;
  if (!equal(prevPart.input, nextPart.input)) return false;
  if (
    prevPart.state.startsWith("output") &&
    !equal(prevPart.output, toAny(nextPart).output)
  )
    return false;
  return true;
}

export const WebSearchToolInvocation = memo(
  PureWebSearchToolInvocation,
  areEqual,
);
