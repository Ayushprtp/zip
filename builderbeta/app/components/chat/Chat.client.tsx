import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from 'ai/react';
import { useAnimate } from 'framer-motion';
import { memo, useEffect, useRef, useState } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import { useMessageParser, usePromptEnhancer, useShortcuts, useSnapScroll, useAgenticMiddleware, useAgenticExecutor } from '~/lib/hooks';
import { useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { selectedModelStore } from '~/lib/stores/model';
import { activeMode, MODES, type NativeMode } from '~/lib/stores/modes';
import { workbenchStore } from '~/lib/stores/workbench';

import { fileModificationsToHTML } from '~/utils/diff';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

const logger = createScopedLogger('Chat');

export function Chat() {
  renderLogger.trace('Chat');

  const { ready, initialMessages, storeMessageHistory } = useChatHistory();

  return (
    <>
      {ready && <ChatImpl initialMessages={initialMessages} storeMessageHistory={storeMessageHistory} />}
      <ToastContainer
        closeButton={({ closeToast }) => {
          return (
            <button className="Toastify__close-button" onClick={closeToast}>
              <div className="i-ph:x text-lg" />
            </button>
          );
        }}
        icon={({ type }) => {
          /**
           * @todo Handle more types if we need them. This may require extra color palettes.
           */
          switch (type) {
            case 'success': {
              return <div className="i-ph:check-bold text-flare-elements-icon-success text-2xl" />;
            }
            case 'error': {
              return <div className="i-ph:warning-circle-bold text-flare-elements-icon-error text-2xl" />;
            }
          }

          return undefined;
        }}
        position="bottom-right"
        pauseOnFocusLoss
        transition={toastAnimation}
      />
    </>
  );
}

interface ChatProps {
  initialMessages: Message[];
  storeMessageHistory: (messages: Message[]) => Promise<void>;
}

interface ChatRequestRuntimeContext {
  previewBaseUrls?: string[];
  browserServerUrl?: string;
  browserServerApiKey?: string;
  browserExtensionBridgeSessionId?: string;
  browserExtensionName?: string;
}

export const ChatImpl = memo(({ initialMessages, storeMessageHistory }: ChatProps) => {
  useShortcuts();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);

  const { showChat } = useStore(chatStore);
  const selectedModel = useStore(selectedModelStore);
  const currentMode = useStore(activeMode);

  const files = useStore(workbenchStore.files);
  const previews = useStore(workbenchStore.previews);
  const previewBaseUrls = previews
    .map((preview) => preview.baseUrl)
    .filter((baseUrl): baseUrl is string => typeof baseUrl === 'string' && baseUrl.length > 0);
  const browserServerUrl = import.meta.env.VITE_BROWSER_SERVER_URL || import.meta.env.BROWSER_SERVER_URL || undefined;
  const browserServerApiKey =
    import.meta.env.VITE_BROWSER_SERVER_API_KEY || import.meta.env.BROWSER_SERVER_API_KEY || undefined;
  const browserExtensionBridgeSessionId =
    import.meta.env.VITE_BROWSER_EXTENSION_BRIDGE_SESSION_ID ||
    import.meta.env.BROWSER_EXTENSION_BRIDGE_SESSION_ID ||
    undefined;
  const browserExtensionName =
    import.meta.env.VITE_BROWSER_EXTENSION_NAME || import.meta.env.BROWSER_EXTENSION_NAME || undefined;
  const runtimeContext: ChatRequestRuntimeContext = {
    previewBaseUrls,
    browserServerUrl,
    browserServerApiKey,
    browserExtensionBridgeSessionId,
    browserExtensionName,
  };
  const preferences = Object.entries(files).find(([path]) => path.endsWith('.bolt/user-preferences.md'))?.[1];
  const preferenceContent = preferences?.type === 'file' ? preferences.content : undefined;

  const [animationScope, animate] = useAnimate();

  const { messages, isLoading, input, handleInputChange, setInput, stop, append, setMessages } = useChat({
    api: '/api/chat',
    body: {
      model: selectedModel,
      preferences: preferenceContent,
      mode: currentMode,
      runtimeContext,
    },
    onError: (error) => {
      logger.error('Request failed\n\n', error);
      toast.error('There was an error processing your request');
    },
    onFinish: () => {
      logger.debug('Finished streaming');
    },
    initialMessages,
  });

  // Wire the Claude Code agentic system as background executor
  const { abortAll: abortAllAgents } = useAgenticMiddleware({
    isLoading,
    messages: messages as any,
    model: selectedModel,
    append,
    runtimeContext,
  });

  const { executeSkill, spawnAgent } = useAgenticExecutor({
    runtimeContext,
  });

  const handleRevert = (index: number) => {
    if (isLoading) {
      return;
    }

    const newMessages = messages.slice(0, index);
    setMessages(newMessages);
    storeMessageHistory(newMessages).catch((error) => toast.error(error.message));
  };

  const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer(selectedModel);
  const { parsedMessages, parseMessages } = useMessageParser();

  const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

  useEffect(() => {
    chatStore.setKey('started', initialMessages.length > 0);
  }, []);

  useEffect(() => {
    parseMessages(messages, isLoading);

    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => toast.error(error.message));
    }
  }, [messages, isLoading, parseMessages]);

  const scrollTextArea = () => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.scrollTop = textarea.scrollHeight;
    }
  };

  const abort = () => {
    stop();
    chatStore.setKey('aborted', true);
    workbenchStore.abortAllActions();
    abortAllAgents();
  };

  useEffect(() => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.style.height = 'auto';

      const scrollHeight = textarea.scrollHeight;

      textarea.style.height = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
      textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
    }
  }, [input, textareaRef]);

  const runAnimation = async () => {
    if (chatStarted) {
      return;
    }

    await Promise.all([
      animate('#examples', { opacity: 0, display: 'none' }, { duration: 0.1 }),
      animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
    ]);

    chatStore.setKey('started', true);

    setChatStarted(true);
  };

  const sendMessage = async (_event: React.UIEvent, messageInput?: string) => {
    const _input = messageInput || input;

    if (_input.length === 0 || isLoading) {
      return;
    }

    await workbenchStore.saveAllFiles();

    const fileModifications = workbenchStore.getFileModifcations();

    chatStore.setKey('aborted', false);

    // Detect skill commands locally
    const skillMatch = _input.match(
      /^\/(commit|ci|save|test|t|deploy|ship|refactor|rf|debug|fix|bug|review|cr|install|i|setup|init|new|create|loop|simplify|clean|cleanup|verify|check|remember|memo|monitor|watch|batch|pr-review|pr|diagnose|perf|slow|migrate|upgrade)(?:\s+(.*))?$/i,
    );

    if (skillMatch) {
      const skillName = skillMatch[1];
      const skillArgs = skillMatch[2] || '';

      const userMsg: Message = {
        id: `${Date.now()}`,
        role: 'user',
        content: fileModifications !== undefined
          ? `${fileModificationsToHTML(fileModifications)}\n\n${_input}`
          : _input
      };

      runAnimation();
      if (fileModifications !== undefined) {
        workbenchStore.resetAllFileModifications();
      }

      // We manually append the user message, so the UI feels immediate
      setMessages([...messages, userMsg]);
      setInput('');
      resetEnhancer();
      textareaRef.current?.blur();

      // Execute the skill contextually
      const result = await executeSkill(skillName, skillArgs, selectedModel);

      const assistantMsg: Message = {
        id: `${Date.now() + 1}`,
        role: 'assistant',
        content: `**Skill /${skillName} Execution Result:**\n\n${result.success ? '✅ Success' : '❌ Failed'}\n\n\`\`\`text\n${result.output || result.error || 'No output limit'}\n\`\`\``
      };

      setMessages((prev) => [...prev, assistantMsg]);
      return;
    }

    // Detect agent commands locally (e.g., @coder write a script, /agent reviewer check this)
    const agentMatch = _input.match(
      /^(?:@|\/(?:agent|ask)\s+)(coder|explorer|reviewer|architect|debugger|worker|proactive|planner|swarm_lead|browser)\b(?:\s+(.*))?$/i,
    );

    if (agentMatch) {
      const agentName = agentMatch[1].toLowerCase();
      const agentPrompt = agentMatch[2] || 'Start your objective.';

      const userMsg: Message = {
        id: `${Date.now()}`,
        role: 'user',
        content: fileModifications !== undefined
          ? `${fileModificationsToHTML(fileModifications)}\n\n${_input}`
          : _input
      };

      runAnimation();
      if (fileModifications !== undefined) {
        workbenchStore.resetAllFileModifications();
      }

      setMessages([...messages, userMsg]);
      setInput('');
      resetEnhancer();
      textareaRef.current?.blur();

      // Execute the agent contextually
      const result = await spawnAgent(agentName, agentPrompt, selectedModel);

      const assistantMsg: Message = {
        id: `${Date.now() + 1}`,
        role: 'assistant',
        content: `**Agent @${agentName} Execution Result:**\n\n${result.success ? '✅ Success' : '❌ Failed'}\n\n\`\`\`text\n${result.output || result.error || 'No completion result returned.'}\n\`\`\``
      };

      setMessages((prev) => [...prev, assistantMsg]);
      return;
    }

    const userMsg: Message = {
      id: `${Date.now()}`,
      role: 'user',
      content: fileModifications !== undefined
        ? `${fileModificationsToHTML(fileModifications)}\n\n${_input}`
        : _input
    };

    runAnimation();

    if (fileModifications !== undefined) {
      append(userMsg);
      workbenchStore.resetAllFileModifications();
    } else {
      append(userMsg);
    }

    setInput('');
    resetEnhancer();
    textareaRef.current?.blur();
  };

  const [messageRef, scrollRef] = useSnapScroll();

  return (
    <BaseChat
      ref={animationScope}
      textareaRef={textareaRef}
      input={input}
      showChat={showChat}
      chatStarted={chatStarted}
      isStreaming={isLoading}
      enhancingPrompt={enhancingPrompt}
      promptEnhanced={promptEnhanced}
      sendMessage={sendMessage}
      messageRef={messageRef}
      scrollRef={scrollRef}
      handleInputChange={handleInputChange}
      handleStop={abort}
      onRevert={handleRevert}
      messages={messages
        .map((message) => {
          if (message.role === 'user') {
            return message;
          }

          const actualIndex = messages.indexOf(message);

          return {
            ...message,
            content: parsedMessages[actualIndex] || '',
          };
        })}
      enhancePrompt={() => {
        enhancePrompt(input, (input) => {
          setInput(input);
          scrollTextArea();
        });
      }}
    />
  );
});
