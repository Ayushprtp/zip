"use client";

import { memo, useCallback } from "react";
import { useStore } from "@nanostores/react";
import {
  Code2,
  Monitor,
  Terminal as TerminalIcon,
  GitBranch,
  X,
  Brain,
} from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { workbenchStore } from "@/lib/builder-beta/stores/workbench";
import { FileTree } from "./FileTree";
import { motion } from "framer-motion";

interface WorkbenchProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
}

export const Workbench = memo(
  ({ chatStarted, isStreaming }: WorkbenchProps) => {
    const showWorkbench = useStore(workbenchStore.showWorkbench);
    const currentView = useStore(workbenchStore.currentView);
    const activeFile = useStore(workbenchStore.selectedFile);
    const currentDocument = useStore(workbenchStore.currentDocument);
    const unsavedFiles = useStore(workbenchStore.unsavedFiles);
    const files = useStore(workbenchStore.files);
    const showTerminal = useStore(workbenchStore.showTerminal);

    const onFileSelect = useCallback(
      (value?: string) => workbenchStore.setSelectedFile(value),
      [],
    );

    return (
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: showWorkbench ? 0 : "100%" }}
        transition={{ type: "spring", damping: 20, stiffness: 100 }}
        className="fixed inset-y-0 right-0 w-[60%] z-50 bg-zinc-900 border-l border-zinc-700/50 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Toolbar */}
        <div className="flex items-center px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
          <div className="flex bg-zinc-950/80 rounded-full p-0.5 border border-zinc-700/50">
            <button
              onClick={() => workbenchStore.currentView.set("code")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                currentView === "code"
                  ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Code
            </button>
            <button
              onClick={() => workbenchStore.currentView.set("preview")}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                currentView === "preview"
                  ? "bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/40"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              Preview
            </button>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => workbenchStore.toggleTerminal()}
              className={`p-2 rounded-full transition-all ${
                showTerminal
                  ? "bg-violet-500/20 text-violet-400"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              title="Toggle Terminal"
            >
              <TerminalIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => workbenchStore.toggleGit()}
              className="p-2 rounded-full text-zinc-500 hover:text-zinc-300 transition-all"
              title="Toggle Git"
            >
              <GitBranch className="w-4 h-4" />
            </button>
            <button
              className="p-2 rounded-full text-zinc-500 hover:text-zinc-300 transition-all"
              title="Agent Panel"
            >
              <Brain className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-zinc-700 mx-1" />
            <button
              onClick={() => workbenchStore.showWorkbench.set(false)}
              className="p-2 rounded-full text-zinc-500 hover:text-white hover:bg-zinc-700/50 transition-all"
              title="Close Workbench"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {currentView === "code" ? (
            <PanelGroup direction="horizontal">
              {/* File Tree */}
              <Panel defaultSize={20} minSize={15} maxSize={40}>
                <div className="h-full border-r border-zinc-800 bg-zinc-950/50 overflow-hidden flex flex-col">
                  <div className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                    Explorer
                  </div>
                  <FileTree
                    files={files}
                    selectedFile={activeFile}
                    onFileSelect={(path) => onFileSelect(path)}
                    unsavedFiles={unsavedFiles}
                    className="flex-1"
                  />
                </div>
              </Panel>
              <PanelResizeHandle className="w-1 bg-zinc-800 hover:bg-violet-500/30 transition-colors" />
              {/* Editor Area */}
              <Panel defaultSize={80} minSize={40}>
                <div className="h-full flex flex-col bg-zinc-950">
                  {/* File Tab */}
                  {activeFile && (
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 text-xs">
                      <span className="text-zinc-400">
                        {activeFile.split("/").pop()}
                      </span>
                      {unsavedFiles?.has(activeFile) && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                    </div>
                  )}
                  {/* Editor Content */}
                  <div className="flex-1 overflow-auto p-4">
                    {currentDocument ? (
                      <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
                        {currentDocument.value}
                      </pre>
                    ) : (
                      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                        Select a file to view
                      </div>
                    )}
                  </div>
                  {/* Terminal Area */}
                  {showTerminal && (
                    <div className="border-t border-zinc-800 h-48 bg-zinc-950 p-3">
                      <div className="text-xs text-zinc-500 mb-2 flex items-center gap-2">
                        <TerminalIcon className="w-3 h-3" />
                        Terminal
                      </div>
                      <div className="text-xs text-zinc-600 font-mono">
                        $ {isStreaming ? "running..." : "ready"}
                      </div>
                    </div>
                  )}
                </div>
              </Panel>
            </PanelGroup>
          ) : (
            /* Preview */
            <div className="flex-1 flex items-center justify-center bg-zinc-950 text-zinc-600">
              <div className="text-center">
                <Monitor className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
                <p className="text-sm">Preview will appear here</p>
                <p className="text-xs text-zinc-700 mt-1">
                  Start a dev server to see live preview
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  },
);

Workbench.displayName = "Workbench";
