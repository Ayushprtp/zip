import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useEffect, useRef, useState } from 'react';
import { createHighlighter, type BundledLanguage, type BundledTheme, type HighlighterGeneric } from 'shiki';
import type { ActionState } from '~/lib/runtime/action-runner';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';

const highlighterOptions = {
  langs: ['shell'],
  themes: ['light-plus', 'dark-plus'],
};

const shellHighlighter: HighlighterGeneric<BundledLanguage, BundledTheme> =
  import.meta.hot?.data.shellHighlighter ?? (await createHighlighter(highlighterOptions));

if (import.meta.hot) {
  import.meta.hot.data.shellHighlighter = shellHighlighter;
}

interface ArtifactProps {
  messageId: string;
}

export const Artifact = memo(({ messageId }: ArtifactProps) => {
  const userToggledActions = useRef(false);
  const [showActions, setShowActions] = useState(false);

  const artifacts = useStore(workbenchStore.artifacts);
  const artifact = artifacts[messageId];

  const actions = useStore(
    computed(artifact.runner.actions, (actions) => {
      return Object.values(actions);
    }),
  );

  const toggleActions = () => {
    userToggledActions.current = true;
    setShowActions(!showActions);
  };

  useEffect(() => {
    if (actions.length && !showActions && !userToggledActions.current) {
      setShowActions(true);
    }
  }, [actions]);

  return (
    <div className="artifact glass-effect shadow-xl flex flex-col overflow-hidden rounded-2xl w-full border border-white/5 transition-all duration-300 hover:shadow-2xl hover:ring-1 hover:ring-white/20 mt-4 mb-4">
      <div className="flex">
        <button
          className="flex items-stretch bg-white/5 hover:bg-white/10 w-full overflow-hidden transition-colors py-4 px-6"
          onClick={() => {
            const showWorkbench = workbenchStore.showWorkbench.get();
            workbenchStore.showWorkbench.set(!showWorkbench);
          }}
        >
          <div className="w-full text-left">
            <div className="flex items-center gap-2">
              <div className="i-ph:projector-screen-duotone text-white text-lg" />
              <div className="w-full text-white font-semibold leading-5 text-md tracking-tight">{artifact?.title}</div>
            </div>
            <div className="w-full text-white/40 text-xs mt-1 font-medium uppercase tracking-widest pl-7">
              Open Workspace
            </div>
          </div>
        </button>
        <div className="bg-flare-elements-artifacts-borderColor w-[1px]" />
        <AnimatePresence>
          {actions.length && (
            <motion.button
              initial={{ width: 0 }}
              animate={{ width: 'auto' }}
              exit={{ width: 0 }}
              transition={{ duration: 0.15, ease: cubicEasingFn }}
              className="bg-flare-elements-artifacts-background hover:bg-flare-elements-artifacts-backgroundHover"
              onClick={toggleActions}
            >
              <div className="p-4">
                <div className={showActions ? 'i-ph:caret-up-bold' : 'i-ph:caret-down-bold'}></div>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {showActions && actions.length > 0 && (
          <motion.div
            className="actions"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: '0px' }}
            transition={{ duration: 0.15 }}
          >
            <div className="bg-flare-elements-artifacts-borderColor h-[1px]" />
            <div className="p-5 text-left bg-flare-elements-actions-background">
              <ActionList actions={actions} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

interface ShellCodeBlockProps {
  classsName?: string;
  code: string;
}

function ShellCodeBlock({ classsName, code }: ShellCodeBlockProps) {
  return (
    <div
      className={classNames('text-xs', classsName)}
      dangerouslySetInnerHTML={{
        __html: shellHighlighter.codeToHtml(code, {
          lang: 'shell',
          theme: 'dark-plus',
        }),
      }}
    ></div>
  );
}

interface ActionListProps {
  actions: ActionState[];
}

const actionVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const ActionList = memo(({ actions }: ActionListProps) => {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
      <ul className="list-none space-y-2.5">
        {actions.map((action, index) => {
          const { status, type, content } = action;
          const isLast = index === actions.length - 1;

          return (
            <motion.li
              key={index}
              variants={actionVariants}
              initial="hidden"
              animate="visible"
              transition={{
                duration: 0.2,
                ease: cubicEasingFn,
              }}
            >
              <div className="flex items-center gap-1.5 text-sm">
                <div className={classNames('text-lg', getIconColor(action.status))}>
                  {status === 'running' ? (
                    <div className="i-svg-spinners:90-ring-with-bg"></div>
                  ) : status === 'pending' ? (
                    <div className="i-ph:circle-duotone"></div>
                  ) : status === 'complete' ? (
                    <div className="i-ph:check"></div>
                  ) : status === 'failed' || status === 'aborted' ? (
                    <div className="i-ph:x"></div>
                  ) : null}
                </div>
                {type === 'file' ? (
                  <div>
                    {action.filePath && workbenchStore.files.get()[action.filePath] ? 'Edit' : 'Create'}{' '}
                    <code className="bg-flare-elements-artifacts-inlineCode-background text-flare-elements-artifacts-inlineCode-text px-1.5 py-1 rounded-md">
                      {action.filePath}
                    </code>
                  </div>
                ) : type === 'shell' ? (
                  <div className="flex items-center w-full min-h-[28px] gap-2">
                    <span className="flex-1 text-flare-elements-textPrimary font-medium">Run command</span>
                    <div className="flex items-center gap-2">
                      <button
                        title="Relocate to Terminal"
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-400/10 border border-zinc-400/20 text-[10px] text-zinc-400 hover:text-white hover:bg-zinc-400/20 hover:border-zinc-400/40 transition-all font-medium"
                        onClick={() => {
                          workbenchStore.showTerminal.set(true);
                          workbenchStore.showWorkbench.set(true);
                        }}
                      >
                        Relocate
                        <div className="i-ph:arrow-square-out text-sm" />
                      </button>
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/30 text-[9px] font-bold text-purple-400 uppercase tracking-tight shadow-[0_0_8px_rgba(168,85,247,0.1)]">
                        <div className="i-ph:terminal-window-fill text-xs" />
                        E2B Cloud
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              {type === 'shell' && (
                <div
                  className={classNames('flex flex-col mt-1', {
                    'mb-3.5': !isLast,
                  })}
                >
                  <ShellCodeBlock code={content} />
                  {(action as any).output && (action as any).output.length > 0 && (
                    <TerminalActionOutput output={(action as any).output} status={action.status} />
                  )}
                </div>
              )}
            </motion.li>
          );
        })}
      </ul>
    </motion.div>
  );
});

function getIconColor(status: ActionState['status']) {
  switch (status) {
    case 'pending': {
      return 'text-flare-elements-textTertiary';
    }
    case 'running': {
      return 'text-flare-elements-loader-progress';
    }
    case 'complete': {
      return 'text-flare-elements-icon-success';
    }
    case 'aborted': {
      return 'text-flare-elements-textSecondary';
    }
    case 'failed': {
      return 'text-flare-elements-icon-error';
    }
    default: {
      return undefined;
    }
  }
}

function TerminalActionOutput({ output, status }: { output: string; status: ActionState['status'] }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (status === 'running') {
      setIsOpen(true);
    }
  }, [status]);

  useEffect(() => {
    if (isOpen && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [output, isOpen]);

  return (
    <div className="mt-2 rounded-lg border border-flare-elements-borderColor overflow-hidden outline-none">
      <button
        type="button"
        onMouseDown={() => setIsOpen(!isOpen)}
        className="w-full cursor-pointer bg-flare-elements-background-depth-2 px-3 py-1.5 text-[11px] text-flare-elements-textSecondary hover:text-flare-elements-textPrimary transition-colors flex items-center justify-between select-none font-medium uppercase tracking-wider outline-none"
      >
        <span>Terminal Output</span>
        <div
          className={classNames('i-ph:caret-down-bold scale-90 transition-transform', { 'rotate-180': isOpen })}
        ></div>
      </button>
      {isOpen && (
        <div
          ref={contentRef}
          className="bg-[#181825] text-[#cdd6f4] p-3 text-[11px] font-mono whitespace-pre-wrap max-h-[250px] overflow-y-auto overflow-x-hidden border-t border-flare-elements-borderColor leading-relaxed"
        >
          {output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')}
        </div>
      )}
    </div>
  );
}
