"use client";

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

  return (
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
        {/* Cursor position */}
        <button
          className="flex items-center gap-1 px-2 h-full hover:bg-white/10 transition-colors"
          title="Go to Line"
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

        {/* Spaces / Indent */}
        <button
          className="flex items-center px-2 h-full hover:bg-white/10 transition-colors text-[10px]"
          title="Indentation"
        >
          Spaces: 2
        </button>

        {/* Encoding */}
        <button
          className="flex items-center px-2 h-full hover:bg-white/10 transition-colors text-[10px]"
          title="File Encoding"
        >
          UTF-8
        </button>

        {/* Line Ending */}
        <button
          className="flex items-center px-2 h-full hover:bg-white/10 transition-colors text-[10px]"
          title="Line Endings"
        >
          LF
        </button>

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
  );
}
