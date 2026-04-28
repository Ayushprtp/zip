import type { Message } from 'ai';
import React from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { classNames } from '~/utils/classNames';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { motion, AnimatePresence } from 'framer-motion';
import { StreamingLoader3D } from '~/components/ui/StreamingLoader3D.client';

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Message[];
  onRevert?: (index: number) => void;
}

export const Messages = React.forwardRef<HTMLDivElement, MessagesProps>((props: MessagesProps, ref) => {
  const { id, isStreaming = false, messages = [], onRevert } = props;

  return (
    <div id={id} ref={ref} className={props.className}>
      <AnimatePresence mode="popLayout">
        {messages.length > 0
          ? messages.map((message, index) => {
              const { role, content } = message;
              const isUserMessage = role === 'user';
              const isFirst = index === 0;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className={classNames('flex gap-3 p-4 w-full rounded-2xl transition-all duration-300', {
                    'bg-white/3 border border-white/5 shadow-2xl': isUserMessage,
                    'glass-effect !bg-transparent border-none': !isUserMessage,
                    'mt-3': !isFirst,
                  })}
                >
                  {isUserMessage && (
                    <motion.div
                      className="flex items-center justify-center w-[28px] h-[28px] overflow-hidden bg-gradient-to-br from-white to-zinc-400 shadow-[0_0_12px_rgba(255,255,255,0.1)] text-black rounded-xl shrink-0 self-start border border-white/20"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                    >
                      <div className="i-ph:user-duotone text-base"></div>
                    </motion.div>
                  )}
                  {!isUserMessage && (
                    <motion.div
                      className="flex items-center justify-center w-[28px] h-[28px] overflow-hidden bg-white/5 text-white rounded-xl shrink-0 self-start border border-white/5 transition-all hover:bg-white/10"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                    >
                      <div className="i-ph:sparkle-duotone text-base"></div>
                    </motion.div>
                  )}
                  <div className="flex-1 overflow-hidden relative group/message">
                    {onRevert && !isStreaming && (
                      <div className="absolute top-0 right-0 opacity-0 group-hover/message:opacity-100 transition-opacity">
                        <button
                          title="Revert history to this message"
                          onClick={() => onRevert(index)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all text-xs font-medium border border-white/5"
                        >
                          <div className="i-ph:arrow-counter-clockwise-bold text-sm" />
                          Revert
                        </button>
                      </div>
                    )}
                    <div className="grid grid-col-1 w-full pt-1">
                      {isUserMessage ? <UserMessage content={content} /> : <AssistantMessage content={content} />}
                    </div>
                  </div>
                </motion.div>
              );
            })
          : null}
      </AnimatePresence>
      {isStreaming && (
        <motion.div
          className="mt-2 flex justify-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <ClientOnly>
            {() => <StreamingLoader3D />}
          </ClientOnly>
        </motion.div>
      )}
    </div>
  );
});
