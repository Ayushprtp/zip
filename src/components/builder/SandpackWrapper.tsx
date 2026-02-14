"use client";

import {
  SandpackProvider,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackConsole,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  ChevronRight,
  ChevronLeft,
  Files,
  Search,
  GitBranch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuilderErrorBoundary } from "./BuilderErrorBoundary";
import { getAssetGenerator } from "@/lib/builder/asset-generator";
import { VSCodeFileExplorer } from "./VSCodeFileExplorer";
import { SourceControlPanel } from "./SourceControlPanel";
import { CodeSearchPanel } from "./CodeSearchPanel";
import { StatusBar } from "./StatusBar";
import { BuilderTerminal } from "./BuilderTerminal";
import { BuilderReportPanel } from "./BuilderReportPanel";
import { RemoteTerminal } from "./RemoteTerminal";
import { RemoteFileBrowser } from "./RemoteFileBrowser";
import { RemoteStatusBar } from "./RemoteStatusBar";
import { createSandpackTheme } from "@/lib/builder/sandpack-theme";
import { useTheme } from "next-themes";
import { useProject } from "@/lib/builder/project-context";
import { useBuilderUIStore } from "@/stores/builder-ui-store";
import { useRemoteDevStore } from "@/stores/remote-dev-store";
import type { RuntimeError } from "@/types/builder";

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
    "/App.js": `export default function App() {
  return <h1 className="text-2xl font-bold p-4">Hello React</h1>;
}`,
  },
  nextjs: {
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
    "/App.jsx": `export default function App() {
  return <h1 className="text-2xl font-bold p-4">Hello Vite + React</h1>;
}`,
  },
  vanilla: {
    "/index.js": `document.getElementById("app").innerHTML = "<h1>Hello Vanilla</h1>";`,
  },
  static: {
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
  // Use a stringified key of context file paths+content lengths to detect real changes
  // Use a simple hash of each file's content for change detection
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

  // DOM-based cursor tracking workaround to avoid EditorView crash
  const handleCursorUpdate = useCallback(() => {
    // Delay slightly to let DOM update
    requestAnimationFrame(() => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      // Try to find active line number from gutter (CM6 uses .cm-activeLineGutter)
      // We look within the document or scoped if possible, but document is easiest
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
        {/* Main Workspace */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          <BuilderErrorBoundary
            onError={() => {
              const toggleConsole = useBuilderUIStore.getState().toggleConsole;
              toggleConsole();
            }}
          >
            <PanelGroup direction="vertical">
              {/* Top section: file explorer + editor + preview */}
              <Panel defaultSize={hasBottomPanel ? 70 : 100} minSize={30}>
                <PanelGroup direction="horizontal">
                  {/* File Explorer / Source Control / Search Panel */}
                  {showFileExplorer &&
                    (viewMode === "code" || viewMode === "split") && (
                      <>
                        {/* Activity Bar — VS Code icon strip */}
                        <div className="w-[36px] shrink-0 flex flex-col items-center pt-1 gap-0.5 bg-muted/30 border-r border-border/20">
                          <button
                            onClick={() => setSidebarPanel("files")}
                            className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors relative ${
                              sidebarPanel === "files"
                                ? "text-foreground"
                                : "text-muted-foreground/50 hover:text-muted-foreground"
                            }`}
                            title="Explorer"
                          >
                            {sidebarPanel === "files" && (
                              <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-foreground rounded-r" />
                            )}
                            <Files className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setSidebarPanel("search")}
                            className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors relative ${
                              sidebarPanel === "search"
                                ? "text-foreground"
                                : "text-muted-foreground/50 hover:text-muted-foreground"
                            }`}
                            title="Search"
                          >
                            {sidebarPanel === "search" && (
                              <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-foreground rounded-r" />
                            )}
                            <Search className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setSidebarPanel("source-control")}
                            className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors relative ${
                              sidebarPanel === "source-control"
                                ? "text-foreground"
                                : "text-muted-foreground/50 hover:text-muted-foreground"
                            }`}
                            title="Source Control"
                          >
                            {sidebarPanel === "source-control" && (
                              <div className="absolute left-0 top-1 bottom-1 w-[2px] bg-foreground rounded-r" />
                            )}
                            <GitBranch className="h-4 w-4" />
                          </button>
                        </div>
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
                                        onClick={() =>
                                          setShowRemoteFiles(false)
                                        }
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
                              ) : (
                                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                                  Source Control
                                </span>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setShowFileExplorer(false)}
                                className="h-4 w-4"
                              >
                                <ChevronLeft className="h-2.5 w-2.5" />
                              </Button>
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
                            </div>
                          </div>
                        </Panel>
                        <PanelResizeHandle className="w-[3px] hover:w-[5px] cursor-col-resize transition-all group flex items-center justify-center">
                          <div className="w-[1px] h-8 rounded-full bg-border/40 group-hover:bg-violet-400/60 group-active:bg-violet-400 transition-colors" />
                        </PanelResizeHandle>
                      </>
                    )}

                  {/* Toggle File Explorer Button (when collapsed) */}
                  {!showFileExplorer &&
                    (viewMode === "code" || viewMode === "split") && (
                      <div className="border-r shrink-0 flex">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setShowFileExplorer(true)}
                          className="h-7 w-7 m-0.5"
                          title="Show File Explorer"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}

                  {/* Code Editor Panel */}
                  {(viewMode === "code" || viewMode === "split") && (
                    <Panel
                      defaultSize={viewMode === "split" ? 50 : 100}
                      minSize={20}
                    >
                      <div
                        className="h-full w-full relative"
                        onMouseUp={handleCursorUpdate}
                        onKeyUp={handleCursorUpdate}
                        onClick={handleCursorUpdate}
                      >
                        <SandpackCodeEditor
                          showTabs
                          closableTabs
                          showLineNumbers
                          wrapContent
                          style={{
                            position: "absolute",
                            inset: 0,
                            height: "100%",
                            width: "100%",
                          }}
                        />
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
                      <div className="h-full w-full relative">
                        <SandpackPreview
                          showNavigator
                          showRefreshButton
                          style={{
                            position: "absolute",
                            inset: 0,
                            height: "100%",
                            width: "100%",
                          }}
                        />
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
                            useBuilderUIStore.getState().setBottomPanel("ssh")
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
          </BuilderErrorBoundary>
        </div>

        {/* Status Bar */}
        <StatusBar branch={branch} projectName={repoName || "Flare-SH"} />
      </div>
    </SandpackProvider>
  );
}
