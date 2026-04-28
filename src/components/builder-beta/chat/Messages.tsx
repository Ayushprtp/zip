"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Sparkles, RotateCcw } from "lucide-react";
import { Markdown } from "./Markdown";

interface MessagesProps {
  id?: string;
  className?: string;
  isStreaming?: boolean;
  messages?: Array<{ role: string; content: string }>;
  onRevert?: (index: number) => void;
}

export const Messages = React.forwardRef<HTMLDivElement, MessagesProps>(
  (props, ref) => {
    const { id, isStreaming = false, messages = [], onRevert } = props;

    return (
      <div id={id} ref={ref} className={props.className}>
        <AnimatePresence mode="popLayout">
          {messages.length > 0
            ? messages.map((message, index) => {
                const { role, content } = message;
                const isUserMessage = role === "user";
                const isFirst = index === 0;

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.35,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className={`flex gap-3 p-4 w-full rounded-2xl transition-all duration-300 ${
                      isUserMessage
                        ? "bg-white/[0.03] border border-white/[0.05] shadow-2xl"
                        : "bg-transparent border-none"
                    } ${!isFirst ? "mt-3" : ""}`}
                  >
                    {isUserMessage ? (
                      <motion.div
                        className="flex items-center justify-center w-7 h-7 overflow-hidden bg-gradient-to-br from-white to-zinc-400 shadow-[0_0_12px_rgba(255,255,255,0.1)] text-black rounded-xl shrink-0 self-start border border-white/20"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                      >
                        <User className="w-3.5 h-3.5" />
                      </motion.div>
                    ) : (
                      <motion.div
                        className="flex items-center justify-center w-7 h-7 overflow-hidden bg-violet-500/10 text-violet-400 rounded-xl shrink-0 self-start border border-violet-500/20"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </motion.div>
                    )}
                    <div className="flex-1 overflow-hidden relative group/message">
                      {onRevert && !isStreaming && (
                        <div className="absolute top-0 right-0 opacity-0 group-hover/message:opacity-100 transition-opacity">
                          <button
                            title="Revert history to this message"
                            onClick={() => onRevert(index)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-700/50 hover:bg-zinc-600/50 text-zinc-400 hover:text-white transition-all text-xs font-medium border border-zinc-600/30"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Revert
                          </button>
                        </div>
                      )}
                      <div className="grid grid-col-1 w-full pt-1">
                        {isUserMessage ? (
                          <div className="text-sm text-zinc-200 whitespace-pre-wrap">
                            {content}
                          </div>
                        ) : (
                          <Markdown html>{content}</Markdown>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            : null}
        </AnimatePresence>
        {isStreaming && (
          <motion.div
            className="mt-4 flex justify-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
              <div className="flex gap-1">
                <span
                  className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
              <span className="text-xs text-zinc-400">Generating...</span>
            </div>
          </motion.div>
        )}
      </div>
    );
  },
);

Messages.displayName = "Messages";
