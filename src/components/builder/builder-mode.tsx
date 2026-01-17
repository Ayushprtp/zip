/**
 * BuilderMode Layout - Two-pane split layout
 * Displays Monaco editor (with file tree) on left and preview iframe on right
 */

"use client";

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { MonacoEditor } from "./monaco-editor";
import { FileTree } from "./file-tree";
import { TabBar } from "./tab-bar";
import { SandpackWrapper } from "./sandpack-wrapper";
import { useProject } from "@/lib/builder/project-context";

// ============================================================================
// BuilderMode Component
// ============================================================================

interface BuilderModeProps {
  className?: string;
}

/**
 * BuilderMode displays a two-pane layout with editor (files/code) and preview
 * Both panels utilize all available space without being shrunk
 */
export function BuilderMode({ className }: BuilderModeProps) {
  const { state, actions } = useProject();

  // Get active file content
  const activeFileContent = state.activeFile
    ? state.files[state.activeFile] || ""
    : "";

  // Handle file content change
  const handleContentChange = (value: string) => {
    if (state.activeFile) {
      actions.updateFile(state.activeFile, value);
    }
  };

  return (
    <div className={`flex h-full w-full ${className || ""}`}>
      {/* Main Content Area - Full width and height */}
      <div className="flex-1 h-full">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel - File Tree + Monaco Editor */}
          <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
            <div className="h-full w-full flex flex-col overflow-hidden border-r">
              {/* File Tree and Editor Container */}
              <div className="flex h-full">
                {/* File Tree Sidebar */}
                <div className="w-64 border-r overflow-y-auto bg-background">
                  <FileTree />
                </div>

                {/* Editor Area */}
                <div className="flex-1 flex flex-col">
                  {/* Tab Bar */}
                  <TabBar />

                  {/* Monaco Editor */}
                  <div className="flex-1 overflow-hidden">
                    {state.activeFile ? (
                      <MonacoEditor
                        path={state.activeFile}
                        value={activeFileContent}
                        onChange={handleContentChange}
                        theme="vs-dark"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <p>Select a file to edit</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Right Panel - Preview Iframe */}
          <ResizablePanel defaultSize={50} minSize={30} maxSize={70}>
            <div className="h-full w-full overflow-hidden">
              <SandpackWrapper template={state.template} files={state.files} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
