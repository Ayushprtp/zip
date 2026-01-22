"use client";

import {
  SandpackProvider,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackConsole,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { useState, useEffect, useRef } from "react";
import {
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BuilderErrorBoundary } from "./BuilderErrorBoundary";
import { getAssetGenerator } from "@/lib/builder/asset-generator";
import { VSCodeFileExplorer } from "./VSCodeFileExplorer";
import { createSandpackTheme } from "@/lib/builder/sandpack-theme";
import { useTheme } from "next-themes";
import { useProject } from "@/lib/builder/project-context";
import { useBuilderUIStore } from "@/stores/builder-ui-store";
import type { RuntimeError } from "@/types/builder";

type Template = "react" | "nextjs" | "vite-react" | "vanilla" | "static";

type ViewMode = "code" | "preview" | "split";

interface SandpackWrapperProps {
  files: Record<string, string>;
  template: Template;
  onAssetGenerated?: (path: string, content: string) => void;
  viewMode?: ViewMode;
  showConsole?: boolean;
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
    "/index.html": `<!DOCTYPE html>
<html><body><h1>Hello Static</h1></body></html>`,
  },
};

// Component to register server controls with the store
function ServerControlRegistrar() {
  const { sandpack } = useSandpack();
  const setServerControl = useBuilderUIStore((state) => state.setServerControl);
  const setServerStatus = useBuilderUIStore((state) => state.setServerStatus);

  useEffect(() => {
    const control = {
      start: () => {
        setServerStatus("booting");
        sandpack.runSandpack();
        setTimeout(() => {
          setServerStatus("running");
        }, 1000);
      },
      stop: () => {
        sandpack.resetAllFiles();
        setServerStatus("idle");
      },
      restart: () => {
        setServerStatus("booting");
        sandpack.runSandpack();
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
  }, [sandpack, setServerControl, setServerStatus]);

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

  // Sync ProjectContext → Sandpack (for hot reload when AI or external changes occur)
  useEffect(() => {
    if (isSyncingToSandpackRef.current) return;

    let hasChanges = false;
    Object.entries(state.files).forEach(([path, content]) => {
      const sandpackFile = files[path];
      const previousContent = previousContextFilesRef.current[path];

      // Update Sandpack if content changed in context and differs from Sandpack
      if (
        content !== previousContent &&
        sandpackFile &&
        sandpackFile.code !== content
      ) {
        isSyncingToSandpackRef.current = true;
        hasChanges = true;
        updateFile(path, content);
      }
    });

    // Update reference
    previousContextFilesRef.current = { ...state.files };

    if (hasChanges) {
      setTimeout(() => {
        isSyncingToSandpackRef.current = false;
      }, 150);
    }
  }, [state.files, files, updateFile]);

  // Sync Sandpack → ProjectContext (when user edits in Sandpack editor)
  useEffect(() => {
    if (isSyncingToContextRef.current) return;

    let hasChanges = false;
    Object.entries(files).forEach(([path, file]) => {
      if (file.code !== undefined) {
        const previousContent = previousSandpackFilesRef.current[path];
        const currentContextContent = state.files[path];

        // Only update if content changed in Sandpack and differs from context
        if (
          file.code !== previousContent &&
          file.code !== currentContextContent
        ) {
          isSyncingToContextRef.current = true;
          hasChanges = true;
          actions.updateFile(path, file.code);
        }
      }
    });

    // Update reference
    previousSandpackFilesRef.current = Object.fromEntries(
      Object.entries(files).map(([path, file]) => [path, file.code || ""]),
    );

    if (hasChanges) {
      setTimeout(() => {
        isSyncingToContextRef.current = false;
      }, 150);
    }
  }, [files, actions, state.files]);

  return null;
}

// Internal component to handle asset generation with Sandpack context
function AssetGenerationHandler({
  onAssetGenerated,
}: { onAssetGenerated?: (path: string, content: string) => void }) {
  const { listen } = useSandpack();
  const listenerUnsubscribeRef = useRef<(() => void) | null>(null);

  // Get asset generator instance
  const assetGenerator = getAssetGenerator({
    onAssetGenerated: (result) => {
      console.log("Asset generated:", result.path);
      onAssetGenerated?.(result.path, result.content);
    },
  });

  useEffect(() => {
    // Clean up previous listener
    if (listenerUnsubscribeRef.current) {
      listenerUnsubscribeRef.current();
    }

    // Set up new listener for errors
    const unsubscribe = listen((message: any) => {
      // Handle errors - Sandpack uses 'action' type with 'show-error' action
      if (message.type === "action" && message.action === "show-error") {
        const error: RuntimeError = {
          type: "fatal",
          message: message.title || "Unknown error",
          stack: message.message,
          file: message.path,
          line: message.line,
          column: message.column,
        };

        // Check if this is a missing asset error and generate placeholder
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
  }, [listen, assetGenerator, onAssetGenerated]);

  return null; // This component doesn't render anything
}

export function SandpackWrapper({
  files,
  template,
  onAssetGenerated,
  viewMode: externalViewMode,
  showConsole: externalShowConsole,
}: SandpackWrapperProps) {
  // Use external props if provided, otherwise use local state
  const [localViewMode, _setLocalViewMode] = useState<ViewMode>("split");
  const [localShowConsole, _setLocalShowConsole] = useState(false);
  
  const viewMode = externalViewMode !== undefined ? externalViewMode : localViewMode;
  const showConsole = externalShowConsole !== undefined ? externalShowConsole : localShowConsole;
  
  const [showFileExplorer, setShowFileExplorer] = useState(true);
  const { theme, systemTheme } = useTheme();
  const mergedFiles = { ...DEFAULT_FILES[template], ...files };

  const currentTheme = theme === "system" ? systemTheme : theme;
  const isDark = currentTheme === "dark";
  const sandpackTheme = createSandpackTheme(isDark);

  return (
    <SandpackProvider
      template={template === "vite-react" ? "vite-react" : template}
      theme={sandpackTheme}
      files={mergedFiles}
      options={{
        externalResources: ["https://cdn.tailwindcss.com"],
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

      <div className="absolute inset-0 flex flex-col bg-background">
        {/* Main Workspace - No separate header, controlled by BuilderHeader */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          <BuilderErrorBoundary onError={() => {
            // On error, toggle console via store
            const toggleConsole = useBuilderUIStore.getState().toggleConsole;
            toggleConsole();
          }}>
            {/* File Explorer Sidebar - Collapsible */}
            {showFileExplorer &&
              (viewMode === "code" || viewMode === "split") && (
                <div className="w-40 lg:w-48 xl:w-56 border-r flex flex-col bg-muted/20 shrink-0">
                  <div className="flex items-center justify-between px-2 py-1 border-b bg-muted/50 shrink-0">
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      Files
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowFileExplorer(false)}
                      className="h-4 w-4"
                    >
                      <ChevronLeft className="h-2.5 w-2.5" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-auto min-h-0">
                    <VSCodeFileExplorer />
                  </div>
                </div>
              )}

            {/* Toggle File Explorer Button (when collapsed) */}
            {!showFileExplorer &&
              (viewMode === "code" || viewMode === "split") && (
                <div className="border-r shrink-0">
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

            {/* Editor and Preview Area - Takes all remaining space */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
              <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Code Editor - Responsive width */}
                {(viewMode === "code" || viewMode === "split") && (
                  <div
                    className={`${viewMode === "split" ? "w-1/2 border-r" : "w-full"} flex flex-col overflow-hidden min-w-0 relative`}
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
                )}

                {/* Preview - Responsive width */}
                {(viewMode === "preview" || viewMode === "split") && (
                  <div
                    className={`${viewMode === "split" ? "w-1/2" : "w-full"} flex flex-col overflow-hidden min-w-0 relative`}
                  >
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
                )}
              </div>

              {/* Console - Collapsible bottom panel */}
              {showConsole && (
                <div className="h-28 md:h-32 lg:h-40 border-t shrink-0">
                  <SandpackConsole style={{ height: "100%", width: "100%" }} />
                </div>
              )}
            </div>
          </BuilderErrorBoundary>
        </div>
      </div>
    </SandpackProvider>
  );
}