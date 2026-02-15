"use client";

import { useState, useRef, useEffect } from "react";
import {
  GitBranch,
  AlertTriangle,
  Info,
  CheckCircle2,
  Wifi,
  Bell,
} from "lucide-react";
import { useBuilderUIStore } from "@/stores/builder-ui-store";
import { useRemoteDevStore } from "@/stores/remote-dev-store";

// Language detection by extension
function getLanguage(filePath: string | null): string {
  if (!filePath) return "Plain Text";
  const ext = filePath.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript React",
    js: "JavaScript",
    jsx: "JavaScript React",
    json: "JSON",
    html: "HTML",
    css: "CSS",
    scss: "SCSS",
    less: "LESS",
    md: "Markdown",
    py: "Python",
    rs: "Rust",
    go: "Go",
    java: "Java",
    rb: "Ruby",
    php: "PHP",
    sh: "Shell Script",
    yml: "YAML",
    yaml: "YAML",
    toml: "TOML",
    xml: "XML",
    svg: "SVG",
    sql: "SQL",
    graphql: "GraphQL",
    prisma: "Prisma",
    env: "Environment",
    gitignore: "Git Ignore",
    dockerfile: "Dockerfile",
  };
  return langMap[ext || ""] || "Plain Text";
}

function getLanguageIcon(lang: string): string {
  if (lang.includes("TypeScript")) return "{ }";
  if (lang.includes("JavaScript")) return "JS";
  if (lang === "JSON") return "{ }";
  if (lang === "HTML") return "<>";
  if (lang === "CSS" || lang === "SCSS" || lang === "LESS") return "#";
  if (lang === "Python") return "Py";
  if (lang === "Markdown") return "M↓";
  return "◇";
}

// Detect encoding from file content
function detectEncoding(filePath: string | null): string {
  if (!filePath) return "UTF-8";
  const ext = filePath.split(".").pop()?.toLowerCase();
  // Binary files
  if (
    [
      "png",
      "jpg",
      "jpeg",
      "gif",
      "webp",
      "svg",
      "ico",
      "woff",
      "woff2",
      "ttf",
      "eot",
    ].includes(ext || "")
  ) {
    return "Binary";
  }
  return "UTF-8";
}

interface StatusBarProps {
  branch?: string;
  errors?: number;
  warnings?: number;
  projectName?: string;
}

