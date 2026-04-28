import { useStore } from '@nanostores/react';
import { motion } from 'framer-motion';
import { memo, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { EditorPanel } from './EditorPanel';
import { Preview } from './Preview';
import { GitPanel } from './GitPanel';
import { AgentPanel } from '~/components/agentic/AgentPanel';
import '~/components/agentic/AgentPanel.css';


interface WorkbenchProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
}

export const Workbench = memo(({ chatStarted, isStreaming }: WorkbenchProps) => {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const currentView = useStore(workbenchStore.currentView);
  const showGit = useStore(workbenchStore.showGit);
  const [showAgents, setShowAgents] = useState(false);

  const activeFile = useStore(workbenchStore.selectedFile);
  const currentDocument = useStore(workbenchStore.currentDocument);
  const unsavedFiles = useStore(workbenchStore.unsavedFiles);

  const onFileSelect = (value?: string) => workbenchStore.setSelectedFile(value);
  const onFileSave = () => workbenchStore.saveCurrentDocument();

  const onFileReset = () => workbenchStore.resetCurrentDocument();

  const files = useStore(workbenchStore.files);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: showWorkbench ? 0 : '100%' }}
      transition={{ type: 'spring', damping: 20, stiffness: 100 }}
      className="fixed inset-y-0 right-0 w-[60%] z-workbench bg-flare-elements-background-depth-1 border-l border-flare-elements-borderColor shadow-2xl flex flex-col overflow-hidden"
    >
      <div className="flex items-center px-4 py-3 border-b border-flare-elements-borderColor bg-white/2">
        <div className="flex bg-zinc-950/80 rounded-full p-1 border border-white/5 backdrop-blur-xl shadow-2xl">
          <button
            onClick={() => workbenchStore.currentView.set('code')}
            className={classNames(
              'px-6 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 duration-300',
              {
                'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.2)]':
                  currentView === 'code',
                'text-zinc-500 hover:text-zinc-300 !bg-transparent': currentView !== 'code',
              },
            )}
          >
            <div
              className={classNames('i-ph:code-bold transition-transform', { 'scale-110': currentView === 'code' })}
            />
            Code
          </button>
          <button
            onClick={() => workbenchStore.currentView.set('preview')}
            className={classNames(
              'px-6 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 duration-300',
              {
                'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/40 shadow-[0_0_20px_rgba(168,85,247,0.2)]':
                  currentView === 'preview',
                'text-zinc-500 hover:text-zinc-300 !bg-transparent': currentView !== 'preview',
              },
            )}
          >
            <div
              className={classNames('i-ph:monitor-play-bold transition-transform', {
                'scale-110': currentView === 'preview',
              })}
            />
            Preview
          </button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex bg-zinc-950/40 rounded-full p-0.5 border border-white/5 backdrop-blur-md mr-2">
            <IconButton
              icon="i-ph:terminal-window-bold"
              title="Toggle Terminal"
              onClick={() => workbenchStore.toggleTerminal()}
              className={classNames('transition-all duration-300 rounded-full w-8 h-8', {
                'bg-purple-500/20 text-purple-400': useStore(workbenchStore.terminalStore.showTerminal),
                'text-white/40 hover:text-white': !useStore(workbenchStore.terminalStore.showTerminal),
              })}
            />
            <IconButton
              icon="i-ph:git-branch-bold"
              title="Toggle Git"
              onClick={() => workbenchStore.toggleGit()}
              className={classNames('transition-all duration-300 rounded-full w-8 h-8', {
                'bg-purple-500/20 text-purple-400': showGit,
                'text-white/40 hover:text-white': !showGit,
              })}
            />
            <IconButton
              icon="i-ph:brain-bold"
              title="Toggle Agent Panel"
              onClick={() => setShowAgents(!showAgents)}
              className={classNames('transition-all duration-300 rounded-full w-8 h-8', {
                'bg-indigo-500/20 text-indigo-400': showAgents,
                'text-white/40 hover:text-white': !showAgents,
              })}
            />
          </div>

          <IconButton
            icon="i-ph:x-bold"
            size="md"
            onClick={() => workbenchStore.showWorkbench.set(false)}
            className="text-white/40 hover:text-white hover:bg-white/10 p-2 rounded-full transition-all"
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {currentView === 'code' ? (
          <PanelGroup direction="horizontal">
            <Panel defaultSize={showGit || showAgents ? 65 : 100} minSize={20}>
              <EditorPanel
                files={files}
                unsavedFiles={unsavedFiles}
                editorDocument={currentDocument}
                isStreaming={isStreaming}
                selectedFile={activeFile}
                onFileSelect={onFileSelect}
                onFileSave={onFileSave}
                onFileReset={onFileReset}
              />
            </Panel>
            {showGit && (
              <>
                <PanelResizeHandle className="w-1 bg-white/5 hover:bg-purple-500/20 transition-colors" />
                <Panel defaultSize={25} minSize={15}>
                  <GitPanel />
                </Panel>
              </>
            )}
            {showAgents && (
              <>
                <PanelResizeHandle className="w-1 bg-white/5 hover:bg-indigo-500/20 transition-colors" />
                <Panel defaultSize={30} minSize={20}>
                  <AgentPanel />
                </Panel>
              </>
            )}
          </PanelGroup>
        ) : (
          <Preview />
        )}
      </div>
    </motion.div>
  );
});
