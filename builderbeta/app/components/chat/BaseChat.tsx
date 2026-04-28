import type { Message } from 'ai';
import { useStore } from '@nanostores/react';
import React, { type RefCallback, useState, useEffect, Suspense, lazy } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Menu } from '~/components/sidebar/Menu.client';
import { IconButton } from '~/components/ui/IconButton';
import { Workbench } from '~/components/workbench/Workbench.client';
import { classNames } from '~/utils/classNames';
import { activeMode, MODES, type NativeMode } from '~/lib/stores/modes';
import { selectedModelStore } from '~/lib/stores/model';
import { workbenchStore } from '~/lib/stores/workbench';
import { Messages } from './Messages.client';
import { SendButton } from './SendButton.client';
import { motion } from 'framer-motion';
import { ImportButtons } from './ImportButtons';

import styles from './BaseChat.module.scss';

const ParticleField = lazy(() =>
  import('~/components/ui/ParticleField.client').then((mod) => ({ default: mod.ParticleField })),
);

interface BaseChatProps {
  textareaRef?: React.RefObject<HTMLTextAreaElement> | undefined;
  messageRef?: RefCallback<HTMLDivElement> | undefined;
  scrollRef?: RefCallback<HTMLDivElement> | undefined;
  showChat?: boolean;
  chatStarted?: boolean;
  isStreaming?: boolean;
  messages?: Message[];
  enhancingPrompt?: boolean;
  promptEnhanced?: boolean;
  input?: string;
  handleStop?: () => void;
  sendMessage?: (event: React.UIEvent, messageInput?: string) => void;
  handleInputChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  enhancePrompt?: () => void;
  onRevert?: (index: number) => void;
}

const EXAMPLE_PROMPTS = [
  { text: 'Build a todo app in React using Tailwind', icon: 'i-ph:check-square-duotone' },
  { text: 'Build a simple blog using Astro', icon: 'i-ph:newspaper-duotone' },
  { text: 'Create a cookie consent form using Material UI', icon: 'i-ph:cookie-duotone' },
  { text: 'Make a space invaders game', icon: 'i-ph:game-controller-duotone' },
  { text: 'How do I center a div?', icon: 'i-ph:align-center-horizontal-duotone' },
];

const TEXTAREA_MIN_HEIGHT = 76;

