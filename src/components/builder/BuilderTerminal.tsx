"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSandpack } from "@codesandbox/sandpack-react";
import { useProject } from "@/lib/builder/project-context";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TerminalLine {
  id: number;
  type: "input" | "output" | "error" | "info" | "success";
  content: string;
  timestamp: number;
}

interface BuilderTerminalProps {
  onClose?: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export function BuilderTerminal({
  onClose,
  isMaximized,
  onToggleMaximize,
}: BuilderTerminalProps) {
  const { sandpack } = useSandpack();
  const { state, actions } = useProject();
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 0,
      type: "info",
      content:
        "Flare Builder Terminal v1.0 — Type 'help' for available commands",
      timestamp: Date.now(),
    },
    {
      id: 1,
      type: "info",
      content: "Connected to Sandpack sandbox environment",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [cwd, setCwd] = useState("/");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineIdRef = useRef(2);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input on click
  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const addLine = useCallback((type: TerminalLine["type"], content: string) => {
    const id = lineIdRef.current++;
    setLines((prev) => [...prev, { id, type, content, timestamp: Date.now() }]);
  }, []);

  const addLines = useCallback(
    (entries: Array<{ type: TerminalLine["type"]; content: string }>) => {
      setLines((prev) => [
        ...prev,
        ...entries.map((e) => ({
          id: lineIdRef.current++,
          type: e.type,
          content: e.content,
          timestamp: Date.now(),
        })),
      ]);
    },
    [],
  );

  const resolvePath = useCallback(
    (target: string): string => {
      if (target.startsWith("/")) return target;
      if (target === "..") {
        const parts = cwd.split("/").filter(Boolean);
        parts.pop();
        return "/" + parts.join("/");
      }
      if (target === ".") return cwd;
      const base = cwd === "/" ? "" : cwd;
      return `${base}/${target}`;
    },
    [cwd],
  );

  const getFilesInDir = useCallback(
    (dir: string): { files: string[]; folders: Set<string> } => {
      const allFiles = {
        ...state.files,
        ...Object.fromEntries(
          Object.entries(sandpack.files).map(([p, f]) => [
            p,
            typeof f === "string" ? f : f.code,
          ]),
        ),
      };

      const normalizedDir = dir === "/" ? "" : dir;
      const files: string[] = [];
      const folders = new Set<string>();

      for (const path of Object.keys(allFiles)) {
        if (
          path.startsWith(normalizedDir + "/") ||
          (normalizedDir === "" && path.startsWith("/"))
        ) {
          const relative = path.slice(normalizedDir.length + 1);
          const parts = relative.split("/");
          if (parts.length === 1) {
            files.push(parts[0]);
          } else if (parts.length > 1) {
            folders.add(parts[0]);
          }
        }
      }

      return { files, folders };
    },
    [state.files, sandpack.files],
  );

  const executeCommand = useCallback(
    (cmd: string) => {
      const trimmed = cmd.trim();
      if (!trimmed) return;

      addLine("input", `$ ${trimmed}`);
      setCommandHistory((prev) => [...prev, trimmed]);
      setHistoryIndex(-1);

      const [command, ...args] = trimmed.split(/\s+/);

      switch (command.toLowerCase()) {
        case "help": {
          addLines([
            { type: "info", content: "Available commands:" },
            {
              type: "output",
              content: "  ls [dir]          List files and folders",
            },
            { type: "output", content: "  cd <dir>          Change directory" },
            {
              type: "output",
              content: "  cat <file>        Display file contents",
            },
            {
              type: "output",
              content: "  touch <file>      Create empty file",
            },
            { type: "output", content: "  mkdir <dir>       Create directory" },
            { type: "output", content: "  rm <file>         Remove file" },
            { type: "output", content: "  mv <src> <dest>   Move/rename file" },
            { type: "output", content: "  cp <src> <dest>   Copy file" },
            {
              type: "output",
              content: "  pwd               Print working directory",
            },
            {
              type: "output",
              content: "  find <pattern>    Search files by name",
            },
            {
              type: "output",
              content: "  grep <text> [f]   Search content in files",
            },
            {
              type: "output",
              content: "  wc <file>         Count lines in file",
            },
            { type: "output", content: "  echo <text>       Print text" },
            { type: "output", content: "  tree              Show file tree" },
            { type: "output", content: "  clear             Clear terminal" },
            {
              type: "output",
              content: "  status            Show project status",
            },
            { type: "output", content: "  build             Trigger rebuild" },
            { type: "output", content: "  npm run <script>  Show npm scripts" },
            {
              type: "output",
              content: "  history           Show command history",
            },
          ]);
          break;
        }

        case "clear": {
          setLines([]);
          break;
        }

        case "pwd": {
          addLine("output", cwd);
          break;
        }

        case "ls": {
          const target = args[0] ? resolvePath(args[0]) : cwd;
          const { files, folders } = getFilesInDir(target);

          if (files.length === 0 && folders.size === 0) {
            addLine("output", "(empty directory)");
          } else {
            const entries: Array<{
              type: TerminalLine["type"];
              content: string;
            }> = [];
            const sortedFolders = Array.from(folders).sort();
            const sortedFiles = files.sort();

            for (const f of sortedFolders) {
              entries.push({ type: "info", content: `📁 ${f}/` });
            }
            for (const f of sortedFiles) {
              entries.push({ type: "output", content: `   ${f}` });
            }
            addLines(entries);
          }
          break;
        }

        case "cd": {
          if (!args[0] || args[0] === "~" || args[0] === "/") {
            setCwd("/");
            addLine("output", "/");
          } else {
            const target = resolvePath(args[0]);
            // Check if directory exists (has files under it)
            const { files, folders } = getFilesInDir(target);
            if (files.length > 0 || folders.size > 0) {
              setCwd(target);
              addLine("output", target);
            } else {
              addLine("error", `cd: ${args[0]}: No such directory`);
            }
          }
          break;
        }

        case "cat": {
          if (!args[0]) {
            addLine("error", "cat: missing file operand");
            break;
          }
          const filePath = resolvePath(args[0]);
          const allFiles = {
            ...state.files,
            ...Object.fromEntries(
              Object.entries(sandpack.files).map(([p, f]) => [
                p,
                typeof f === "string" ? f : f.code,
              ]),
            ),
          };
          const content = allFiles[filePath];
          if (content !== undefined) {
            const fileLines = content.split("\n");
            addLines(
              fileLines.map((line) => ({
                type: "output" as const,
                content: line,
              })),
            );
          } else {
            addLine("error", `cat: ${args[0]}: No such file`);
          }
          break;
        }

        case "touch": {
          if (!args[0]) {
            addLine("error", "touch: missing file operand");
            break;
          }
          const newPath = resolvePath(args[0]);
          actions.updateFile(newPath, "");
          try {
            sandpack.addFile(newPath, "");
          } catch {}
          addLine("success", `Created ${newPath}`);
          break;
        }

        case "mkdir": {
          if (!args[0]) {
            addLine("error", "mkdir: missing directory operand");
            break;
          }
          const dirPath = resolvePath(args[0]);
          const gitkeep = `${dirPath}/.gitkeep`;
          actions.updateFile(gitkeep, "");
          try {
            sandpack.addFile(gitkeep, "");
          } catch {}
          addLine("success", `Created directory ${dirPath}`);
          break;
        }

        case "rm": {
          if (!args[0]) {
            addLine("error", "rm: missing file operand");
            break;
          }
          const rmPath = resolvePath(args[0]);
          if (state.files[rmPath] !== undefined) {
            actions.deleteFile(rmPath);
            try {
              sandpack.deleteFile(rmPath);
            } catch {}
            addLine("success", `Removed ${rmPath}`);
          } else {
            addLine("error", `rm: ${args[0]}: No such file`);
          }
          break;
        }

        case "mv": {
          if (args.length < 2) {
            addLine("error", "mv: missing destination operand");
            break;
          }
          const srcPath = resolvePath(args[0]);
          const destPath = resolvePath(args[1]);
          const srcContent = state.files[srcPath];
          if (srcContent !== undefined) {
            actions.updateFile(destPath, srcContent);
            actions.deleteFile(srcPath);
            try {
              sandpack.addFile(destPath, srcContent);
              sandpack.deleteFile(srcPath);
            } catch {}
            addLine("success", `Moved ${srcPath} → ${destPath}`);
          } else {
            addLine("error", `mv: ${args[0]}: No such file`);
          }
          break;
        }

        case "cp": {
          if (args.length < 2) {
            addLine("error", "cp: missing destination operand");
            break;
          }
          const copySrc = resolvePath(args[0]);
          const copyDest = resolvePath(args[1]);
          const copyContent = state.files[copySrc];
          if (copyContent !== undefined) {
            actions.updateFile(copyDest, copyContent);
            try {
              sandpack.addFile(copyDest, copyContent);
            } catch {}
            addLine("success", `Copied ${copySrc} → ${copyDest}`);
          } else {
            addLine("error", `cp: ${args[0]}: No such file`);
          }
          break;
        }

        case "find": {
          if (!args[0]) {
            addLine("error", "find: missing pattern");
            break;
          }
          const pattern = args[0].toLowerCase();
          const matches = Object.keys(state.files).filter((p) =>
            p.toLowerCase().includes(pattern),
          );
          if (matches.length === 0) {
            addLine("output", "No files found");
          } else {
            addLines(
              matches.map((m) => ({ type: "output" as const, content: m })),
            );
          }
          break;
        }

        case "grep": {
          if (!args[0]) {
            addLine("error", "grep: missing search text");
            break;
          }
          const searchText = args[0].toLowerCase();
          const targetFile = args[1] ? resolvePath(args[1]) : null;
          const filesToSearch = targetFile
            ? { [targetFile]: state.files[targetFile] || "" }
            : state.files;

          const results: Array<{
            type: TerminalLine["type"];
            content: string;
          }> = [];
          for (const [path, fileContent] of Object.entries(filesToSearch)) {
            if (!fileContent) continue;
            const fileLines = fileContent.split("\n");
            fileLines.forEach((line, i) => {
              if (line.toLowerCase().includes(searchText)) {
                results.push({
                  type: "output",
                  content: `${path}:${i + 1}: ${line.trimStart()}`,
                });
              }
            });
          }

          if (results.length === 0) {
            addLine("output", "No matches found");
          } else {
            addLine("info", `${results.length} match(es) found:`);
            addLines(results.slice(0, 50)); // Limit output
            if (results.length > 50) {
              addLine("info", `... and ${results.length - 50} more`);
            }
          }
          break;
        }

        case "wc": {
          if (!args[0]) {
            addLine("error", "wc: missing file operand");
            break;
          }
          const wcPath = resolvePath(args[0]);
          const wcContent = state.files[wcPath];
          if (wcContent !== undefined) {
            const lineCount = wcContent.split("\n").length;
            const wordCount = wcContent.split(/\s+/).filter(Boolean).length;
            const charCount = wcContent.length;
            addLine(
              "output",
              `  ${lineCount} lines  ${wordCount} words  ${charCount} chars  ${args[0]}`,
            );
          } else {
            addLine("error", `wc: ${args[0]}: No such file`);
          }
          break;
        }

        case "echo": {
          addLine("output", args.join(" "));
          break;
        }

        case "tree": {
          const treeLines: Array<{
            type: TerminalLine["type"];
            content: string;
          }> = [];
          const sortedPaths = Object.keys(state.files).sort();
          const printed = new Set<string>();

          for (const path of sortedPaths) {
            const parts = path.replace(/^\//, "").split("/");
            // build tree
            for (let i = 0; i < parts.length; i++) {
              const dirPath = parts.slice(0, i + 1).join("/");
              const indent = "  ".repeat(i);
              if (i < parts.length - 1) {
                if (!printed.has(dirPath)) {
                  printed.add(dirPath);
                  treeLines.push({
                    type: "info",
                    content: `${indent}📁 ${parts[i]}/`,
                  });
                }
              } else {
                treeLines.push({
                  type: "output",
                  content: `${indent}   ${parts[i]}`,
                });
              }
            }
          }

          if (treeLines.length === 0) {
            addLine("output", "(empty project)");
          } else {
            addLine("info", ".");
            addLines(treeLines);
            addLine(
              "info",
              `\n${Object.keys(state.files).length} file(s) total`,
            );
          }
          break;
        }

        case "status": {
          const fileCount = Object.keys(state.files).length;
          const totalSize = Object.values(state.files).reduce(
            (sum, content) => sum + content.length,
            0,
          );
          addLines([
            { type: "info", content: "── Project Status ──" },
            {
              type: "output",
              content: `  Template:  ${state.template || "unknown"}`,
            },
            { type: "output", content: `  Files:     ${fileCount}` },
            {
              type: "output",
              content: `  Size:      ${(totalSize / 1024).toFixed(1)} KB`,
            },
            {
              type: "output",
              content: `  Mode:      ${state.mode || "default"}`,
            },
            {
              type: "success",
              content: `  Status:    Connected to sandbox`,
            },
          ]);
          break;
        }

        case "build": {
          addLine("info", "Triggering rebuild...");
          try {
            sandpack.runSandpack();
            addLine("success", "Build triggered successfully");
          } catch (err) {
            addLine(
              "error",
              `Build failed: ${err instanceof Error ? err.message : "Unknown error"}`,
            );
          }
          break;
        }

        case "npm": {
          if (args[0] === "run") {
            const pkgContent = state.files["/package.json"];
            if (pkgContent) {
              try {
                const pkg = JSON.parse(pkgContent);
                const scripts = pkg.scripts || {};
                if (args[1]) {
                  if (scripts[args[1]]) {
                    addLine("info", `> ${args[1]}: ${scripts[args[1]]}`);
                    if (
                      args[1] === "dev" ||
                      args[1] === "start" ||
                      args[1] === "build"
                    ) {
                      sandpack.runSandpack();
                      addLine("success", "Sandbox restarted");
                    } else {
                      addLine(
                        "info",
                        "(Script shown — sandbox handles execution)",
                      );
                    }
                  } else {
                    addLine("error", `Missing script: "${args[1]}"`);
                    addLine(
                      "info",
                      `Available: ${Object.keys(scripts).join(", ")}`,
                    );
                  }
                } else {
                  addLine("info", "Available scripts:");
                  addLines(
                    Object.entries(scripts).map(([name, cmd]) => ({
                      type: "output" as const,
                      content: `  ${name}: ${cmd}`,
                    })),
                  );
                }
              } catch {
                addLine("error", "Failed to parse package.json");
              }
            } else {
              addLine("error", "No package.json found");
            }
          } else if (args[0] === "install" || args[0] === "i") {
            addLine(
              "info",
              "Dependencies are managed by the sandbox automatically.",
            );
            addLine("info", "Add dependencies to package.json and rebuild.");
          } else {
            addLine("error", `npm: unknown command '${args[0] || ""}'`);
          }
          break;
        }

        case "history": {
          if (commandHistory.length === 0) {
            addLine("output", "No command history");
          } else {
            addLines(
              commandHistory.map((cmd, i) => ({
                type: "output" as const,
                content: `  ${i + 1}  ${cmd}`,
              })),
            );
          }
          break;
        }

        default: {
          addLine(
            "error",
            `Command not found: ${command}. Type 'help' for available commands.`,
          );
        }
      }
    },
    [
      addLine,
      addLines,
      cwd,
      resolvePath,
      getFilesInDir,
      state.files,
      state.template,
      state.mode,
      sandpack,
      actions,
      commandHistory,
    ],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        executeCommand(input);
        setInput("");
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (commandHistory.length > 0) {
          const newIndex =
            historyIndex === -1
              ? commandHistory.length - 1
              : Math.max(0, historyIndex - 1);
          setHistoryIndex(newIndex);
          setInput(commandHistory[newIndex]);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex !== -1) {
          const newIndex = historyIndex + 1;
          if (newIndex >= commandHistory.length) {
            setHistoryIndex(-1);
            setInput("");
          } else {
            setHistoryIndex(newIndex);
            setInput(commandHistory[newIndex]);
          }
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        // Tab completion for file paths
        const currentInput = input.trim();
        const parts = currentInput.split(/\s+/);
        const lastPart = parts[parts.length - 1] || "";
        const dir = lastPart.includes("/")
          ? resolvePath(lastPart.substring(0, lastPart.lastIndexOf("/")))
          : cwd;
        const prefix = lastPart.includes("/")
          ? lastPart.substring(lastPart.lastIndexOf("/") + 1)
          : lastPart;

        const { files: dirFiles, folders } = getFilesInDir(dir);
        const allEntries = [
          ...Array.from(folders).map((f) => f + "/"),
          ...dirFiles,
        ];
        const matches = allEntries.filter((e) =>
          e.toLowerCase().startsWith(prefix.toLowerCase()),
        );

        if (matches.length === 1) {
          parts[parts.length - 1] = lastPart.includes("/")
            ? lastPart.substring(0, lastPart.lastIndexOf("/") + 1) + matches[0]
            : matches[0];
          setInput(parts.join(" "));
        } else if (matches.length > 1) {
          addLine("output", matches.join("  "));
        }
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        setLines([]);
      }
    },
    [
      input,
      executeCommand,
      commandHistory,
      historyIndex,
      resolvePath,
      cwd,
      getFilesInDir,
      addLine,
    ],
  );

  const getLineColor = (type: TerminalLine["type"]) => {
    switch (type) {
      case "input":
        return "text-blue-400";
      case "error":
        return "text-red-400";
      case "info":
        return "text-yellow-400";
      case "success":
        return "text-green-400";
      default:
        return "text-foreground/80";
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-[#1a1b26] text-[#a9b1d6] font-mono text-xs"
      onClick={handleContainerClick}
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-[#2a2b3d] bg-[#16161e] shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
          </div>
          <span className="text-[10px] text-[#565f89]">terminal — sandbox</span>
        </div>
        <div className="flex items-center gap-1">
          {onToggleMaximize && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onToggleMaximize}
              className="h-5 w-5 text-[#565f89] hover:text-[#a9b1d6] hover:bg-[#2a2b3d]"
            >
              {isMaximized ? (
                <Minimize2 className="h-3 w-3" />
              ) : (
                <Maximize2 className="h-3 w-3" />
              )}
            </Button>
          )}
          {onClose && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-5 w-5 text-[#565f89] hover:text-[#a9b1d6] hover:bg-[#2a2b3d]"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Terminal Output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-2 min-h-0"
        style={{ scrollBehavior: "smooth" }}
      >
        {lines.map((line) => (
          <div
            key={line.id}
            className={`${getLineColor(line.type)} whitespace-pre-wrap break-all leading-5`}
          >
            {line.content}
          </div>
        ))}
      </div>

      {/* Input Line */}
      <div className="flex items-center px-2 py-1.5 border-t border-[#2a2b3d] bg-[#16161e] shrink-0">
        <span className="text-green-400 mr-1">❯</span>
        <span className="text-[#565f89] mr-1 text-[10px]">
          {cwd === "/" ? "~" : cwd.split("/").pop()}
        </span>
        <span className="text-blue-400 mr-2">$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent outline-none text-[#a9b1d6] caret-[#7aa2f7] placeholder:text-[#2a2b3d]"
          placeholder="Type a command..."
          autoFocus
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    </div>
  );
}