export function StatusBar({
  branch = "main",
  errors = 0,
  warnings = 0,
  projectName = "Flare-SH",
}: StatusBarProps) {
  const activeFilePath = useBuilderUIStore((s) => s.activeFilePath);
  const cursorPosition = useBuilderUIStore((s) => s.cursorPosition);
  const selectionCount = useBuilderUIStore((s) => s.selectionCount);
  const isSynced = useBuilderUIStore((s) => s.isSynced);
  const remoteConnected = useRemoteDevStore(
    (s) => s.connectionStatus === "connected",
  );

  const language = getLanguage(activeFilePath);
  const langIcon = getLanguageIcon(language);
  const encoding = detectEncoding(activeFilePath);

  // Go to Line dialog
  const [showGoToLine, setShowGoToLine] = useState(false);
  const [goToLineValue, setGoToLineValue] = useState("");
  const goToLineRef = useRef<HTMLInputElement>(null);

  // Line ending toggle
  const [lineEnding, setLineEnding] = useState<"LF" | "CRLF">("LF");
  const [showLineEndingMenu, setShowLineEndingMenu] = useState(false);
  const lineEndingRef = useRef<HTMLDivElement>(null);

  // Indentation settings
  const [indentType, setIndentType] = useState<"Spaces" | "Tabs">("Spaces");
  const [indentSize, setIndentSize] = useState(2);
  const [showIndentMenu, setShowIndentMenu] = useState(false);
  const indentRef = useRef<HTMLDivElement>(null);

  // Focus go to line input when opened
  useEffect(() => {
    if (showGoToLine && goToLineRef.current) {
      goToLineRef.current.focus();
    }
  }, [showGoToLine]);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        lineEndingRef.current &&
        !lineEndingRef.current.contains(e.target as Node)
      ) {
        setShowLineEndingMenu(false);
      }
      if (indentRef.current && !indentRef.current.contains(e.target as Node)) {
        setShowIndentMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGoToLine = () => {
    const lineNum = parseInt(goToLineValue, 10);
    if (!isNaN(lineNum) && lineNum > 0) {
      // Try to trigger go to line in the editor
      // We use a DOM approach to set cursor position
      const setCursorPosition = useBuilderUIStore.getState().setCursorPosition;
      setCursorPosition({ line: lineNum, col: 1 });

      // Try to scroll to the line in the code editor
      try {
        const cmEditor = document.querySelector(".cm-editor");
        if (cmEditor) {
          // Get the CodeMirror EditorView from the DOM
          const editorView = (cmEditor as any).cmView?.view;
          if (editorView) {
            const line = editorView.state.doc.line(
              Math.min(lineNum, editorView.state.doc.lines),
            );
            editorView.dispatch({
              selection: { anchor: line.from },
              scrollIntoView: true,
            });
          }
        }
      } catch {
        // Silently fail – at least cursor position in status bar is updated
      }
    }
    setShowGoToLine(false);
    setGoToLineValue("");
  };

  return (
    <>
      {/* Go to Line Dialog */}
      {showGoToLine && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20%]">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowGoToLine(false)}
          />
          <div className="relative w-[320px] bg-[#252526] border border-[#454545] rounded-md shadow-2xl overflow-hidden animate-in slide-in-from-top-2 duration-150">
            <div className="px-3 py-2 text-[11px] text-[#cccccc] border-b border-[#454545]">
              Go to Line
            </div>
            <div className="p-2">
              <input
                ref={goToLineRef}
                type="text"
                value={goToLineValue}
                onChange={(e) => setGoToLineValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGoToLine();
                  if (e.key === "Escape") {
                    setShowGoToLine(false);
                    setGoToLineValue("");
                  }
                }}
                placeholder={`Type a line number (1 - ∞)`}
                className="w-full h-7 px-2 text-xs bg-[#3c3c3c] border border-[#007acc] rounded text-[#cccccc] placeholder:text-[#858585] focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}

      <div className="h-[22px] flex items-center justify-between bg-[#007acc] dark:bg-[#1f1f1f] border-t border-[#006bb3] dark:border-[#2d2d2d] text-white dark:text-[#cccccc] text-[11px] select-none shrink-0 z-30">
        {/* Left Section */}
        <div className="flex items-center h-full">
          {/* Remote / SSH indicator */}
          <button
            className="flex items-center gap-1 px-2 h-full hover:bg-white/10 transition-colors"
            title={remoteConnected ? "SSH: Connected" : "Running in Browser"}
          >
            <Wifi
              className={`h-3 w-3 ${remoteConnected ? "text-green-400" : ""}`}
            />
            <span className="text-[10px]">
              {remoteConnected ? "SSH: AI" : "Web: AI"}
            </span>
          </button>

          {/* Branch */}
          <button
            className="flex items-center gap-1 px-2 h-full hover:bg-white/10 transition-colors"
            title={`Branch: ${branch}`}
          >
            <GitBranch className="h-3 w-3" />
            <span className="text-[10px]">{branch}</span>
          </button>

          {/* Sync Status */}
          <button
            className="flex items-center gap-1 px-2 h-full hover:bg-white/10 transition-colors"
            title={isSynced ? "Synced" : "Unsaved changes"}
          >
            {isSynced ? (
              <CheckCircle2 className="h-3 w-3 text-emerald-300" />
            ) : (
              <AlertTriangle className="h-3 w-3 text-amber-300" />
            )}
          </button>

          {/* Errors & Warnings */}
          <button
            className="flex items-center gap-1.5 px-2 h-full hover:bg-white/10 transition-colors"
            title={`${errors} errors, ${warnings} warnings`}
          >
            {errors > 0 && (
              <span className="flex items-center gap-0.5">
                <AlertTriangle className="h-3 w-3 text-red-300" />
                <span className="text-[10px]">{errors}</span>
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <Info className="h-3 w-3" />
              <span className="text-[10px]">{warnings}</span>
            </span>
          </button>
        </div>

        {/* Right Section */}
        <div className="flex items-center h-full">
          {/* Cursor position — clickable to open Go to Line */}
          <button
            className="flex items-center gap-1 px-2 h-full hover:bg-white/10 transition-colors"
            title="Go to Line (Click)"
            onClick={() => setShowGoToLine(true)}
          >
            <span className="text-[10px]">
              Ln {cursorPosition.line}, Col {cursorPosition.col}
            </span>
          </button>

          {/* Selection */}
          {selectionCount > 0 && (
            <button
              className="flex items-center px-2 h-full hover:bg-white/10 transition-colors text-[10px]"
              title="Selection"
            >
              ({selectionCount} selected)
            </button>
          )}

          {/* Spaces / Tabs — clickable with dropdown */}
          <div className="relative" ref={indentRef}>
            <button
              className="flex items-center px-2 h-full hover:bg-white/10 transition-colors text-[10px]"
              title="Select Indentation"
              onClick={() => setShowIndentMenu(!showIndentMenu)}
            >
              {indentType}: {indentSize}
            </button>
            {showIndentMenu && (
              <div className="absolute bottom-full right-0 mb-1 w-44 py-1 bg-[#252526] border border-[#454545] rounded-md shadow-xl z-50 animate-in slide-in-from-bottom-2 duration-150">
                <div className="px-3 py-1 text-[10px] text-[#858585] uppercase">
                  Indentation
                </div>
                <button
                  onClick={() => {
                    setIndentType("Spaces");
                    setShowIndentMenu(false);
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-[11px] hover:bg-[#094771] text-[#cccccc] transition-colors ${indentType === "Spaces" ? "bg-[#094771]/50" : ""}`}
                >
                  Indent Using Spaces
                </button>
                <button
                  onClick={() => {
                    setIndentType("Tabs");
                    setShowIndentMenu(false);
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-[11px] hover:bg-[#094771] text-[#cccccc] transition-colors ${indentType === "Tabs" ? "bg-[#094771]/50" : ""}`}
                >
                  Indent Using Tabs
                </button>
                <div className="border-t border-[#454545] my-1" />
                <div className="px-3 py-1 text-[10px] text-[#858585]">
                  Tab Size
                </div>
                {[2, 4, 8].map((size) => (
                  <button
                    key={size}
                    onClick={() => {
                      setIndentSize(size);
                      setShowIndentMenu(false);
                    }}
                    className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-[11px] hover:bg-[#094771] text-[#cccccc] transition-colors ${indentSize === size ? "bg-[#094771]/50" : ""}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Encoding — dynamic based on file type */}
          <button
            className="flex items-center px-2 h-full hover:bg-white/10 transition-colors text-[10px]"
            title="File Encoding"
          >
            {encoding}
          </button>

          {/* Line Ending — clickable with dropdown */}
          <div className="relative" ref={lineEndingRef}>
            <button
              className="flex items-center px-2 h-full hover:bg-white/10 transition-colors text-[10px]"
              title="Select End of Line Sequence"
              onClick={() => setShowLineEndingMenu(!showLineEndingMenu)}
            >
              {lineEnding}
            </button>
            {showLineEndingMenu && (
              <div className="absolute bottom-full right-0 mb-1 w-36 py-1 bg-[#252526] border border-[#454545] rounded-md shadow-xl z-50 animate-in slide-in-from-bottom-2 duration-150">
                <button
                  onClick={() => {
                    setLineEnding("LF");
                    setShowLineEndingMenu(false);
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-[11px] hover:bg-[#094771] text-[#cccccc] transition-colors ${lineEnding === "LF" ? "bg-[#094771]/50" : ""}`}
                >
                  LF (Unix)
                </button>
                <button
                  onClick={() => {
                    setLineEnding("CRLF");
                    setShowLineEndingMenu(false);
                  }}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-left text-[11px] hover:bg-[#094771] text-[#cccccc] transition-colors ${lineEnding === "CRLF" ? "bg-[#094771]/50" : ""}`}
                >
                  CRLF (Windows)
                </button>
              </div>
            )}
          </div>

          {/* Language */}
          <button
            className="flex items-center gap-1 px-2 h-full hover:bg-white/10 transition-colors"
            title={`Language: ${language}`}
          >
            <span className="text-[10px] font-mono opacity-70">{langIcon}</span>
            <span className="text-[10px]">{language}</span>
          </button>

          {/* Notifications */}
          <button
            className="flex items-center px-2 h-full hover:bg-white/10 transition-colors"
            title="Notifications"
          >
            <Bell className="h-3 w-3" />
          </button>

          {/* Project Name */}
          <div className="flex items-center gap-1 px-2 h-full text-[10px] opacity-70">
            <span>⬡</span>
            <span>{projectName}</span>
          </div>
        </div>
      </div>
    </>
  );
}
