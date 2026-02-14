"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  memo,
  useMemo,
} from "react";
import { ChatMessage } from "@/types/builder";
import { Button } from "@/components/ui/button";
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  FileCode2,
  StopCircle,
  Paperclip,
  Image as ImageIcon,
  Mic,
  ChevronUp,
  X,
  GitCommitHorizontal,
  FileText,
  Folder,
  Terminal,
  MessageSquare,
  Command,
  Check,
  Server,
  Book,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (
    content: string,
    mentions?: any[],
    attachments?: File[],
  ) => void;
  isStreaming?: boolean;
  streamingContent?: string;
  condensed?: boolean;
  onStopStreaming?: () => void;
  onReviewChanges?: () => void;
  hasUncommittedChanges?: boolean;
  modelName?: string;
  onModelChange?: (modelId?: string) => void;
  files?: Record<string, string>;
  chatModeDropdown?: React.ReactNode;
}

// ─── Main Component ────────────────────────────────────────────────────────

export function ChatInterface({
  messages,
  onSendMessage,
  isStreaming = false,
  streamingContent = "",
  condensed = false,
  onStopStreaming,
  onReviewChanges,
  hasUncommittedChanges = false,
  modelName,
  onModelChange,
  files = {},
  chatModeDropdown,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [mentions, setMentions] = useState<any[]>([]);

  const handleSend = useCallback(() => {
    if (input.trim() && !isStreaming) {
      onSendMessage(
        input.trim(),
        mentions.length > 0 ? mentions : undefined,
        attachments.length > 0 ? attachments : undefined,
      );
      setInput("");
      setAttachments([]);
      setMentions([]);
    }
  }, [input, onSendMessage, isStreaming, attachments, mentions]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleAttachFile = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        setAttachments((prev) => [...prev, ...Array.from(files)]);
      }
    };
    input.click();
  }, []);

  const handleAttachImage = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        setAttachments((prev) => [...prev, ...Array.from(files)]);
      }
    };
    input.click();
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddMention = useCallback((mention: any) => {
    setMentions((prev) => [...prev, mention]);
  }, []);

  const handleRemoveMention = useCallback((index: number) => {
    setMentions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="flex flex-col h-full">
      <MessageList
        messages={messages}
        isStreaming={isStreaming}
        streamingContent={streamingContent}
        condensed={condensed}
      />

      {/* Review Changes Button (floating above input) */}
      {hasUncommittedChanges && onReviewChanges && (
        <div className="px-3 -mb-1">
          <button
            onClick={onReviewChanges}
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-t-lg bg-muted/60 hover:bg-muted/80 border border-b-0 border-border/40 text-xs text-muted-foreground hover:text-foreground transition-all group"
          >
            <GitCommitHorizontal className="h-3 w-3 text-violet-400 group-hover:text-violet-300" />
            <span className="font-medium">Review Changes</span>
          </button>
        </div>
      )}

      {/* Cursor-style Input Bar */}
      <ChatInputBar
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onKeyDown={handleKeyDown}
        isStreaming={isStreaming}
        onStopStreaming={onStopStreaming}
        onAttachFile={handleAttachFile}
        onAttachImage={handleAttachImage}
        attachments={attachments}
        onRemoveAttachment={removeAttachment}
        modelName={modelName}
        onModelChange={onModelChange}
        files={files}
        mentions={mentions}
        onAddMention={handleAddMention}
        onRemoveMention={handleRemoveMention}
        chatModeDropdown={chatModeDropdown}
      />
    </div>
  );
}

// ─── Message List ──────────────────────────────────────────────────────────

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  condensed?: boolean;
}

