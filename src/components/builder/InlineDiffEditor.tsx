"use client";

import { useState } from "react";
import { Check, X, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

/**
 * Inline Code Suggestion — Void-editor-style diff overlay.
 *
 * Shows:
 *   - Deleted lines (red, struck-through)
 *   - Added lines (green, highlighted)
 *   - Accept / Reject buttons
 *
 * Usage:
 *   <InlineDiffEditor
 *     originalCode="const x = 1;"
 *     suggestedCode="const x = 42;"
 *     filePath="/App.tsx"
 *     language="typescript"
 *     onAccept={(newCode) => { ... }}
 *     onReject={() => { ... }}
 *   />
 */

export interface CodeSuggestion {
  id: string;
  filePath: string;
  originalCode: string;
  suggestedCode: string;
  description?: string;
  startLine?: number;
  endLine?: number;
}

interface InlineDiffEditorProps {
  suggestion: CodeSuggestion;
  onAccept: (suggestion: CodeSuggestion) => void;
  onReject: (suggestion: CodeSuggestion) => void;
}

interface DiffLine {
  type: "context" | "add" | "remove";
  content: string;
  lineNumber?: number;
}

function computeInlineDiff(original: string, modified: string): DiffLine[] {
  const oldLines = original.split("\n");
  const newLines = modified.split("\n");
  const result: DiffLine[] = [];

  // Simple LCS-based diff
  const lcs = computeLCS(oldLines, newLines);
  let oi = 0;
  let ni = 0;

  for (const common of lcs) {
    // Removed lines
    while (oi < common.oi) {
      result.push({
        type: "remove",
        content: oldLines[oi],
        lineNumber: oi + 1,
      });
      oi++;
    }
    // Added lines
    while (ni < common.ni) {
      result.push({ type: "add", content: newLines[ni], lineNumber: ni + 1 });
      ni++;
    }
    // Context line
    result.push({ type: "context", content: oldLines[oi], lineNumber: oi + 1 });
    oi++;
    ni++;
  }

  // Remaining removed
  while (oi < oldLines.length) {
    result.push({ type: "remove", content: oldLines[oi], lineNumber: oi + 1 });
    oi++;
  }
  // Remaining added
  while (ni < newLines.length) {
    result.push({ type: "add", content: newLines[ni], lineNumber: ni + 1 });
    ni++;
  }

  return result;
}

function computeLCS(
  a: string[],
  b: string[],
): Array<{ oi: number; ni: number }> {
  const m = a.length;
  const n = b.length;

  // DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find matches
  const result: Array<{ oi: number; ni: number }> = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift({ oi: i - 1, ni: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return result;
}

export function InlineDiffEditor({
  suggestion,
  onAccept,
  onReject,
}: InlineDiffEditorProps) {
  const [collapsed, setCollapsed] = useState(false);
  const diffLines = computeInlineDiff(
    suggestion.originalCode,
    suggestion.suggestedCode,
  );

  const addedCount = diffLines.filter((l) => l.type === "add").length;
  const removedCount = diffLines.filter((l) => l.type === "remove").length;

  return (
    <div className="rounded-lg border border-violet-500/30 overflow-hidden bg-background/95 backdrop-blur-sm shadow-lg shadow-violet-500/5">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-violet-500/10 border-b border-violet-500/20">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-[11px] font-medium text-violet-300">
            AI Suggestion
          </span>
          {suggestion.description && (
            <span className="text-[10px] text-muted-foreground">
              — {suggestion.description}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-emerald-400 font-mono">
            +{addedCount}
          </span>
          <span className="text-[10px] text-red-400 font-mono">
            -{removedCount}
          </span>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded hover:bg-muted/60 text-muted-foreground ml-1"
          >
            {collapsed ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronUp className="h-3 w-3" />
            )}
          </button>
        </div>
      </div>

      {/* Diff Content */}
      {!collapsed && (
        <div className="max-h-[300px] overflow-y-auto text-[12px] font-mono leading-[20px]">
          {diffLines.map((line, i) => (
            <div
              key={i}
              className={`flex ${
                line.type === "add"
                  ? "bg-emerald-500/10 text-emerald-300"
                  : line.type === "remove"
                    ? "bg-red-500/10 text-red-300 line-through opacity-70"
                    : "text-foreground/80"
              }`}
            >
              <span className="w-[40px] text-right pr-2 text-muted-foreground/40 select-none shrink-0 border-r border-border/20">
                {line.type === "add"
                  ? "+"
                  : line.type === "remove"
                    ? "-"
                    : line.lineNumber}
              </span>
              <span className="px-2 whitespace-pre-wrap break-all">
                {line.content}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Action Bar */}
      <div className="flex items-center justify-end gap-2 px-3 py-1.5 border-t border-violet-500/20 bg-muted/20">
        <button
          onClick={() => onReject(suggestion)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
        >
          <X className="h-3 w-3" />
          Reject
        </button>
        <button
          onClick={() => onAccept(suggestion)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors"
        >
          <Check className="h-3 w-3" />
          Accept
        </button>
      </div>
    </div>
  );
}

/**
 * A panel that shows pending code suggestions from AI.
 * Each suggestion can be accepted or rejected individually.
 */
interface InlineSuggestionsPanelProps {
  suggestions: CodeSuggestion[];
  onAccept: (suggestion: CodeSuggestion) => void;
  onReject: (suggestion: CodeSuggestion) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

export function InlineSuggestionsPanel({
  suggestions,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
}: InlineSuggestionsPanelProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-2 p-2">
      {/* Batch actions */}
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[11px] text-muted-foreground font-medium">
          {suggestions.length} suggestion{suggestions.length > 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onRejectAll}
            className="text-[10px] text-red-400 hover:text-red-300 font-medium"
          >
            Reject All
          </button>
          <button
            onClick={onAcceptAll}
            className="text-[10px] text-emerald-400 hover:text-emerald-300 font-medium"
          >
            Accept All
          </button>
        </div>
      </div>

      {suggestions.map((suggestion) => (
        <InlineDiffEditor
          key={suggestion.id}
          suggestion={suggestion}
          onAccept={onAccept}
          onReject={onReject}
        />
      ))}
    </div>
  );
}