export const BaseChat = React.forwardRef<HTMLDivElement, BaseChatProps>(
  (
    {
      textareaRef,
      messageRef,
      scrollRef,
      showChat = true,
      chatStarted = false,
      isStreaming = false,
      enhancingPrompt = false,
      promptEnhanced = false,
      messages,
      input = '',
      sendMessage,
      handleInputChange,
      enhancePrompt,
      handleStop,
      onRevert,
    },
    ref,
  ) => {
    const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

    const [models, setModels] = useState<string[]>([]);
    const selectedModel = useStore(selectedModelStore);
    const showWorkbench = useStore(workbenchStore.showWorkbench);
    const currentMode = useStore(activeMode);

    useEffect(() => {
      fetch('/api/models')
        .then((res) => res.json())
        .then((data: any) => {
          if (data.models && Array.isArray(data.models) && data.models.length > 0) {
            setModels(data.models);
            // Auto-select the first model if current selection is not in the list
            if (!data.models.includes(selectedModel)) {
              selectedModelStore.set(data.models[0]);
            }
          }
        })
        .catch(console.error);
    }, []);

    return (
      <div
        ref={ref}
        className={classNames(
          styles.BaseChat,
          'relative flex h-full w-full overflow-hidden bg-flare-elements-background-depth-1',
        )}
        data-chat-visible={showChat}
      >
        <div className="fixed inset-0 bg-flare-elements-background-depth-1 z-0 pointer-events-none opacity-50" />

        <ClientOnly>{() => <Menu />}</ClientOnly>
        <div className="flex overflow-hidden w-full h-full">
          <PanelGroup direction="horizontal" className="w-full h-full">
            <Panel
              defaultSize={!showWorkbench ? 100 : 40}
              minSize={25}
              className="flex flex-col h-full overflow-hidden"
            >
              <div
                ref={scrollRef}
                className={classNames(styles.Chat, 'flex flex-col flex-grow w-full h-full overflow-y-auto')}
              >
                {!chatStarted && (
                  <motion.div
                    id="intro"
                    className="mt-[16vh] max-w-chat mx-auto flex flex-col items-center relative z-10"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <motion.h1
                      className="text-6xl text-center font-bold text-white mb-2 tracking-tighter"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.4 }}
                    >
                      Ignite your vision.
                    </motion.h1>
                    <motion.p
                      className="mb-4 text-center text-zinc-500 text-lg font-medium"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.6 }}
                    >
                      The state-of-the-art AI workspace for creators and developers.
                    </motion.p>
                  </motion.div>
                )}
                <div
                  className={classNames('pt-6 px-6', {
                    'h-full flex flex-col': chatStarted,
                  })}
                >
                  <ClientOnly>
                    {() => {
                      return chatStarted ? (
                        <Messages
                          ref={messageRef}
                          className={classNames('flex flex-col w-full flex-1 px-4 pb-6 mx-auto z-1', {
                            'max-w-chat': showWorkbench,
                            'max-w-4xl': !showWorkbench,
                          })}
                          messages={messages}
                          isStreaming={isStreaming}
                          onRevert={onRevert}
                        />
                      ) : null;
                    }}
                  </ClientOnly>
                  <div
                    className={classNames('relative w-full mx-auto z-prompt', {
                      'sticky bottom-0': chatStarted,
                      'max-w-chat': showWorkbench,
                      'max-w-4xl': !showWorkbench,
                    })}
                  >
                    <motion.div
                      className={classNames(
                        'glass-effect shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 border-none ring-1 ring-white/10 focus-within:ring-white/40',
                      )}
                      initial={!chatStarted ? { opacity: 0, y: 20 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: 0.8 }}
                    >
                      <textarea
                        ref={textareaRef}
                        className={`w-full pl-4 pt-4 pr-16 focus:outline-none resize-none text-md text-white placeholder-white/40 bg-transparent`}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            if (event.shiftKey) {
                              return;
                            }

                            event.preventDefault();

                            sendMessage?.(event);
                          }
                        }}
                        value={input}
                        onChange={(event) => {
                          handleInputChange?.(event);
                        }}
                        style={{
                          minHeight: TEXTAREA_MIN_HEIGHT,
                          maxHeight: TEXTAREA_MAX_HEIGHT,
                        }}
                        placeholder="How can Flare help you today?"
                        translate="no"
                      />
                      <div className="flex justify-between text-sm p-4 pt-2">
                        <div className="flex gap-1 items-center">
                          <IconButton
                            title="Enhance prompt"
                            disabled={input.length === 0 || enhancingPrompt}
                            className={classNames({
                              'opacity-100!': enhancingPrompt,
                              'text-flare-elements-item-contentAccent! pr-1.5 enabled:hover:bg-flare-elements-item-backgroundAccent!':
                                promptEnhanced,
                            })}
                            onClick={() => enhancePrompt?.()}
                          >
                            {enhancingPrompt ? (
                              <>
                                <div className="i-svg-spinners:90-ring-with-bg text-white text-xl shrink-0"></div>
                                <div className="ml-1.5 text-white/50 text-xs whitespace-nowrap">
                                  Enhancing prompt...
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="i-ph:sparkle-duotone text-white/60 text-xl group-hover:text-white transition-colors shrink-0"></div>
                                {promptEnhanced && (
                                  <div className="ml-1.5 text-white/70 font-medium text-xs whitespace-nowrap">
                                    Prompt enhanced
                                  </div>
                                )}
                              </>
                            )}
                          </IconButton>
                          <div className="w-[1px] h-6 bg-white/5 mx-2" />
                          <ImportButtons
                            disabled={enhancingPrompt}
                            onImport={(content) => sendMessage?.({} as any, content)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={currentMode}
                            onChange={(e) => activeMode.set(e.target.value as NativeMode)}
                            className="bg-purple-500/20 text-purple-200 text-xs rounded-[20px] border border-purple-500/30 shadow-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-500/50 cursor-pointer transition-colors hover:bg-purple-500/30 font-bold hidden sm:block"
                          >
                            {Object.entries(MODES).map(([key, m]) => (
                              <option key={key} value={key} className="bg-zinc-900 text-white py-1">
                                {m.label}
                              </option>
                            ))}
                          </select>
                          <select
                            value={selectedModel}
                            onChange={(e) => selectedModelStore.set(e.target.value)}
                            className="bg-white/10 text-white text-xs rounded-[20px] border border-white/10 shadow-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-white/20 cursor-pointer transition-colors hover:bg-white/20"
                          >
                            {models.map((m) => (
                              <option key={m} value={m} className="bg-zinc-900 text-white py-1">
                                {m}
                              </option>
                            ))}
                          </select>
                          <ClientOnly>
                            {() => (
                              <SendButton
                                show={input.length > 0 || isStreaming}
                                isStreaming={isStreaming}
                                onClick={(event) => {
                                  if (isStreaming) {
                                    handleStop?.();
                                    return;
                                  }

                                  sendMessage?.(event);
                                }}
                              />
                            )}
                          </ClientOnly>
                          {input.length > 3 ? (
                            <div className="text-xs text-flare-elements-textTertiary">
                              Use <kbd className="kdb">Shift</kbd> + <kbd className="kdb">Return</kbd> for a new line
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </motion.div>
                    <div className="bg-flare-elements-background-depth-1 pb-6">{/* Ghost Element */}</div>
                  </div>
                </div>
                {!chatStarted && (
                  <motion.div
                    id="examples"
                    className="relative w-full max-w-xl mx-auto mt-8 flex justify-center z-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 1.0 }}
                  >
                    <div className="flex flex-col space-y-2 [mask-image:linear-gradient(to_bottom,black_0%,transparent_180%)] hover:[mask-image:none]">
                      {EXAMPLE_PROMPTS.map((examplePrompt, index) => {
                        return (
                          <motion.button
                            key={index}
                            onClick={(event) => {
                              sendMessage?.(event, examplePrompt.text);
                            }}
                            className="group flex items-center w-full gap-3 justify-center bg-transparent text-flare-elements-textTertiary hover:text-flare-elements-textPrimary transition-all duration-200"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: 1.0 + index * 0.08 }}
                            whileHover={{ x: 4, transition: { duration: 0.15 } }}
                          >
                            <div
                              className={classNames(
                                examplePrompt.icon,
                                'text-lg opacity-50 group-hover:opacity-100 transition-opacity',
                              )}
                            />
                            {examplePrompt.text}
                            <div className="i-ph:arrow-bend-down-left opacity-0 group-hover:opacity-70 transition-opacity" />
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>
            </Panel>

            {showWorkbench && (
              <>
                <PanelResizeHandle className="w-1.5 cursor-col-resize hover:bg-white/10 active:bg-white/20 transition-colors pointer-events-auto z-50 flex items-center justify-center">
                  <div className="h-8 w-1 bg-white/20 rounded-full" />
                </PanelResizeHandle>
                <Panel defaultSize={60} minSize={30} className="flex flex-col h-full pointer-events-auto">
                  <ClientOnly>{() => <Workbench chatStarted={chatStarted} isStreaming={isStreaming} />}</ClientOnly>
                </Panel>
              </>
            )}
          </PanelGroup>
        </div>
      </div>
    );
  },
);