const MessageList = memo(function MessageList({
  messages,
  isStreaming,
  streamingContent,
  condensed = false,
}: MessageListProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;

    if (messages.length !== prevCount || isStreaming) {
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [messages.length, isStreaming, streamingContent]);

  // Empty state
  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center space-y-3 max-w-[220px]">
          <div className="mx-auto w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center shadow-lg shadow-violet-500/5">
            <Sparkles className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground/80">
              Flare Builder AI
            </p>
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
              Describe what you want to build. I&apos;ll write the code directly
              into your project files.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {[
              "Build a landing page",
              "Add authentication",
              "Create an API",
              "Fix a bug",
            ].map((suggestion) => (
              <button
                key={suggestion}
                className="text-[9px] px-2 py-1.5 rounded-md border border-border/40 bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all text-left leading-tight"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
      <div className="space-y-0.5 p-2">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            condensed={condensed}
          />
        ))}
        {isStreaming && streamingContent && (
          <MessageBubble
            message={{
              id: "streaming",
              role: "assistant",
              content: streamingContent,
              mentions: [],
              timestamp: Date.now(),
            }}
            isStreaming
            condensed={condensed}
          />
        )}
        {isStreaming && !streamingContent && (
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center shrink-0">
              <Bot className="h-3 w-3 text-violet-400" />
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-[11px]">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
});

// ─── Message Bubble ────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage;
  isStreaming?: boolean;
  condensed?: boolean;
}

function hasCodeBlocks(content: string): boolean {
  return /```[\w./-]*\n/.test(content);
}

const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming = false,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const containsCode = useMemo(
    () => !isUser && hasCodeBlocks(message.content),
    [isUser, message.content],
  );

  return (
    <div
      className={`flex gap-2 px-2 py-1.5 rounded-md transition-colors ${isUser ? "bg-transparent" : "bg-muted/30"}`}
      data-testid={`message-${message.id}`}
    >
      {/* Avatar */}
      <div
        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
          isUser
            ? "bg-primary/10"
            : "bg-gradient-to-br from-violet-500/20 to-indigo-500/20"
        }`}
      >
        {isUser ? (
          <User className="h-3 w-3 text-primary/70" />
        ) : (
          <Bot className="h-3 w-3 text-violet-400" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] leading-relaxed break-words whitespace-pre-wrap text-foreground/90">
          {message.content}
        </div>
        {containsCode && !isStreaming && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-500/70">
            <FileCode2 className="h-3 w-3" />
            <span>Files updated</span>
          </div>
        )}
        {isStreaming && (
          <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-violet-400 animate-pulse rounded-sm" />
        )}
      </div>
    </div>
  );
});

// ─── Cursor-Style Chat Input Bar ───────────────────────────────────────────

// ─── Cursor-Style Chat Input Bar ───────────────────────────────────────────

interface ChatInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  isStreaming?: boolean;
  onStopStreaming?: () => void;
  onAttachFile?: () => void;
  onAttachImage?: () => void;
  attachments?: File[];
  onRemoveAttachment?: (index: number) => void;
  modelName?: string;
  onModelChange?: (modelId?: string) => void;
  files?: Record<string, string>;
  mentions?: any[];
  onAddMention?: (mention: any) => void;
  onRemoveMention?: (index: number) => void;
  chatModeDropdown?: React.ReactNode;
}

