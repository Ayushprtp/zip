"use client";

import { getAssetGenerator } from "@/lib/builder/asset-generator";
import { useProject } from "@/lib/builder/project-context";
import { createSandpackTheme } from "@/lib/builder/sandpack-theme";
import { useBuilderUIStore } from "@/stores/builder-ui-store";
import { useRemoteDevStore } from "@/stores/remote-dev-store";
import type { RuntimeError } from "@/types/builder";
import {
  SandpackCodeEditor,
  SandpackConsole,
  SandpackPreview,
  SandpackProvider,
  useSandpack,
} from "@codesandbox/sandpack-react";

import {
  ChevronLeft,
  ChevronRight,
  Files,
  GitBranch,
  Search,
  Settings,
  Smartphone,
  Monitor,
  Maximize2,
  Minimize2,
  RotateCcw,
  Keyboard,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { BuilderErrorBoundary } from "./BuilderErrorBoundary";
import { BuilderReportPanel } from "./BuilderReportPanel";
import { BuilderTerminal } from "./BuilderTerminal";
import { CodeSearchPanel } from "./CodeSearchPanel";
import { RemoteFileBrowser } from "./RemoteFileBrowser";
import { RemoteStatusBar } from "./RemoteStatusBar";
import { RemoteTerminal } from "./RemoteTerminal";
import { SourceControlPanel } from "./SourceControlPanel";
import { StatusBar } from "./StatusBar";
import { VSCodeFileExplorer } from "./VSCodeFileExplorer";
import { TabBar } from "./tab-bar";
import { KeyBindings } from "./KeyBindings";
import { ShortcutsPanel } from "./ShortcutsPanel";

type Template = "react" | "nextjs" | "vite-react" | "vanilla" | "static";

function SandpackActiveFileSync() {
  const { sandpack } = useSandpack();
  const setActiveFilePath = useBuilderUIStore((s) => s.setActiveFilePath);

  useEffect(() => {
    setActiveFilePath(sandpack.activeFile);
  }, [sandpack.activeFile, setActiveFilePath]);

  return null;
}

type ViewMode = "code" | "preview" | "split";

interface SandpackWrapperProps {
  files: Record<string, string>;
  template: Template;
  onAssetGenerated?: (path: string, content: string) => void;
  viewMode?: ViewMode;
  showConsole?: boolean;
  showTerminal?: boolean;
  showReport?: boolean;
  showSSH?: boolean;
  bottomPanel?: "none" | "console" | "terminal" | "report" | "ssh";
  bottomPanelMaximized?: boolean;
  onToggleBottomPanelMaximized?: () => void;
  repoOwner?: string;
  repoName?: string;
  branch?: string;
  onCommitAndPush?: (
    message: string,
    files?: Array<{ path: string; content: string }>,
  ) => Promise<void>;
}

const DEFAULT_FILES: Record<Template, Record<string, string>> = {
  react: {
    ".env":
      "# Environment Variables\n# REACT_APP_API_URL=https://api.example.com\nKEY=VALUE",
    "/App.js": `export default function App() {
  return <h1 className="text-2xl font-bold p-4">Hello React</h1>;
}`,
  },
  nextjs: {
    ".env":
      "# Environment Variables\n# NEXT_PUBLIC_API_URL=https://api.example.com\nKEY=VALUE",
    "/app/page.tsx": `export default function Home() {
  return <h1 className="text-2xl font-bold p-4">Hello Next.js (App Router)</h1>;
}`,
    "/app/layout.tsx": `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`,
  },
  "vite-react": {
    ".env":
      "# Environment Variables\n# VITE_API_URL=https://api.example.com\nKEY=VALUE",
    "/App.jsx": `export default function App() {
  return <h1 className="text-2xl font-bold p-4">Hello Vite + React</h1>;
}`,
  },
  vanilla: {
    ".env": "# Environment Variables\nKEY=VALUE",
    "/index.js": `document.getElementById("app").innerHTML = "<h1>Hello Vanilla</h1>";`,
  },
  static: {
    ".env": "# Environment Variables\nKEY=VALUE",
    "index.html": `<!DOCTYPE html>
<html><body><h1>Hello Static</h1></body></html>`,
  },
};

// Component to register server controls with the store
function ServerControlRegistrar() {
  const { sandpack } = useSandpack();
  const setServerControl = useBuilderUIStore((state) => state.setServerControl);
  const setServerStatus = useBuilderUIStore((state) => state.setServerStatus);

  // Use a ref for sandpack so the effect doesn't re-run on every render
  // (useSandpack() returns a new object reference each render)
  const sandpackRef = useRef(sandpack);
  sandpackRef.current = sandpack;

  // Register server controls only once on mount
  useEffect(() => {
    const control = {
      start: () => {
        setServerStatus("booting");
        sandpackRef.current.runSandpack();
        setTimeout(() => {
          setServerStatus("running");
        }, 1000);
      },
      stop: () => {
        // Just update status — don't destroy user files
        setServerStatus("idle");
      },
      restart: () => {
        setServerStatus("booting");
        sandpackRef.current.runSandpack();
        setTimeout(() => {
          setServerStatus("running");
        }, 1000);
      },
    };

    setServerControl(control);
    setServerStatus("running");

    return () => {
      setServerControl(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount/unmount - sandpack accessed via ref

  return null;
}

// Internal component to handle file changes and sync with ProjectContext
function FileChangeListener() {
  const { sandpack } = useSandpack();
  const { files, updateFile } = sandpack;
  const { state, actions } = useProject();
  const previousSandpackFilesRef = useRef<Record<string, string>>({});
  const previousContextFilesRef = useRef<Record<string, string>>({});
  const isSyncingToSandpackRef = useRef(false);
  const isSyncingToContextRef = useRef(false);

  // Keep refs to the latest sandpack values (they're new refs every render)
  const filesRef = useRef(files);
  filesRef.current = files;
  const updateFileRef = useRef(updateFile);
  updateFileRef.current = updateFile;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const stateFilesRef = useRef(state.files);
  stateFilesRef.current = state.files;

  // Sync ProjectContext → Sandpack (for hot reload when AI or external changes occur)
  const contextFilesKey = Object.entries(state.files)
    .map(([p, c]) => {
      let h = 0;
      for (let i = 0; i < c.length; i++) {
        h = ((h << 5) - h + c.charCodeAt(i)) | 0;
      }
      return `${p}:${h}`;
    })
    .join("|");

  useEffect(() => {
    if (isSyncingToSandpackRef.current) return;

    const currentFiles = filesRef.current;
    const currentUpdateFile = updateFileRef.current;
    const currentStateFiles = stateFilesRef.current;

    let hasChanges = false;
    Object.entries(currentStateFiles).forEach(([path, content]) => {
      const sandpackFile = currentFiles[path];
      const previousContent = previousContextFilesRef.current[path];

      if (
        content !== previousContent &&
        sandpackFile &&
        sandpackFile.code !== content
      ) {
        isSyncingToSandpackRef.current = true;
        hasChanges = true;
        currentUpdateFile(path, content);
      }
    });

    previousContextFilesRef.current = { ...currentStateFiles };

    if (hasChanges) {
      setTimeout(() => {
        isSyncingToSandpackRef.current = false;
      }, 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextFilesKey]);

  // Sync Sandpack → ProjectContext (when user edits in Sandpack editor)
  const sandpackFilesKey = Object.entries(files)
    .map(([p, f]) => `${p}:${f.code?.length ?? 0}`)
    .join("|");

  useEffect(() => {
    if (isSyncingToContextRef.current) return;

    const currentFiles = filesRef.current;
    const currentStateFiles = stateFilesRef.current;
    const currentActions = actionsRef.current;

    let hasChanges = false;
    Object.entries(currentFiles).forEach(([path, file]) => {
      if (file.code !== undefined) {
        const previousContent = previousSandpackFilesRef.current[path];
        const currentContextContent = currentStateFiles[path];

        if (
          file.code !== previousContent &&
          file.code !== currentContextContent
        ) {
          isSyncingToContextRef.current = true;
          hasChanges = true;
          currentActions.updateFile(path, file.code);
        }
      }
    });

    previousSandpackFilesRef.current = Object.fromEntries(
      Object.entries(currentFiles).map(([path, file]) => [
        path,
        file.code || "",
      ]),
    );

    if (hasChanges) {
      setTimeout(() => {
        isSyncingToContextRef.current = false;
      }, 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sandpackFilesKey]);

  return null;
}

// Internal component to handle asset generation with Sandpack context
function AssetGenerationHandler({
  onAssetGenerated,
}: { onAssetGenerated?: (path: string, content: string) => void }) {
  const { listen } = useSandpack();
  const listenerUnsubscribeRef = useRef<(() => void) | null>(null);
  const onAssetGeneratedRef = useRef(onAssetGenerated);
  onAssetGeneratedRef.current = onAssetGenerated;

  // Use ref for listen since useSandpack() returns new refs every render
  const listenRef = useRef(listen);
  listenRef.current = listen;

  useEffect(() => {
    // Get asset generator instance
    const assetGenerator = getAssetGenerator({
      onAssetGenerated: (result) => {
        console.log("Asset generated:", result.path);
        onAssetGeneratedRef.current?.(result.path, result.content);
      },
    });

    // Set up listener for errors
    const unsubscribe = listenRef.current((message: any) => {
      if (message.type === "action" && message.action === "show-error") {
        const error: RuntimeError = {
          type: "fatal",
          message: message.title || "Unknown error",
          stack: message.message,
          file: message.path,
          line: message.line,
          column: message.column,
        };

        assetGenerator.processError(error).catch((err) => {
          console.error("Failed to generate asset:", err);
        });
      }
    });

    listenerUnsubscribeRef.current = unsubscribe;

    return () => {
      if (listenerUnsubscribeRef.current) {
        listenerUnsubscribeRef.current();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - sandpack accessed via refs

  return null; // This component doesn't render anything
}

// ─── Settings Panel ──────────────────────────────────────────────────────
function SettingsPanel({ onClose }: { onClose: () => void }) {
  const settings = useBuilderUIStore((s) => s.editorSettings);
  const setSettings = useBuilderUIStore((s) => s.setEditorSettings);

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
          Settings
        </span>
        <button
          onClick={onClose}
          className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-4">
        {/* Auto Save */}
        <div>
          <label className="text-[11px] font-medium text-foreground block mb-1.5">
            Auto Save Delay
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={500}
              max={5000}
              step={500}
              value={settings.autoSaveDelay}
              onChange={(e) =>
                setSettings({ autoSaveDelay: parseInt(e.target.value) })
              }
              className="flex-1 h-1 accent-orange-500"
            />
            <span className="text-[10px] text-muted-foreground w-12 text-right">
              {settings.autoSaveDelay}ms
            </span>
          </div>
          <p className="text-[9px] text-muted-foreground/60 mt-1">
            Delay before auto-saving files after editing
          </p>
        </div>

        {/* Font Size */}
        <div>
          <label className="text-[11px] font-medium text-foreground block mb-1.5">
            Editor Font Size
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={10}
              max={24}
              step={1}
              value={settings.fontSize}
              onChange={(e) =>
                setSettings({ fontSize: parseInt(e.target.value) })
              }
              className="flex-1 h-1 accent-orange-500"
            />
            <span className="text-[10px] text-muted-foreground w-8 text-right">
              {settings.fontSize}px
            </span>
          </div>
        </div>

        {/* Word Wrap */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-[11px] font-medium text-foreground block">
              Word Wrap
            </label>
            <p className="text-[9px] text-muted-foreground/60">
              Wrap long lines in the editor
            </p>
          </div>
          <button
            onClick={() => setSettings({ wordWrap: !settings.wordWrap })}
            className={`w-8 h-4 rounded-full transition-colors relative ${
              settings.wordWrap ? "bg-orange-500" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                settings.wordWrap ? "left-4" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {/* Minimap */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-[11px] font-medium text-foreground block">
              Minimap
            </label>
            <p className="text-[9px] text-muted-foreground/60">
              Show minimap on the right side
            </p>
          </div>
          <button
            onClick={() => setSettings({ minimap: !settings.minimap })}
            className={`w-8 h-4 rounded-full transition-colors relative ${
              settings.minimap ? "bg-orange-500" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                settings.minimap ? "left-4" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-border/20 pt-3">
          <h3 className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">
            IDE Settings
          </h3>
        </div>

        {/* Tab Size */}
        <div>
          <label className="text-[11px] font-medium text-foreground block mb-1.5">
            Tab Size
          </label>
          <div className="flex gap-1">
            {[2, 4, 8].map((size) => (
              <button
                key={size}
                className="px-3 py-1 text-[10px] rounded bg-muted/50 hover:bg-muted transition-colors border border-border/30"
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div>
          <label className="text-[11px] font-medium text-foreground block mb-1.5">
            Editor Theme
          </label>
          <p className="text-[9px] text-muted-foreground/60">
            Theme follows system preference
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Preview Toolbar ──────────────────────────────────────────────────────
function PreviewToolbar({
  onRefresh,
  onToggleMobile,
  onToggleFullscreen,
  isMobile,
  isFullscreen,
  previewRef,
}: {
  onRefresh: () => void;
  onToggleMobile: () => void;
  onToggleFullscreen: () => void;
  isMobile: boolean;
  isFullscreen: boolean;
  previewRef: React.RefObject<any>;
}) {
  const [url, setUrl] = useState("/");

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      const client = previewRef.current?.getClient();
      if (client && client.iframe) {
        // Try to update iframe location directly to force navigation
        client.iframe.src = url;
      }
    }
  };

  return (
    <div className="flex items-center gap-0.5 px-1 h-8 border-b bg-muted/30 shrink-0">
      {/* Navigation buttons */}
      <button
        className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/60 text-muted-foreground transition-colors"
        title="Back"
        onClick={() => {
          // Basic history management if possible?
          // Sandpack client doesn't expose simple history back.
          // Leaving as placeholder for now or omit click handler
        }}
      >
        <ChevronLeft className="h-3 w-3" />
      </button>
      <button
        className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/60 text-muted-foreground transition-colors"
        title="Forward"
      >
        <ChevronRight className="h-3 w-3" />
      </button>
      <button
        className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted/60 text-muted-foreground transition-colors"
        title="Refresh"
        onClick={onRefresh}
      >
        <RotateCcw className="h-3 w-3" />
      </button>

      <div className="flex-1 mx-1 flex items-center bg-muted/50 border border-border/30 rounded-md px-2 focus-within:ring-1 focus-within:ring-violet-500/50 transition-all">
        <span className="text-[10px] text-muted-foreground mr-0.5 select-none font-mono">
          /
        </span>
        <input
          type="text"
          value={url.startsWith("/") ? url.slice(1) : url}
          onChange={(e) => {
            const val = e.target.value;
            // Always keep relative path structure
            // We strip the leading slash from display, so adding it back
            setUrl("/" + val);
          }}
          onKeyDown={handleKeyDown}
          className="h-6 bg-transparent text-[10px] text-muted-foreground font-mono w-full focus:outline-none placeholder:text-muted-foreground/50"
          placeholder=""
        />
      </div>

      {/* Mobile View */}
      <button
        className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
          isMobile
            ? "bg-violet-500/20 text-violet-400"
            : "hover:bg-muted/60 text-muted-foreground"
        }`}
        title={isMobile ? "Desktop View" : "Mobile View"}
        onClick={onToggleMobile}
      >
        {isMobile ? (
          <Monitor className="h-3 w-3" />
        ) : (
          <Smartphone className="h-3 w-3" />
        )}
      </button>

      {/* Fullscreen */}
      <button
        className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
          isFullscreen
            ? "bg-violet-500/20 text-violet-400"
            : "hover:bg-muted/60 text-muted-foreground"
        }`}
        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
        onClick={onToggleFullscreen}
      >
        {isFullscreen ? (
          <Minimize2 className="h-3 w-3" />
        ) : (
          <Maximize2 className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}

export function SandpackWrapper({
  files,
  template,
  onAssetGenerated,
  viewMode: externalViewMode,
  showConsole: _externalShowConsole,
  showTerminal: _externalShowTerminal,
  showReport: _externalShowReport,
  showSSH: _externalShowSSH,
  bottomPanel: externalBottomPanel,
  bottomPanelMaximized,
  onToggleBottomPanelMaximized,
  repoOwner,
  repoName,
  branch = "main",
  onCommitAndPush,
}: SandpackWrapperProps) {
  // Use external props if provided, otherwise use local state
  const [localViewMode, _setLocalViewMode] = useState<ViewMode>("split");

  const viewMode =
    externalViewMode !== undefined ? externalViewMode : localViewMode;

  const bottomPanel = externalBottomPanel || "none";

  const hasBottomPanel = bottomPanel !== "none";

  const [showFileExplorer, setShowFileExplorer] = useState(true);
  const [showRemoteFiles, setShowRemoteFiles] = useState(false);
  const { theme, systemTheme } = useTheme();
  const mergedFiles = { ...DEFAULT_FILES[template], ...files };
  const remoteConnected = useRemoteDevStore(
    (s) => s.connectionStatus === "connected",
  );

  const setCursorPosition = useBuilderUIStore((s) => s.setCursorPosition);
  const setSelectionCount = useBuilderUIStore((s) => s.setSelectionCount);
  const editorSettings = useBuilderUIStore((s) => s.editorSettings);

  // Preview controls
  const [previewMobile, setPreviewMobile] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const previewRef = useRef<any>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  const handlePreviewRefresh = useCallback(() => {
    // Force refresh the Sandpack preview by re-running
    const sandpackPreview = document.querySelector(
      'iframe[title="Sandpack Preview"]',
    );
    if (sandpackPreview) {
      (sandpackPreview as HTMLIFrameElement).src = (
        sandpackPreview as HTMLIFrameElement
      ).src;
    }
  }, []);

  const handleTogglePreviewFullscreen = useCallback(() => {
    if (!previewFullscreen) {
      previewRef.current?.requestFullscreen?.();
    } else {
      if (typeof document !== "undefined" && document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    }
    setPreviewFullscreen(!previewFullscreen);
  }, [previewFullscreen]);

  // DOM-based cursor tracking workaround to avoid EditorView crash
  const handleCursorUpdate = useCallback(() => {
    // Delay slightly to let DOM update
    requestAnimationFrame(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      // Try to find active line number from gutter (CM6 uses .cm-activeLineGutter)
      const activeGutter = document.querySelector(".cm-activeLineGutter");
      if (activeGutter && activeGutter.textContent) {
        const line = parseInt(activeGutter.textContent, 10);
        let col = 1;

        // Try to calculate column relative to active line
        const activeLine = document.querySelector(".cm-activeLine");
        if (activeLine && activeLine.contains(selection.anchorNode)) {
          try {
            const range = selection.getRangeAt(0);
            const preRange = document.createRange();
            preRange.selectNodeContents(activeLine);
            preRange.setEnd(range.startContainer, range.startOffset);
            col = preRange.toString().length + 1;
          } catch (_e) {
            // Fallback if range manipulation fails
          }
        }

        setCursorPosition({ line, col });

        // Selection count
        const text = selection.toString();
        setSelectionCount(text.length);
      }
    });
  }, [setCursorPosition, setSelectionCount]);

  const sidebarPanel = useBuilderUIStore((s) => s.sidebarPanel);
  const setSidebarPanel = useBuilderUIStore((s) => s.setSidebarPanel);

  const currentTheme = theme === "system" ? systemTheme : theme;
  const isDark = currentTheme === "dark";
  const sandpackTheme = createSandpackTheme(isDark);

  return (
    <SandpackProvider
      template={template === "vite-react" ? "vite-react" : template}
      theme={sandpackTheme}
      files={mergedFiles}
      options={{
        externalResources: ["https://cdn.tailwindcss.com/3.4.17"],
        recompileMode: "delayed",
        recompileDelay: 500,
      }}
    >
      {/* Server Control Registrar - Connects header buttons to Sandpack */}
      <ServerControlRegistrar />

      {/* Asset Generation Handler */}
      <AssetGenerationHandler onAssetGenerated={onAssetGenerated} />

      {/* File Change Listener - Syncs to ProjectContext */}
      <FileChangeListener />
      <SandpackActiveFileSync />

      <div className="absolute inset-0 flex flex-col bg-background">
        <KeyBindings />
        {/* Main Workspace */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          <BuilderErrorBoundary
            onError={() => {
              const toggleConsole = useBuilderUIStore.getState().toggleConsole;
              toggleConsole();
            }}
          >
            <PanelGroup direction="horizontal">
              {/* Sidebar + Main Area */}
              {/* File Explorer / Source Control / Search / Settings Panel */}
              {true && (
                <>
                  {/* Activity Bar — VS Code icon strip */}
                  <div className="w-[36px] shrink-0 flex flex-col items-center pt-1 gap-0.5 bg-muted/30 border-r border-border/20">
                    <button
                      onClick={() => {
                        if (sidebarPanel === "files" && showFileExplorer) {
                          setShowFileExplorer(false);
                        } else {
                          setSidebarPanel("files");
                          setShowFileExplorer(true);
                        }
                      }}
                      className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors relative ${
                        sidebarPanel === "files" && showFileExplorer
                          ? "text-foreground"
                          : "text-muted-foreground/50 hover:text-muted-foreground"
                      }`}
                      title="Explorer"
                    >
                      {sidebarPanel === "files" && showFileExplorer && (
                        <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-foreground rounded-r" />
                      )}
                      <Files className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (sidebarPanel === "search" && showFileExplorer) {
                          setShowFileExplorer(false);
                        } else {
                          setSidebarPanel("search");
                          setShowFileExplorer(true);
                        }
                      }}
                      className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors relative ${
                        sidebarPanel === "search" && showFileExplorer
                          ? "text-foreground"
                          : "text-muted-foreground/50 hover:text-muted-foreground"
                      }`}
                      title="Search"
                    >
                      {sidebarPanel === "search" && showFileExplorer && (
                        <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-foreground rounded-r" />
                      )}
                      <Search className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (
                          sidebarPanel === "source-control" &&
                          showFileExplorer
                        ) {
                          setShowFileExplorer(false);
                        } else {
                          setSidebarPanel("source-control");
                          setShowFileExplorer(true);
                        }
                      }}
                      className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors relative ${
                        sidebarPanel === "source-control" && showFileExplorer
                          ? "text-foreground"
                          : "text-muted-foreground/50 hover:text-muted-foreground"
                      }`}
                      title="Source Control"
                    >
                      {sidebarPanel === "source-control" &&
                        showFileExplorer && (
                          <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-foreground rounded-r" />
                        )}
                      <GitBranch className="h-4 w-4" />
                    </button>

                    {/* Spacer to push settings to bottom */}
                    <div className="flex-1" />

                    {/* Shortcuts Toggle */}
                    <button
                      onClick={() => {
                        if (sidebarPanel === "shortcuts" && showFileExplorer) {
                          setShowFileExplorer(false);
                        } else {
                          setSidebarPanel("shortcuts");
                          setShowFileExplorer(true);
                        }
                      }}
                      className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors relative mb-1 ${
                        sidebarPanel === "shortcuts" && showFileExplorer
                          ? "text-foreground"
                          : "text-muted-foreground/50 hover:text-muted-foreground"
                      }`}
                      title="Keyboard Shortcuts"
                    >
                      {sidebarPanel === "shortcuts" && showFileExplorer && (
                        <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-foreground rounded-r" />
                      )}
                      <Keyboard className="h-4 w-4" />
                    </button>

                    {/* Settings — at the bottom of activity bar */}
                    <button
                      onClick={() => {
                        if (sidebarPanel === "settings" && showFileExplorer) {
                          setShowFileExplorer(false);
                        } else {
                          setSidebarPanel("settings");
                          setShowFileExplorer(true);
                        }
                      }}
                      className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors relative mb-1 ${
                        sidebarPanel === "settings" && showFileExplorer
                          ? "text-foreground"
                          : "text-muted-foreground/50 hover:text-muted-foreground"
                      }`}
                      title="Settings"
                    >
                      {sidebarPanel === "settings" && showFileExplorer && (
                        <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-foreground rounded-r" />
                      )}
                      <Settings className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Collapsible Panel Content */}
                  {showFileExplorer && (
                    <>
                      <Panel defaultSize={15} minSize={8} maxSize={30}>
                        <div className="h-full flex flex-col bg-muted/20">
                          {/* Panel Header */}
                          <div className="flex items-center justify-between px-2 py-1 border-b bg-muted/50 shrink-0">
                            {sidebarPanel === "files" ? (
                              <>
                                {remoteConnected ? (
                                  <div className="flex gap-0.5">
                                    <button
                                      className={`px-1.5 py-0.5 text-[10px] rounded ${!showRemoteFiles ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
                                      onClick={() => setShowRemoteFiles(false)}
                                    >
                                      Local
                                    </button>
                                    <button
                                      className={`px-1.5 py-0.5 text-[10px] rounded ${showRemoteFiles ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
                                      onClick={() => setShowRemoteFiles(true)}
                                    >
                                      Remote
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                                    Explorer
                                  </span>
                                )}
                              </>
                            ) : sidebarPanel === "search" ? (
                              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                                Search
                              </span>
                            ) : sidebarPanel === "source-control" ? (
                              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                                Source Control
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                                Settings
                              </span>
                            )}
                          </div>
                          {/* Panel Content */}
                          <div className="flex-1 overflow-auto min-h-0">
                            {sidebarPanel === "files" && (
                              <>
                                {showRemoteFiles && remoteConnected ? (
                                  <RemoteFileBrowser />
                                ) : (
                                  <VSCodeFileExplorer />
                                )}
                              </>
                            )}
                            {sidebarPanel === "search" && (
                              <CodeSearchPanel files={files} />
                            )}
                            {sidebarPanel === "source-control" && (
                              <SourceControlPanel
                                files={files}
                                repoOwner={repoOwner}
                                repoName={repoName}
                                branch={branch}
                                onCommitAndPush={onCommitAndPush}
                              />
                            )}
                            {sidebarPanel === "settings" && (
                              <SettingsPanel
                                onClose={() => setShowFileExplorer(false)}
                              />
                            )}
                            {sidebarPanel === "shortcuts" && (
                              <ShortcutsPanel
                                onClose={() => setShowFileExplorer(false)}
                              />
                            )}
                          </div>
                        </div>
                      </Panel>
                      <PanelResizeHandle className="w-[3px] hover:w-[5px] cursor-col-resize transition-all group flex items-center justify-center">
                        <div className="w-[1px] h-8 rounded-full bg-border/40 group-hover:bg-violet-400/60 group-active:bg-violet-400 transition-colors" />
                      </PanelResizeHandle>
                    </>
                  )}
                </>
              )}

              {/* Layout Divider - Before Editor Area */}
              {(viewMode === "code" || viewMode === "split") && (
                <PanelResizeHandle className="w-[3px] hover:w-[5px] cursor-col-resize transition-all group flex items-center justify-center">
                  <div className="w-[1px] h-8 rounded-full bg-border/40 group-hover:bg-violet-400/60 group-active:bg-violet-400 transition-colors" />
                </PanelResizeHandle>
              )}

              <Panel minSize={30}>
                <PanelGroup direction="vertical">
                  {/* Top section: Editor + Preview */}
                  <Panel defaultSize={hasBottomPanel ? 70 : 100} minSize={20}>
                    <PanelGroup direction="horizontal">
                      {/* Code Editor Panel */}
                      {(viewMode === "code" || viewMode === "split") && (
                        <Panel
                          defaultSize={viewMode === "split" ? 50 : 100}
                          minSize={20}
                        >
                          <div className="flex flex-col h-full w-full">
                            <TabBar />
                            <div
                              className="flex-1 relative min-h-0"
                              ref={editorWrapperRef}
                              onMouseUpCapture={handleCursorUpdate}
                              onKeyUpCapture={handleCursorUpdate}
                              onClickCapture={handleCursorUpdate}
                            >
                              <SandpackCodeEditor
                                showTabs={false}
                                closableTabs={false}
                                showLineNumbers
                                wrapContent={editorSettings.wordWrap}
                                style={{
                                  width: "100%",
                                  height: "100%",
                                  fontSize: editorSettings.fontSize,
                                }}
                              />
                            </div>
                          </div>
                        </Panel>
                      )}

                      {/* Resize handle between editor and preview */}
                      {viewMode === "split" && (
                        <PanelResizeHandle className="w-[3px] hover:w-[5px] cursor-col-resize transition-all group flex items-center justify-center">
                          <div className="w-[1px] h-8 rounded-full bg-border/40 group-hover:bg-violet-400/60 group-active:bg-violet-400 transition-colors" />
                        </PanelResizeHandle>
                      )}

                      {/* Preview Panel */}
                      {(viewMode === "preview" || viewMode === "split") && (
                        <Panel
                          defaultSize={viewMode === "split" ? 50 : 100}
                          minSize={20}
                        >
                          <div className="h-full w-full relative flex flex-col">
                            {/* Preview Toolbar */}
                            <PreviewToolbar
                              onRefresh={handlePreviewRefresh}
                              onToggleMobile={() =>
                                setPreviewMobile(!previewMobile)
                              }
                              onToggleFullscreen={handleTogglePreviewFullscreen}
                              isMobile={previewMobile}
                              isFullscreen={previewFullscreen}
                              previewRef={previewRef}
                            />
                            {/* Preview Content */}
                            <div
                              className={`flex-1 relative ${previewMobile ? "flex items-center justify-center" : ""}`}
                            >
                              {previewMobile ? (
                                <div className="w-[375px] h-full border-x border-border/30 overflow-hidden">
                                  <SandpackPreview
                                    ref={previewRef}
                                    showNavigator={false}
                                    showRefreshButton={false}
                                    style={{
                                      height: "100%",
                                      width: "100%",
                                    }}
                                  />
                                </div>
                              ) : (
                                <SandpackPreview
                                  ref={previewRef}
                                  showNavigator={false}
                                  showRefreshButton={false}
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    height: "100%",
                                    width: "100%",
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </Panel>
                      )}
                    </PanelGroup>
                  </Panel>

                  {/* Remote Status Bar */}
                  {remoteConnected && <RemoteStatusBar />}

                  {/* Bottom Panel — Console / Terminal / Report / Remote (resizable) */}
                  {hasBottomPanel && (
                    <>
                      <PanelResizeHandle className="h-[3px] hover:h-[5px] cursor-row-resize transition-all group flex items-center justify-center">
                        <div className="h-[1px] w-8 rounded-full bg-border/40 group-hover:bg-violet-400/60 group-active:bg-violet-400 transition-colors" />
                      </PanelResizeHandle>
                      <Panel
                        defaultSize={30}
                        minSize={10}
                        maxSize={bottomPanelMaximized ? 90 : 60}
                      >
                        <div className="h-full flex flex-col">
                          {/* Bottom Panel Tabs */}
                          <div className="flex items-center gap-0.5 px-1 py-0.5 bg-muted/30 border-b shrink-0">
                            <button
                              className={`px-2 py-0.5 text-[10px] rounded ${bottomPanel === "console" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
                              onClick={() =>
                                useBuilderUIStore
                                  .getState()
                                  .setBottomPanel("console")
                              }
                            >
                              Console
                            </button>
                            <button
                              className={`px-2 py-0.5 text-[10px] rounded ${bottomPanel === "terminal" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
                              onClick={() =>
                                useBuilderUIStore
                                  .getState()
                                  .setBottomPanel("terminal")
                              }
                            >
                              Terminal
                            </button>
                            <button
                              className={`px-2 py-0.5 text-[10px] rounded ${bottomPanel === "report" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
                              onClick={() =>
                                useBuilderUIStore
                                  .getState()
                                  .setBottomPanel("report")
                              }
                            >
                              Report
                            </button>
                            <button
                              className={`px-2 py-0.5 text-[10px] rounded flex items-center gap-1 ${bottomPanel === "ssh" ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground"}`}
                              onClick={() =>
                                useBuilderUIStore
                                  .getState()
                                  .setBottomPanel("ssh")
                              }
                            >
                              Remote
                              {remoteConnected && (
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                              )}
                            </button>
                          </div>
                          <div className="flex-1 min-h-0 overflow-hidden">
                            {bottomPanel === "console" && (
                              <SandpackConsole
                                style={{ height: "100%", width: "100%" }}
                              />
                            )}
                            {bottomPanel === "terminal" && (
                              <BuilderTerminal
                                onClose={() =>
                                  useBuilderUIStore
                                    .getState()
                                    .setBottomPanel("none")
                                }
                                isMaximized={bottomPanelMaximized}
                                onToggleMaximize={onToggleBottomPanelMaximized}
                              />
                            )}
                            {bottomPanel === "report" && (
                              <BuilderReportPanel
                                onClose={() =>
                                  useBuilderUIStore
                                    .getState()
                                    .setBottomPanel("none")
                                }
                              />
                            )}
                            {bottomPanel === "ssh" && (
                              <RemoteTerminal
                                onClose={() =>
                                  useBuilderUIStore
                                    .getState()
                                    .setBottomPanel("none")
                                }
                                isMaximized={bottomPanelMaximized}
                                onToggleMaximize={onToggleBottomPanelMaximized}
                              />
                            )}
                          </div>
                        </div>
                      </Panel>
                    </>
                  )}
                </PanelGroup>
              </Panel>
            </PanelGroup>
          </BuilderErrorBoundary>
        </div>

        {/* Status Bar */}
        <StatusBar branch={branch} projectName={repoName || "Flare-SH"} />
      </div>
    </SandpackProvider>
  );
}
