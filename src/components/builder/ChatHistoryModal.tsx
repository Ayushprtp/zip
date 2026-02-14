"use client";

import { useState } from "react";
import {
  X,
  MessageSquare,
  Plus,
  Trash2,
  Clock,
  Search,
  Zap,
  Map,
  HelpCircle,
} from "lucide-react";

interface ChatSummary {
  id: string;
  title: string;
  messageCount: number;
  mode?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface ChatHistoryModalProps {
  chats: ChatSummary[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onNewChat: () => void;
  onClose: () => void;
}

function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return "";
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getModeIcon(mode?: string) {
  switch (mode) {
    case "agent":
      return <Zap className="h-3 w-3" />;
    case "plan":
      return <Map className="h-3 w-3" />;
    case "ask":
      return <HelpCircle className="h-3 w-3" />;
    default:
      return <MessageSquare className="h-3 w-3" />;
  }
}

function getModeBadgeColor(mode?: string) {
  switch (mode) {
    case "agent":
      return "bg-violet-500/20 text-violet-400 border-violet-500/30";
    case "plan":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "ask":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    default:
      return "bg-muted text-muted-foreground border-border/30";
  }
}

export function ChatHistoryModal({
  chats,
  activeChatId,
  onSelectChat,
  onDeleteChat,
  onNewChat,
  onClose,
}: ChatHistoryModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSelect = (id: string) => {
    onSelectChat(id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-background/95 backdrop-blur-xl border border-border/50 rounded-xl shadow-2xl w-[480px] max-h-[70vh] flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-2 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-blue-500/20 flex items-center justify-center border border-violet-500/20">
              <MessageSquare className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Chat History</h2>
              <p className="text-[10px] text-muted-foreground">
                {chats.length} conversation{chats.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted/60 transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 border-b border-border/20 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs bg-muted/30 border border-border/30 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-500/40 focus:border-violet-500/40 placeholder:text-muted-foreground/40 transition-all"
              autoFocus
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto min-h-0 p-2">
          {filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/50">
              <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">
                {searchQuery ? "No matching chats" : "No chats yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredChats.map((chat) => {
                const isActive = chat.id === activeChatId;
                return (
                  <div
                    key={chat.id}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 ${
                      isActive
                        ? "bg-violet-500/10 border border-violet-500/20 shadow-sm"
                        : "hover:bg-muted/40 border border-transparent"
                    }`}
                    onClick={() => handleSelect(chat.id)}
                  >
                    {/* Icon */}
                    <div
                      className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive
                          ? "bg-violet-500/20 text-violet-400"
                          : "bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      {getModeIcon(chat.mode)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-medium truncate ${isActive ? "text-violet-300" : ""}`}
                        >
                          {chat.title}
                        </span>
                        {chat.mode && (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full border shrink-0 uppercase font-semibold ${getModeBadgeColor(chat.mode)}`}
                          >
                            {chat.mode}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground/60">
                        <span>{chat.messageCount} messages</span>
                        {chat.updatedAt && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {formatTimeAgo(chat.updatedAt)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Delete */}
                    {chats.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteChat(chat.id);
                        }}
                        className="h-7 w-7 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/15 transition-all shrink-0"
                        title="Delete chat"
                      >
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border/20 shrink-0">
          <button
            onClick={() => {
              onNewChat();
              onClose();
            }}
            className="w-full h-8 flex items-center justify-center gap-2 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/20 text-violet-400 text-xs font-medium transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </button>
        </div>
      </div>
    </div>
  );
}
