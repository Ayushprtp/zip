"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";
import {
  Search,
  Replace,
  ChevronDown,
  ChevronRight,
  FileCode,
  CaseSensitive,
  Regex,
  WholeWord,
} from "lucide-react";

interface SearchResult {
  filePath: string;
  line: number;
  col: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

interface CodeSearchPanelProps {
  files?: Record<string, string>;
  onFileClick?: (path: string, line?: number) => void;
}

export function CodeSearchPanel({
  files: _propFiles,
  onFileClick,
}: CodeSearchPanelProps) {
  const { sandpack } = useSandpack();
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [showReplace, setShowReplace] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];

    const results: SearchResult[] = [];
    const fileEntries = Object.entries(sandpack.files).filter(
      ([path]) => !path.startsWith("/.flare-sh/"),
    );

    for (const [filePath, fileData] of fileEntries) {
      const content = typeof fileData === "string" ? fileData : fileData.code;
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let searchStr = searchQuery;
        let lineToSearch = line;

        if (!caseSensitive) {
          searchStr = searchStr.toLowerCase();
          lineToSearch = line.toLowerCase();
        }

        if (wholeWord) {
          const regex = new RegExp(
            `\\b${searchStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
            caseSensitive ? "" : "i",
          );
          const match = regex.exec(line);
          if (match) {
            results.push({
              filePath,
              line: i + 1,
              col: match.index + 1,
              lineContent: line,
              matchStart: match.index,
              matchEnd: match.index + searchQuery.length,
            });
          }
        } else if (useRegex) {
          try {
            const regex = new RegExp(searchQuery, caseSensitive ? "g" : "gi");
            let match;
            while ((match = regex.exec(line)) !== null) {
              results.push({
                filePath,
                line: i + 1,
                col: match.index + 1,
                lineContent: line,
                matchStart: match.index,
                matchEnd: match.index + match[0].length,
              });
              if (!regex.global) break;
            }
          } catch {
            // Invalid regex, skip
          }
        } else {
          let idx = lineToSearch.indexOf(searchStr);
          while (idx !== -1) {
            results.push({
              filePath,
              line: i + 1,
              col: idx + 1,
              lineContent: line,
              matchStart: idx,
              matchEnd: idx + searchQuery.length,
            });
            idx = lineToSearch.indexOf(searchStr, idx + 1);
          }
        }

        // Cap results
        if (results.length >= 500) break;
      }
      if (results.length >= 500) break;
    }

    return results;
  }, [searchQuery, sandpack.files, caseSensitive, useRegex, wholeWord]);

  const groupedResults = useMemo(() => {
    const grouped = new Map<string, SearchResult[]>();
    for (const result of searchResults) {
      if (!grouped.has(result.filePath)) {
        grouped.set(result.filePath, []);
      }
      grouped.get(result.filePath)!.push(result);
    }
    return Array.from(grouped.entries()).map(([filePath, matches]) => ({
      filePath,
      matches,
    }));
  }, [searchResults]);

  const toggleFile = useCallback((filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  }, []);

  const handleResultClick = (filePath: string, line: number) => {
    sandpack.openFile(filePath);
    // Optional: trigger editor focus/scroll if possible via other APIs
    if (onFileClick) onFileClick(filePath, line);
  };

  // Auto-expand first 5 files
  useMemo(() => {
    const initial = new Set(groupedResults.slice(0, 5).map((g) => g.filePath));
    setExpandedFiles(initial);
  }, [searchQuery]);

  const totalFiles = groupedResults.length;
  const totalMatches = searchResults.length;

  return (
    <div className="h-full flex flex-col text-xs overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-end px-3 py-1 border-b bg-muted/30 shrink-0">
        <button
          onClick={() => setShowReplace(!showReplace)}
          className={`h-5 w-5 flex items-center justify-center rounded transition-colors ${showReplace ? "bg-blue-500/20 text-blue-400" : "hover:bg-muted/60 text-muted-foreground"}`}
          title="Toggle Replace"
        >
          <Replace className="h-3 w-3" />
        </button>
      </div>

      {/* Search Input */}
      <div className="px-2 py-2 space-y-1.5 border-b border-border/20 shrink-0">
        <div className="relative flex items-center gap-1">
          <Search className="absolute left-2 h-3 w-3 text-muted-foreground/50" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 h-7 pl-7 pr-20 text-[11px] bg-muted/30 border border-border/30 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 placeholder:text-muted-foreground/40"
            autoFocus
          />
          {/* Toggle buttons */}
          <div className="absolute right-1 flex items-center gap-0.5">
            <button
              onClick={() => setCaseSensitive(!caseSensitive)}
              className={`h-5 w-5 flex items-center justify-center rounded text-[10px] transition-colors ${caseSensitive ? "bg-blue-500/20 text-blue-400" : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40"}`}
              title="Match Case"
            >
              <CaseSensitive className="h-3 w-3" />
            </button>
            <button
              onClick={() => setWholeWord(!wholeWord)}
              className={`h-5 w-5 flex items-center justify-center rounded text-[10px] transition-colors ${wholeWord ? "bg-blue-500/20 text-blue-400" : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40"}`}
              title="Match Whole Word"
            >
              <WholeWord className="h-3 w-3" />
            </button>
            <button
              onClick={() => setUseRegex(!useRegex)}
              className={`h-5 w-5 flex items-center justify-center rounded text-[10px] transition-colors ${useRegex ? "bg-blue-500/20 text-blue-400" : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40"}`}
              title="Use Regular Expression"
            >
              <Regex className="h-3 w-3" />
            </button>
          </div>
        </div>
        {showReplace && (
          <div className="relative flex items-center gap-1">
            <Replace className="absolute left-2 h-3 w-3 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Replace"
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              className="flex-1 h-7 pl-7 pr-2 text-[11px] bg-muted/30 border border-border/30 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500/40 focus:border-blue-500/40 placeholder:text-muted-foreground/40"
            />
          </div>
        )}
      </div>

      {/* Results Summary */}
      {searchQuery.length >= 2 && (
        <div className="px-3 py-1.5 text-[10px] text-muted-foreground/60 border-b border-border/10 shrink-0">
          {totalMatches > 0 ? (
            <span>
              <span className="text-foreground font-medium">
                {totalMatches}
              </span>{" "}
              result{totalMatches !== 1 ? "s" : ""} in{" "}
              <span className="text-foreground font-medium">{totalFiles}</span>{" "}
              file{totalFiles !== 1 ? "s" : ""}
              {totalMatches >= 500 && " (capped)"}
            </span>
          ) : (
            <span>No results found</span>
          )}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-auto min-h-0">
        {groupedResults.map((group) => {
          const isExpanded = expandedFiles.has(group.filePath);
          return (
            <div key={group.filePath}>
              <button
                onClick={() => toggleFile(group.filePath)}
                className="w-full flex items-center gap-1.5 px-2 py-1 hover:bg-muted/30 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                <FileCode className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                <span className="text-[11px] font-medium truncate">
                  {group.filePath.split("/").pop()}
                </span>
                <span className="ml-auto text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-full border border-blue-500/20 font-semibold shrink-0">
                  {group.matches.length}
                </span>
              </button>
              {isExpanded && (
                <div>
                  {group.matches.slice(0, 50).map((match, idx) => (
                    <button
                      key={`${match.filePath}:${match.line}:${idx}`}
                      className="w-full text-left flex items-start gap-1 pl-7 pr-2 py-0.5 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() =>
                        handleResultClick(match.filePath, match.line)
                      }
                    >
                      <span className="text-[10px] leading-5 font-mono whitespace-pre overflow-hidden text-ellipsis">
                        {match.lineContent.substring(0, match.matchStart)}
                        <span className="bg-amber-500/30 text-amber-200 rounded-sm px-0.5">
                          {match.lineContent.substring(
                            match.matchStart,
                            match.matchEnd,
                          )}
                        </span>
                        {match.lineContent.substring(
                          match.matchEnd,
                          match.matchEnd + 60,
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