function ChatInputBar({
  value,
  onChange,
  onSend,
  onKeyDown,
  isStreaming = false,
  onStopStreaming,
  onAttachFile,
  onAttachImage,
  attachments = [],
  onRemoveAttachment,
  modelName = "GPT-4.1 Mini",
  onModelChange,
  files = {},
  mentions = [],
  onAddMention,
  onRemoveMention,
  chatModeDropdown,
}: ChatInputBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionType, setMentionType] = useState<"root" | "files">("root");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Model Selector State
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const modelSelectorRef = useRef<HTMLDivElement>(null);

  // Fetch models
  useEffect(() => {
    fetch("/api/chat/models")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setAvailableModels(data);
        }
      })
      .catch(() => {});
  }, []);

  // Click outside to close model selector
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        modelSelectorRef.current &&
        !modelSelectorRef.current.contains(event.target as Node)
      ) {
        setShowModelSelector(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [value]);

  // Handle @ mentions detection
  useEffect(() => {
    if (!value) {
      setShowMentions(false);
      return;
    }

    const lastWord = value.split(/\s+/).pop() || "";

    if (lastWord.startsWith("@")) {
      const query = lastWord.slice(1);
      setShowMentions(true);

      if (query.startsWith("files:")) {
        setMentionType("files");
        setMentionQuery(query.replace("files:", ""));
      } else {
        setMentionType("root");
        setMentionQuery(query);
      }
      setSelectedIndex(0);
    } else {
      setShowMentions(false);
    }
  }, [value]);

  // Filter items based on type and query
  const filteredItems = useMemo(() => {
    if (mentionType === "root") {
      const rootItems = [
        {
          id: "files",
          label: "Files",
          icon: FileText,
          description: "Select specific files",
        },
        {
          id: "folders",
          label: "Directories",
          icon: Folder,
          description: "Add folder context",
        },
        {
          id: "mcp",
          label: "MCP servers",
          icon: Server,
          description: "Use MCP tools",
        },
        {
          id: "rules",
          label: "Rules",
          icon: Book,
          description: "Add project rules",
        },
        {
          id: "conversations",
          label: "Conversations",
          icon: MessageSquare,
          description: "Reference previous chats",
        },
        {
          id: "terminal",
          label: "Terminal",
          icon: Terminal,
          description: "Add terminal logs",
        },
      ];
      return rootItems.filter((item) =>
        item.label.toLowerCase().includes(mentionQuery.toLowerCase()),
      );
    } else if (mentionType === "files") {
      return Object.keys(files || {})
        .filter((path) =>
          path.toLowerCase().includes(mentionQuery.toLowerCase()),
        )
        .slice(0, 100) // Limit results
        .map((path) => ({
          id: path,
          label: path.split("/").pop() || path,
          icon: FileText,
          description: path,
          value: path,
        }));
    }
    return [];
  }, [mentionType, mentionQuery, files]);

  const handleSelect = (item: any) => {
    if (mentionType === "root") {
      if (item.id === "files") {
        // Transition to file selection
        const newValue = value.replace(/@[\w-]*$/, "@files:");
        onChange(newValue);
      } else if (item.id === "folders" || item.id === "directories") {
        // Placeholder for folders
        const newValue = value.replace(/@[\w-]*$/, "@folders:");
        onChange(newValue);
      } else {
        // Direct add
        onAddMention?.({ type: item.id, data: {} });
        const newValue = value.replace(/@[\w-]*$/, "");
        onChange(newValue);
        setShowMentions(false);
      }
    } else {
      // File selected
      onAddMention?.({ type: "file", data: item.value });
      const newValue = value.replace(/@files:[\w./-]*$/, "");
      onChange(newValue);
      setShowMentions(false);
      // Reset type
      setMentionType("root");
    }
  };

  const handleKeyDownInternal = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (showMentions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + filteredItems.length) % filteredItems.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelect(filteredItems[selectedIndex]);
        }
        return;
      }
      if (e.key === "Escape") {
        setShowMentions(false);
        return;
      }
    }
    onKeyDown(e);
  };

  return (
    <div className="relative border-t border-border/40 bg-background/80 backdrop-blur-sm">
      {/* Mentions Dropdown */}
      {showMentions && filteredItems.length > 0 && (
        <div className="absolute bottom-full left-3 mb-2 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-2 py-1.5 bg-blue-500/10 border-b border-border/40 text-[10px] font-medium text-blue-400">
            <div className="flex items-center gap-1.5">
              <span>{"< >"}</span>
              <span>Code Context Items</span>
            </div>
          </div>
          <div className="p-1 max-h-60 overflow-y-auto">
            {filteredItems.map((item, index) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm rounded-md transition-colors ${
                  index === selectedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted/50"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0 opacity-70" />
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate font-medium">{item.label}</span>
                  {item.description && (
                    <span className="text-[10px] text-muted-foreground truncate opacity-70">
                      {item.description}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
          {mentionType === "files" && (
            <div className="px-2 py-1 bg-muted/30 border-t border-border/40 text-[10px] text-muted-foreground">
              Select a file to add context
            </div>
          )}
        </div>
      )}

      {/* Model Selector Popover */}
      {showModelSelector && (
        <div
          ref={modelSelectorRef}
          className="absolute bottom-12 right-3 w-64 bg-popover border border-border rounded-lg shadow-xl overflow-hidden z-50 animate-in fade-in-0 zoom-in-95 duration-200"
        >
          <div className="px-3 py-2 border-b border-border/40 text-xs font-semibold text-muted-foreground">
            Select Model
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {availableModels.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                Loading models...
              </div>
            )}
            {availableModels.map((group) => (
              <div key={group.provider} className="mb-1">
                <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/50 font-bold">
                  {group.provider}
                </div>
                {group.models.map((model: any) => {
                  const modelId = `${group.provider}/${model.name}`;
                  const isSelected = modelName.includes(model.name); // Simple check
                  return (
                    <button
                      key={modelId}
                      onClick={() => {
                        onModelChange?.(modelId);
                        setShowModelSelector(false);
                      }}
                      className={`w-full flex items-center justify-between px-2 py-1.5 text-left text-xs rounded-md transition-colors ${
                        isSelected
                          ? "bg-violet-500/10 text-violet-500"
                          : "hover:bg-muted"
                      }`}
                    >
                      <span className="truncate">{model.name}</span>
                      {isSelected && <Check className="h-3 w-3 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reused Attachment Preview Strip + Mentions Chip Strip */}
      {(attachments.length > 0 || mentions.length > 0) && (
        <div className="flex gap-2 px-3 pt-2 pb-1 overflow-x-auto">
          {/* File Attachments */}
          {attachments.map((file, index) => (
            <div
              key={`att-${index}`}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 border border-border/40 text-[10px] text-muted-foreground shrink-0 group"
            >
              {file.type.startsWith("image/") ? (
                <ImageIcon className="h-3 w-3 text-blue-400" />
              ) : (
                <FileText className="h-3 w-3 text-amber-400" />
              )}
              <span className="max-w-[80px] truncate">{file.name}</span>
              <button
                onClick={() => onRemoveAttachment?.(index)}
                className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
          ))}

          {/* Context Mentions */}
          {mentions.map((mention, index) => (
            <div
              key={`men-${index}`}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20 text-[10px] text-violet-600 dark:text-violet-300 shrink-0 group"
            >
              {mention.type === "file" ? (
                <FileText className="h-3 w-3" />
              ) : mention.type === "terminal" ? (
                <Terminal className="h-3 w-3" />
              ) : (
                <Command className="h-3 w-3" />
              )}
              <span className="max-w-[100px] truncate">
                {mention.type === "file"
                  ? mention.data.split("/").pop()
                  : mention.type}
              </span>
              <button
                onClick={() => onRemoveMention?.(index)}
                className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5 hover:text-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Input Area */}
      <div className="px-3 py-2">
        <div className="relative rounded-xl border border-border/50 bg-muted/20 focus-within:border-violet-500/40 focus-within:ring-1 focus-within:ring-violet-500/20 transition-all">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDownInternal}
            placeholder={
              isStreaming
                ? "Waiting for response..."
                : "Ask anything (⌘L), @ to mention, / for workflow"
            }
            className="w-full min-h-[40px] max-h-[120px] resize-none text-[12px] bg-transparent px-3 pt-2.5 pb-9 focus:outline-none text-foreground placeholder:text-muted-foreground/60 leading-relaxed"
            disabled={isStreaming}
            data-testid="chat-input"
            rows={1}
          />

          {/* Bottom Toolbar */}
          <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between px-1.5 py-0.5">
            {/* Left side — action buttons */}
            <div className="flex items-center gap-0.5">
              {/* Add/Attach Menu (now just wrapper logic, functional attach button exists below) */}

              {/* File attachment */}
              <button
                onClick={onAttachFile}
                className="p-1.5 rounded-md hover:bg-muted/80 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                title="Attach file"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>

              {/* Image attachment */}
              <button
                onClick={onAttachImage}
                className="p-1.5 rounded-md hover:bg-muted/80 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                title="Attach image"
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Right side — mode dropdown, model selector, mic, send */}
            <div className="flex items-center gap-1">
              {/* Chat Mode Dropdown (left of model selector) */}
              {chatModeDropdown}

              {/* Model Selector Button */}
              <button
                onClick={() => setShowModelSelector(!showModelSelector)}
                className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted/80 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                title="Change AI model"
              >
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-medium">{modelName}</span>
                </div>
                <ChevronUp className="h-3 w-3" />
              </button>

              {/* Mic button */}
              <button
                className="p-1.5 rounded-md hover:bg-muted/80 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                title="Voice input"
              >
                <Mic className="h-3.5 w-3.5" />
              </button>

              {/* Send / Stop */}
              {isStreaming ? (
                <Button
                  onClick={onStopStreaming}
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg"
                  data-testid="stop-button"
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={onSend}
                  disabled={!value.trim()}
                  size="icon"
                  className="h-7 w-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-20 disabled:bg-muted/60 disabled:text-muted-foreground/40 transition-all shadow-sm"
                  data-testid="send-button"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
