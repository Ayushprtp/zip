import { useStore } from '@nanostores/react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle } from 'react-resizable-panels';
import {
  CodeMirrorEditor,
  type EditorDocument,
  type EditorSettings,
  type OnChangeCallback as OnEditorChange,
  type OnSaveCallback as OnEditorSave,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { IconButton } from '~/components/ui/IconButton';
import { PanelHeader } from '~/components/ui/PanelHeader';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import { shortcutEventEmitter } from '~/lib/hooks';
import type { FileMap } from '~/lib/stores/files';
import { themeStore } from '~/lib/stores/theme';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { WORK_DIR } from '~/utils/constants';
import { renderLogger } from '~/utils/logger';
import { isMobile } from '~/utils/mobile';
import { FileBreadcrumb } from './FileBreadcrumb';
import { FileTree } from './FileTree';
import { Terminal, type TerminalRef } from './terminal/Terminal';

interface EditorPanelProps {
  files?: FileMap;
  unsavedFiles?: Set<string>;
  editorDocument?: EditorDocument;
  selectedFile?: string | undefined;
  isStreaming?: boolean;
  onEditorChange?: OnEditorChange;
  onEditorScroll?: OnEditorScroll;
  onFileSelect?: (value?: string) => void;
  onFileSave?: OnEditorSave;
  onFileReset?: () => void;
}

const MAX_TERMINALS = 3;
const DEFAULT_TERMINAL_SIZE = 25;
const DEFAULT_EDITOR_SIZE = 100 - DEFAULT_TERMINAL_SIZE;

const editorSettings: EditorSettings = { tabSize: 2 };

export const EditorPanel = memo(
  ({
    files,
    unsavedFiles,
    editorDocument,
    selectedFile,
    isStreaming,
    onFileSelect,
    onEditorChange,
    onEditorScroll,
    onFileSave,
    onFileReset,
  }: EditorPanelProps) => {
    renderLogger.trace('EditorPanel');

    const theme = useStore(themeStore);
    const showTerminal = useStore(workbenchStore.showTerminal);
    const showGit = useStore(workbenchStore.showGit);

    const terminalRefs = useRef<Array<TerminalRef | null>>([]);
    const terminalPanelRef = useRef<ImperativePanelHandle>(null);
    const terminalToggledByShortcut = useRef(false);

    const [activeTerminal, setActiveTerminal] = useState(0);

    // The Store is the source of truth for terminals
    const terminals = useStore(workbenchStore.terminalStore.terminals);
    const terminalCount = terminals.length;

    const activeFileSegments = useMemo(() => {
      if (!editorDocument) {
        return undefined;
      }

      return editorDocument.filePath.split('/');
    }, [editorDocument]);

    const activeFileUnsaved = useMemo(() => {
      return editorDocument !== undefined && unsavedFiles?.has(editorDocument.filePath);
    }, [editorDocument, unsavedFiles]);

    useEffect(() => {
      const unsubscribeFromEventEmitter = shortcutEventEmitter.on('toggleTerminal', () => {
        terminalToggledByShortcut.current = true;
      });

      const unsubscribeFromThemeStore = themeStore.subscribe(() => {
        for (const ref of Object.values(terminalRefs.current)) {
          ref?.reloadStyles();
        }
      });

      return () => {
        unsubscribeFromEventEmitter();
        unsubscribeFromThemeStore();
      };
    }, []);

    useEffect(() => {
      const { current: terminalPanel } = terminalPanelRef;

      if (!terminalPanel) {
        return;
      }

      const isExpanded = terminalPanel.isExpanded();

      if (showTerminal && !isExpanded) {
        terminalPanel.expand(DEFAULT_TERMINAL_SIZE);
      } else if (!showTerminal && isExpanded) {
        terminalPanel.collapse();
      }
    }, [showTerminal]);

    const addTerminal = () => {
      if (terminalCount >= MAX_TERMINALS) {
        return;
      }

      workbenchStore.terminalStore.addTerminal('e2b');
    };

    const [syncing, setSyncing] = useState(false);

    const handleSync = async () => {
      setSyncing(true);

      try {
        await workbenchStore.filesStore.sync();
      } finally {
        setTimeout(() => setSyncing(false), 1000);
      }
    };

    return (
      <PanelGroup direction="vertical">
        <Panel defaultSize={DEFAULT_EDITOR_SIZE} minSize={20}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={20} minSize={10} collapsible>
              <div className="flex flex-col h-full border-r border-flare-elements-borderColor bg-flare-elements-background-depth-1">
                <PanelHeader className="flex items-center justify-between px-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase tracking-widest">
                    <div className="i-ph:files-bold" />
                    Files
                  </div>
                  <IconButton
                    icon={syncing ? 'i-ph:arrows-clockwise-bold animate-spin' : 'i-ph:arrows-clockwise-bold'}
                    size="sm"
                    title="Sync with sandbox"
                    onClick={handleSync}
                    className={classNames('transition-all', { 'text-purple-400': syncing })}
                  />
                </PanelHeader>
                <FileTree
                  className="h-full"
                  files={files}
                  rootFolder={WORK_DIR}
                  hideRoot={true}
                  collapsed={true}
                  selectedFile={selectedFile}
                  onFileSelect={onFileSelect}
                  unsavedFiles={unsavedFiles}
                />
              </div>
            </Panel>
            <PanelResizeHandle className="w-1 bg- flare-elements-borderColor hover:bg-white/10 transition-colors" />
            <Panel defaultSize={80} minSize={20}>
              <div className="flex flex-col h-full overflow-hidden">
                <PanelHeader className="flex items-center justify-between">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <IconButton icon="i-ph:caret-left-bold" size="sm" onClick={() => onFileSelect?.(undefined)} />
                    <FileBreadcrumb pathSegments={activeFileSegments} />
                    <IconButton
                      icon="i-ph:git-branch-bold"
                      title="Source Control"
                      size="sm"
                      onClick={() => workbenchStore.toggleGit()}
                      className={classNames('ml-1', {
                        'text-purple-400 bg-purple-400/10': showGit,
                        'text-white/40 hover:text-white': !showGit,
                      })}
                    />
                  </div>
                  {activeFileUnsaved && (
                    <div className="flex gap-2">
                      <IconButton icon="i-ph:trash-bold" title="Reset changes" onClick={onFileReset} />
                      <IconButton icon="i-ph:floppy-disk-bold" title="Save changes" onClick={onFileSave} />
                    </div>
                  )}
                </PanelHeader>
                <div className="flex-1 overflow-hidden">
                  {editorDocument ? (
                    <CodeMirrorEditor
                      theme={theme}
                      editable={!isStreaming}
                      isStreaming={isStreaming}
                      settings={editorSettings}
                      doc={editorDocument}
                      autoFocusOnDocumentChange={true}
                      onScroll={onEditorScroll}
                      onChange={onEditorChange}
                      onSave={onFileSave}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-flare-elements-textTertiary bg-flare-elements-background-depth-1">
                      <div className="i-ph:file-dashed-duotone text-6xl mb-4 opacity-20" />
                      <p className="text-sm font-medium">Select a file to start coding</p>
                    </div>
                  )}
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle className="h-1 bg-flare-elements-borderColor hover:bg-white/10 transition-colors" />
        <Panel
          ref={terminalPanelRef}
          defaultSize={showTerminal ? DEFAULT_TERMINAL_SIZE : 0}
          minSize={10}
          collapsible
          onExpand={() => {
            if (!terminalToggledByShortcut.current) {
              workbenchStore.toggleTerminal(true);
            }
          }}
          onCollapse={() => {
            if (!terminalToggledByShortcut.current) {
              workbenchStore.toggleTerminal(false);
            }
          }}
        >
          <div className="h-full flex flex-col bg-flare-elements-background-depth-1 border-t border-flare-elements-borderColor overflow-hidden">
            <PanelHeader className="flex items-center justify-between px-4 py-2 border-b border-flare-elements-borderColor">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
                {terminals.map((instance, index) => {
                  const isActive = activeTerminal === index;
                  return (
                    <button
                      key={index}
                      className={classNames(
                        'flex items-center text-xs cursor-pointer gap-1.5 px-4 py-2 h-full whitespace-nowrap rounded-full transition-all duration-300 border',
                        {
                          'bg-purple-600/10 text-purple-400 border-purple-500/30 shadow-[0_0_10px_rgba(168,85,247,0.1)]':
                            isActive,
                          'text-zinc-500 hover:text-zinc-300 border-white/5 !bg-transparent': !isActive,
                        },
                      )}
                      onClick={() => setActiveTerminal(index)}
                    >
                      <div
                        className={classNames(
                          'text-lg transition-transform i-ph:terminal-window-fill text-purple-400',
                          { 'scale-110': isActive },
                        )}
                      />
                      {`Terminal ${terminalCount > 1 ? index + 1 : ''}`}
                      {terminalCount > 1 && (
                        <div
                          className="ml-1 opacity-40 hover:opacity-100 hover:bg-white/10 rounded p-0.5 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            workbenchStore.terminalStore.removeTerminal(index);

                            if (isActive) {
                              setActiveTerminal(Math.max(0, index - 1));
                            } else if (index < activeTerminal) {
                              setActiveTerminal(activeTerminal - 1);
                            }
                          }}
                        >
                          <div className="i-ph:x-bold text-[10px]" />
                        </div>
                      )}
                    </button>
                  );
                })}
                {terminalCount < MAX_TERMINALS && (
                  <div className="flex gap-1 items-center ml-2 border-l border-white/5 pl-2">
                    <IconButton
                      icon="i-ph:plus"
                      title="Add Terminal"
                      size="md"
                      className="text-purple-400 hover:bg-purple-400/10"
                      onClick={() => workbenchStore.terminalStore.addTerminal('e2b')}
                    />
                  </div>
                )}
              </div>
              <IconButton icon="i-ph:caret-down-bold" size="sm" onClick={() => workbenchStore.toggleTerminal(false)} />
            </PanelHeader>
            <div className="flex-1 bg-black overflow-hidden relative">
              {terminals.map((instance, index) => (
                <Terminal
                  key={index}
                  className={classNames('h-full w-full', { hidden: activeTerminal !== index })}
                  theme={theme}
                  onTerminalReady={(xterm) => {
                    const iterm = {
                      write: (data: string | Uint8Array) => xterm.write(data),
                      onData: (cb: (data: string) => void) => xterm.onData(cb),
                      reset: () => xterm.reset(),
                      cols: xterm.cols,
                      rows: xterm.rows,
                    };

                    workbenchStore.terminalStore.setTerminalReady(index, iterm);
                  }}
                  onTerminalResize={(cols, rows) => {
                    workbenchStore.terminalStore.onTerminalResize(cols, rows);
                  }}
                />
              ))}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    );
  },
);
