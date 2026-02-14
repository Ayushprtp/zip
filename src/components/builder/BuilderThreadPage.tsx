"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useBuilderStore } from "@/stores/builder-store";
import { useBuilderUIStore } from "@/stores/builder-ui-store";
import { SandpackWrapper } from "./SandpackWrapper";
import { ChatInterface } from "./chat-interface";
import { CheckpointHistory } from "./checkpoint-history";
import { ChatHistoryModal } from "./ChatHistoryModal";
import { ProjectProvider, useProject } from "@/lib/builder/project-context";
import { useProjectSync } from "@/lib/builder/use-project-sync";
import { useGitAutoCommit } from "@/lib/builder/git-auto-commit";
import { toast } from "sonner";
import { VercelConnectModal } from "./VercelConnectModal";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { TaskPlanViewer } from "./TaskPlanViewer";
import {
  InlineSuggestionsPanel,
  type CodeSuggestion,
} from "./InlineDiffEditor";
import {
  FlareChatStorage,
  type StoredMessage,
  type TaskPlan,
  type TaskItem,
} from "@/lib/builder/flare-chat-storage";

import {
  X,
  Copy,
  Check,
  History,
  Plus,
  MessageSquare,
  Search,
  Map,
  Zap,
  ChevronDown,
  Database,
} from "lucide-react";
import { BuilderHeader } from "./BuilderHeader";
import { exportService } from "@/lib/builder/export-service";
import {
  deploymentService,
  type DeploymentStatus,
} from "@/lib/builder/deployment-service";
import { DeploymentProgress } from "./deployment-progress";
import { errorHandler } from "@/lib/builder/error-handlers";
import type { TemplateType, DeploymentConfig } from "app-types/builder";

// ─── Chat Mode ──────────────────────────────────────────────────────────────
type ChatMode = "ask" | "plan" | "agent";

const CHAT_MODES: {
  id: ChatMode;
  label: string;
  icon: React.ReactNode;
  desc: string;
}[] = [
  {
    id: "ask",
    label: "Ask",
    icon: <Search className="h-3 w-3" />,
    desc: "Ask questions about your code",
  },
  {
    id: "plan",
    label: "Plan",
    icon: <Map className="h-3 w-3" />,
    desc: "Plan changes with task files",
  },
  {
    id: "agent",
    label: "Agent",
    icon: <Zap className="h-3 w-3" />,
    desc: "Modify code directly",
  },
];

// ─── QR Modal ───────────────────────────────────────────────────────────────
function QRCodeModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy URL");
    }
  };
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-background p-6 rounded-lg shadow-lg max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold">Scan to Preview on Mobile</h3>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex justify-center mb-4 bg-white p-4 rounded">
          <QRCodeSVG value={url} size={200} level="M" />
        </div>
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">Preview URL:</p>
          <div className="flex items-center gap-2 p-2 bg-muted rounded text-xs break-all">
            <span className="flex-1">{url}</span>
          </div>
        </div>
        <Button onClick={handleCopyUrl} className="w-full" variant="outline">
          {copied ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-2" />
              Copy URL
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Resize Handle ──────────────────────────────────────────────────────────
function ResizeHandle({
  direction = "horizontal",
}: { direction?: "horizontal" | "vertical" }) {
  return (
    <PanelResizeHandle
      className={`group relative flex items-center justify-center ${
        direction === "horizontal"
          ? "w-[4px] hover:w-[6px] cursor-col-resize"
          : "h-[4px] hover:h-[6px] cursor-row-resize"
      } transition-all`}
    >
      <div
        className={`${
          direction === "horizontal" ? "w-[2px] h-8" : "h-[2px] w-8"
        } rounded-full bg-border/40 group-hover:bg-violet-400/60 group-active:bg-violet-400 transition-colors`}
      />
    </PanelResizeHandle>
  );
}

// ─── Chat Mode Dropdown ─────────────────────────────────────────────────────
function ChatModeDropdown({
  mode,
  onModeChange,
}: {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = CHAT_MODES.find((m) => m.id === mode)!;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium bg-muted/40 hover:bg-muted/60 border border-border/30 transition-colors"
      >
        {current.icon}
        <span>{current.label}</span>
        <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-48 py-1 bg-popover border border-border rounded-lg shadow-xl z-50 animate-in slide-in-from-bottom-2 duration-150">
          {CHAT_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                onModeChange(m.id);
                setOpen(false);
              }}
              className={`flex items-center gap-2 w-full px-3 py-2 text-left text-[11px] hover:bg-muted/60 transition-colors ${
                mode === m.id
                  ? "bg-violet-500/10 text-violet-400"
                  : "text-foreground"
              }`}
            >
              {m.icon}
              <div className="flex-1">
                <div className="font-medium">{m.label}</div>
                <div className="text-[9px] text-muted-foreground">{m.desc}</div>
              </div>
              {mode === m.id && <Check className="h-3 w-3 text-violet-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Chat Tabs Bar ──────────────────────────────────────────────────────────
function ChatTabsBar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
}: {
  chats: Array<{ id: string; title: string; messageCount: number }>;
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 px-1 py-0.5 border-b border-border/30 bg-muted/10 overflow-x-auto shrink-0 scrollbar-none">
      {chats.map((chat) => (
        <div
          key={chat.id}
          className={`group flex items-center gap-1 px-2 py-1 rounded-md text-[10px] cursor-pointer transition-all shrink-0 ${
            activeChatId === chat.id
              ? "bg-violet-500/15 text-violet-400 border border-violet-500/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
          onClick={() => onSelectChat(chat.id)}
        >
          <MessageSquare className="h-2.5 w-2.5 shrink-0" />
          <span className="max-w-[80px] truncate font-medium">
            {chat.title}
          </span>
          {chats.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteChat(chat.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/20 rounded transition-all"
            >
              <X className="h-2.5 w-2.5 text-red-400" />
            </button>
          )}
        </div>
      ))}

      <button
        onClick={onNewChat}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors shrink-0"
        title="New Chat"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Main Page Props ────────────────────────────────────────────────────────
interface BuilderThreadPageProps {
  threadId: string;
}

// ─── Inner Component ────────────────────────────────────────────────────────
function BuilderThreadPageContent({ threadId }: BuilderThreadPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentThread = useBuilderStore((s) => s.currentThread);
  const files = useBuilderStore((s) => s.files);
  const loadThread = useBuilderStore((s) => s.loadThread);
  const addMessage = useBuilderStore((s) => s.addMessage);

  const { state, actions } = useProject();

  const { isSaving, hasPendingSaves } = useProjectSync({
    autoSaveEnabled: true,
    debounceMs: 1000,
  });

  // UI store
  const mobilePreview = useBuilderUIStore((s) => s.mobilePreview);
  const viewMode = useBuilderUIStore((s) => s.viewMode);
  const setViewMode = useBuilderUIStore((s) => s.setViewMode);
  const showConsole = useBuilderUIStore((s) => s.showConsole);
  const toggleConsole = useBuilderUIStore((s) => s.toggleConsole);
  const showTerminal = useBuilderUIStore((s) => s.showTerminal);
  const toggleTerminal = useBuilderUIStore((s) => s.toggleTerminal);
  const showReport = useBuilderUIStore((s) => s.showReport);
  const toggleReport = useBuilderUIStore((s) => s.toggleReport);
  const showSSH = useBuilderUIStore((s) => s.showSSH);
  const toggleSSH = useBuilderUIStore((s) => s.toggleSSH);
  const bottomPanel = useBuilderUIStore((s) => s.bottomPanel);
  const bottomPanelMaximized = useBuilderUIStore((s) => s.bottomPanelMaximized);
  const toggleBottomPanelMaximized = useBuilderUIStore(
    (s) => s.toggleBottomPanelMaximized,
  );
  const setIsSynced = useBuilderUIStore((s) => s.setIsSynced);
  const serverStatus = useBuilderUIStore((s) => s.serverStatus);
  const startServer = useBuilderUIStore((s) => s.startServer);
  const stopServer = useBuilderUIStore((s) => s.stopServer);
  const restartServer = useBuilderUIStore((s) => s.restartServer);
  const toggleMobilePreview = useBuilderUIStore((s) => s.toggleMobilePreview);

  // Sync save status
  const isSyncedRef = useRef(!isSaving && !hasPendingSaves);
  useEffect(() => {
    const syncStatus = !isSaving && !hasPendingSaves;
    if (isSyncedRef.current !== syncStatus) {
      isSyncedRef.current = syncStatus;
      setIsSynced(syncStatus);
    }
  }, [isSaving, hasPendingSaves, setIsSynced]);

  const [showQR, setShowQR] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [filesReady, setFilesReady] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [deploymentStatus, setDeploymentStatus] =
    useState<DeploymentStatus | null>(null);
  const [deploymentUrl, setDeploymentUrl] = useState<string | undefined>();
  const [deploymentError, setDeploymentError] = useState<string | undefined>();
  const [showDeploymentProgress, setShowDeploymentProgress] = useState(false);
  const [showVercelConnect, setShowVercelConnect] = useState(false);

  // Chat mode
  const [chatMode, setChatMode] = useState<ChatMode>("agent");
  const [selectedModel, setSelectedModel] = useState<{
    provider: string;
    model: string;
  }>({
    provider: "openai",
    model: "gpt-4.1-mini",
  });

  // Git
  const [repoConfig, setRepoConfig] = useState<{
    owner: string;
    repo: string;
    branch: string;
    installationId?: number;
  } | null>(null);

  const {
    isCommitting,
    checkpoints,
    commitAndPush,
    rollback: rollbackCheckpoint,
    isConfigured: gitConfigured,
  } = useGitAutoCommit({
    repoConfig,
    enabled: !!repoConfig,
  });

  const [hasUncommittedChanges, setHasUncommittedChanges] = useState(false);
  const [showCheckpoints, setShowCheckpoints] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);

  // .flare-sh chat storage
  const storageRef = useRef<FlareChatStorage | null>(null);
  const [chatList, setChatList] = useState<
    Array<{
      id: string;
      title: string;
      messageCount: number;
      mode: string;
      createdAt: number;
      updatedAt: number;
    }>
  >([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [localMessages, setLocalMessages] = useState<StoredMessage[]>([]);

  // Task plan
  const [activeTaskPlan, setActiveTaskPlan] = useState<TaskPlan | null>(null);
  const [isExecutingTask, setIsExecutingTask] = useState(false);
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);

  // Inline suggestions
  const [codeSuggestions, setCodeSuggestions] = useState<CodeSuggestion[]>([]);

  // Streaming
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Init storage and load chats
  useEffect(() => {
    if (!state.files || !actions) return;
    const storage = new FlareChatStorage(
      state.files,
      actions.updateFile,
      actions.deleteFile,
    );
    storageRef.current = storage;

    const index = storage.getIndex();
    setChatList(index.chats);

    if (index.activeChat) {
      setActiveChatId(index.activeChat);
      const chat = storage.getChat(index.activeChat);
      if (chat) setLocalMessages(chat.messages);
    } else if (index.chats.length === 0) {
      // Create first chat
      const chat = storage.createChat("agent", "Chat 1");
      setChatList([
        {
          id: chat.id,
          title: chat.title,
          messageCount: 0,
          mode: chat.mode,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        },
      ]);
      setActiveChatId(chat.id);
      setLocalMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!state.files, !!actions]);

  // Keep storage files in sync
  useEffect(() => {
    if (storageRef.current) {
      storageRef.current.updateFiles(state.files);
    }
  }, [state.files]);

  // Load repo config
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`flare_repo_config_${threadId}`);
      if (stored) setRepoConfig(JSON.parse(stored));
    } catch {
      /* Config not available */
    }
  }, [threadId]);

  // Initial commit for new repos
  const initRepoRef = useRef(false);
  useEffect(() => {
    const shouldInit = searchParams.get("initRepo");

    if (
      shouldInit &&
      !initRepoRef.current &&
      gitConfigured &&
      commitAndPush &&
      Object.keys(state.files).length > 0
    ) {
      initRepoRef.current = true;

      const filesList = Object.entries(state.files)
        .filter(([path]) => !path.startsWith("/.flare-sh/"))
        .map(([path, content]) => ({ path, content }));

      toast.promise(commitAndPush(filesList, "Initial commit from Flare IDE"), {
        loading: "Pushing initial files to GitHub...",
        success: (res) => {
          // Clean URL param
          const newUrl = window.location.pathname;
          window.history.replaceState({}, "", newUrl);
          return `Initial commit pushed: ${res?.sha.slice(0, 7) || "Done"}`;
        },
        error: "Failed to push initial files",
      });
    }
  }, [searchParams, gitConfigured, commitAndPush, state.files]);

  // Load thread data
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setFilesReady(false);
        await loadThread(threadId);
      } catch (error) {
        console.error("Failed to load thread:", error);
        toast.error("Failed to load project");
        router.push("/builder");
      } finally {
        setIsLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    if (!isLoading && Object.keys(state.files).length > 0) setFilesReady(true);
    else if (!isLoading && Object.keys(files).length === 0) setFilesReady(true);
  }, [isLoading, state.files, files]);

  useEffect(() => {
    if (typeof window !== "undefined") setPreviewUrl(window.location.href);
  }, []);

  // ─── Chat Tab Actions ─────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    if (!storageRef.current) return;
    const chat = storageRef.current.createChat(
      chatMode,
      `Chat ${chatList.length + 1}`,
    );
    const newList = storageRef.current.listChats();
    setChatList(newList);
    setActiveChatId(chat.id);
    setLocalMessages([]);
    setActiveTaskPlan(null);
  }, [chatMode, chatList.length]);

  const handleSelectChat = useCallback((chatId: string) => {
    if (!storageRef.current) return;
    storageRef.current.setActiveChat(chatId);
    setActiveChatId(chatId);
    const chat = storageRef.current.getChat(chatId);
    if (chat) {
      setLocalMessages(chat.messages);
      setChatMode(chat.mode as ChatMode);
    }
    setActiveTaskPlan(null);
  }, []);

  const handleDeleteChat = useCallback(
    (chatId: string) => {
      if (!storageRef.current) return;
      if (chatList.length <= 1) {
        toast.error("Cannot delete the last chat");
        return;
      }
      storageRef.current.deleteChat(chatId);
      const newList = storageRef.current.listChats();
      setChatList(newList);
      const index = storageRef.current.getIndex();
      if (index.activeChat) {
        setActiveChatId(index.activeChat);
        const chat = storageRef.current.getChat(index.activeChat);
        if (chat) setLocalMessages(chat.messages);
      }
    },
    [chatList.length],
  );

  // ─── Export / Deploy ──────────────────────────────────────────────────
  const handleExportZip = useCallback(async () => {
    if (!currentThread) return;
    setIsExporting(true);
    try {
      await exportService.exportZip(
        state.files,
        currentThread.template as TemplateType,
        {
          projectName: currentThread.title,
          includeReadme: true,
          includePackageJson: true,
        },
      );
      toast.success("Project exported successfully!");
    } catch (error) {
      console.error("Export failed:", error);
      errorHandler.handleError(error);
      toast.error("Failed to export project");
    } finally {
      setIsExporting(false);
    }
  }, [currentThread, state.files]);

  const handleDeploy = useCallback(async () => {
    if (!currentThread) return;
    setShowDeploymentProgress(true);
    setDeploymentStatus(null);
    setDeploymentUrl(undefined);
    setDeploymentError(undefined);
    try {
      const config: DeploymentConfig = {
        platform: "vercel",
        projectName: currentThread.title,
        buildCommand: "npm run build",
        outputDirectory: "dist",
      };
      deploymentService.validateConfig(config);
      const result = await deploymentService.deploy(
        state.files,
        config,
        currentThread.template as TemplateType,
        (status) => setDeploymentStatus(status),
      );
      setDeploymentUrl(result.url);
      toast.success("Deployment successful!");
    } catch (error) {
      console.error("Deployment failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Deployment failed";

      if (errorMessage.includes("Vercel token not configured")) {
        setShowVercelConnect(true);
        setShowDeploymentProgress(false);
        return;
      }

      setDeploymentError(errorMessage);
      toast.error(errorMessage);
    }
  }, [currentThread, state.files]);

  // ─── Transformed Messages ─────────────────────────────────────────────
  const transformedMessages = useMemo(
    () =>
      localMessages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        mentions: m.mentions || [],
        timestamp: m.timestamp,
      })),
    [localMessages],
  );

  // ─── Parse AI Response ────────────────────────────────────────────────
  const parseAIResponse = useCallback(
    (response: string) => {
      const operations: Array<{
        type: "create" | "update" | "delete";
        path: string;
        content: string;
      }> = [];
      const seen = new Set<string>();

      // Pass 1: Match code blocks WITH filepath: prefix (preferred)
      const filepathRegex =
        /```(?:[\w.*+-]*)\s+filepath:([^\n`]+\.[a-zA-Z0-9]+)\n([\s\S]*?)```/g;
      let match;
      while ((match = filepathRegex.exec(response)) !== null) {
        let path = match[1].trim().replace(/\s+$/, "");
        const content = match[2].trimEnd();
        if (!path.includes(".")) continue;
        if (!path.startsWith("/")) path = "/" + path;
        if (seen.has(path)) continue;
        seen.add(path);
        const type = state.files[path] ? "update" : "create";
        operations.push({ type, path, content });
      }

      // Pass 2 (fallback): Match ALL code blocks, try to infer filename
      // from "Save as `filename`" text nearby or language extension
      if (operations.length === 0) {
        const langExtMap: Record<string, string> = {
          python: ".py",
          javascript: ".js",
          typescript: ".ts",
          jsx: ".jsx",
          tsx: ".tsx",
          java: ".java",
          cpp: ".cpp",
          c: ".c",
          csharp: ".cs",
          html: ".html",
          css: ".css",
          json: ".json",
          yaml: ".yml",
          sh: ".sh",
          bash: ".sh",
          rust: ".rs",
          go: ".go",
          ruby: ".rb",
          php: ".php",
          sql: ".sql",
          swift: ".swift",
          kotlin: ".kt",
          scss: ".scss",
          less: ".less",
          xml: ".xml",
          markdown: ".md",
          md: ".md",
        };

        // Match all code blocks: ```lang\n(code)\n```
        const allBlocksRegex = /```([\w.*+-]*)\n([\s\S]*?)```/g;
        let blockMatch;
        let blockIndex = 0;
        while ((blockMatch = allBlocksRegex.exec(response)) !== null) {
          const lang = blockMatch[1].trim().toLowerCase();
          const content = blockMatch[2].trimEnd();
          const blockEnd = blockMatch.index + blockMatch[0].length;

          // Skip empty or very short blocks (likely not file content)
          if (content.length < 5) continue;

          // Try to find "Save as `filename`" or "File: filename" after block
          const afterText = response.slice(blockEnd, blockEnd + 200);
          const saveAsMatch = afterText.match(
            /(?:save\s+(?:as|to)|file(?:name)?\s*:|create\s+(?:as|file))\s*[`'"]?([\w./-]+\.[a-zA-Z0-9]+)[`'"]?/i,
          );

          // Also try before the block for headers like "## filename.ext"
          const beforeText = response.slice(
            Math.max(0, blockMatch.index - 150),
            blockMatch.index,
          );
          const headerMatch = beforeText.match(
            /(?:#+\s*|\*\*)?(?:File:\s*|filename:\s*)?[`'"]?([\w./-]+\.[a-zA-Z0-9]+)[`'"]?\s*(?:\*\*)?\s*$/im,
          );

          let path: string | null = null;

          if (saveAsMatch) {
            path = saveAsMatch[1];
          } else if (headerMatch && headerMatch[1].includes(".")) {
            // Only use header match if it looks like a real filename
            const candidate = headerMatch[1];
            // Filter out common non-filenames
            if (
              !candidate.match(/^(Hello|Creating|Programs|Languages|Various)/i)
            ) {
              path = candidate;
            }
          }

          // Last resort: generate filename from language
          if (!path && lang && langExtMap[lang]) {
            const ext = langExtMap[lang];
            path = `/untitled_${blockIndex}${ext}`;
          }

          if (path) {
            if (!path.startsWith("/")) path = "/" + path;
            if (seen.has(path)) {
              blockIndex++;
              continue;
            }
            seen.add(path);
            const type = state.files[path] ? "update" : "create";
            operations.push({ type, path, content });
          }
          blockIndex++;
        }
      }

      return operations;
    },
    [state.files],
  );

  // ─── Parse Plan to Task File ──────────────────────────────────────────
  const parsePlanToTaskPlan = useCallback(
    (planText: string, title: string): TaskPlan => {
      const tasks = FlareChatStorage.parsePlanToTasks(planText);
      return {
        id: `plan-${Date.now().toString(36)}`,
        chatId: activeChatId || "",
        title,
        createdAt: Date.now(),
        status: "pending",
        tasks:
          tasks.length > 0
            ? tasks
            : [
                {
                  id: "task-1",
                  label: "1",
                  description: "Review and implement the plan above",
                  status: "pending",
                },
              ],
      };
    },
    [activeChatId],
  );

  // ─── Start Individual Task ────────────────────────────────────────────
  const handleStartTask = useCallback(
    async (task: TaskItem) => {
      if (!activeChatId || !storageRef.current) return;
      setIsExecutingTask(true);
      setExecutingTaskId(task.id);

      // Switch to agent mode for execution
      setChatMode("agent");

      const taskPrompt = `Execute this specific task:\n\nTask ${task.label}: ${task.description}\n\nImplement this task now. Generate the necessary code changes.`;

      // Trigger send via the same flow
      await handleSendMessage(taskPrompt);

      // Mark task completed
      if (activeTaskPlan) {
        markTaskCompleted(activeTaskPlan, task.id);
        if (storageRef.current) {
          storageRef.current.saveTaskList(activeTaskPlan);
          setActiveTaskPlan({ ...activeTaskPlan });
        }
      }

      setIsExecutingTask(false);
      setExecutingTaskId(null);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [activeChatId, activeTaskPlan],
  );
  // ─── Start All Tasks Sequentially ─────────────────────────────────────
  const handleStartAllTasks = useCallback(async () => {
    if (!activeTaskPlan) return;
    const allTasks = flattenTasks(activeTaskPlan.tasks).filter(
      (t) => t.status === "pending",
    );
    for (const task of allTasks) {
      await handleStartTask(task);
    }
  }, [activeTaskPlan, handleStartTask]);

  const handleManualCommit = useCallback(
    async (
      message: string,
      overrideFiles?: Array<{ path: string; content: string }>,
    ) => {
      if (!commitAndPush) {
        toast.error(
          "Git integration not configured. Connect a GitHub repo first.",
        );
        return;
      }

      if (!repoConfig) {
        toast.error(
          "No repository configured. Create or connect a repo from the project setup.",
        );
        return;
      }

      // Prepare files — strip leading / for GitHub
      let fileList = overrideFiles;

      if (!fileList) {
        fileList = Object.entries(state.files)
          .filter(([path]) => !path.startsWith("/.flare-sh/"))
          .map(([path, content]) => ({
            path: path.replace(/^\//, ""),
            content,
          }));
      } else {
        fileList = fileList.map((f) => ({
          path: f.path.replace(/^\//, ""),
          content: f.content,
        }));
      }

      if (fileList.length === 0) {
        toast.warning("No files to commit");
        return;
      }

      try {
        const result = await commitAndPush(fileList, message);
        if (result) {
          setHasUncommittedChanges(false);
          toast.success(`Committed ${fileList.length} files`, {
            description: `${result.sha.slice(0, 7)} — ${message}`,
            duration: 5000,
          });
        } else {
          toast.error(
            "Commit failed. Check your GitHub App configuration and repo access.",
          );
        }
      } catch (err: any) {
        console.error("Manual commit error:", err);
        toast.error(err.message || "Commit failed unexpectedly");
      }
    },
    [state.files, commitAndPush, repoConfig],
  );

  const handleStopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setStreamingContent("");
  }, []);

  // ─── Send Message ─────────────────────────────────────────────────────
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!activeChatId || isStreaming || !storageRef.current) return;

      try {
        // Add user message to storage
        const userMsg = storageRef.current.addMessage(
          activeChatId,
          "user",
          content,
        );
        if (userMsg) setLocalMessages((prev) => [...prev, userMsg]);

        // Also save to DB
        if (threadId)
          await addMessage(threadId, "user", content, []).catch(() => {});

        setIsStreaming(true);
        setStreamingContent("");

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const templateGuidelines: Record<string, string> = {
          react: `This is a React (Vite) project. Use functional components with hooks. Entry file is /App.jsx or /App.tsx.`,
          "vite-react": `This is a Vite + React project. Entry file is /src/App.tsx, mounted in /src/main.tsx. Use TypeScript.`,
          nextjs: `This is a Next.js App Router project. Use App Router pattern. Files under /app/. Use "use client" for client components.`,
          vanilla: `This is a vanilla JavaScript project. Entry file is /index.js. No frameworks.`,
          static: `This is a static HTML project. Entry file is /index.html. Plain HTML/CSS/JS.`,
        };

        const templateGuide =
          templateGuidelines[currentThread?.template || "react"] ||
          templateGuidelines.react;

        let modeInstructions = "";
        if (chatMode === "ask") {
          modeInstructions = `\n\nMODE: ASK\nAnswer questions about the codebase. Do NOT modify files or generate code blocks with file paths.`;
        } else if (chatMode === "plan") {
          modeInstructions = `\n\nMODE: PLAN\nCreate a detailed, hierarchical implementation plan using markdown headers and bullet points.\n\nFormat your plan using:\n## Major Phase/Section (e.g., "## Core Features", "## User Authentication")\n### Sub-section (e.g., "### Login System", "### Video Upload")\n- Specific task items as bullet points under each section\n- Each bullet should be a concrete, actionable task\n\nMake the plan thorough with clear phases, sections, and detailed tasks.\nDo NOT output code blocks with file paths. Just plan the work.`;
        } else {
          modeInstructions = `\n\nMODE: AGENT\nActively modify the codebase. You MUST generate complete, working code files.\n\nCRITICAL — OUTPUT FORMAT:\nEvery code block MUST start with the filepath on the first line after the language identifier.\nUse this EXACT format (no exceptions):\n\n\`\`\`tsx filepath:/src/App.tsx\nimport React from 'react';\n// ... complete file content\nexport default App;\n\`\`\`\n\nAnother example:\n\`\`\`css filepath:/src/styles.css\nbody { margin: 0; }\n\`\`\`\n\nDo NOT output code blocks without \"filepath:\". Every code block MUST have filepath.`;
        }

        const systemPrompt = `You are Builder AI — an expert code generator for a web-based IDE.\n\nPROJECT TEMPLATE: ${currentThread?.template || "react"}\n${templateGuide}${modeInstructions}\n\nRULES:\n1. EVERY code block MUST use: \`\`\`language filepath:/path/to/file.ext — this is MANDATORY, no exceptions.\n2. Always include complete, working code — never partial snippets.\n3. Follow modern best practices, use TypeScript where applicable.\n4. When modifying existing code, output the COMPLETE file content.\n5. Do NOT use "Save as" instructions — use the filepath: syntax instead.\n\nCurrent project files:\n${
          Object.keys(state.files)
            .filter((f) => !f.startsWith("/.flare-sh/"))
            .join(", ") || "No files yet"
        }`;

        const recentMessages = localMessages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch("/api/builder/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system: systemPrompt,
            messages: [...recentMessages, { role: "user", content }],
            provider: selectedModel.provider,
            model: selectedModel.model,
          }),
          signal: abortController.signal,
        });

        if (!response.ok)
          throw new Error(`API request failed: ${response.statusText}`);
        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setStreamingContent(fullText);
        }

        setIsStreaming(false);
        setStreamingContent("");

        // Save AI response
        const aiMsg = storageRef.current.addMessage(
          activeChatId,
          "assistant",
          fullText,
        );
        if (aiMsg) setLocalMessages((prev) => [...prev, aiMsg]);
        await addMessage(threadId, "assistant", fullText, []).catch(() => {});

        // Apply generated code changes
        if (chatMode === "agent") {
          const operations = parseAIResponse(fullText);
          if (operations.length > 0) {
            const changedNames: string[] = [];
            const changedFiles: Array<{ path: string; content: string }> = [];

            operations.forEach((op) => {
              if (op.type === "delete") {
                actions.deleteFile(op.path);
                changedNames.push(op.path.split("/").pop() || op.path);
              } else if (op.content) {
                const safePath = op.path.startsWith("/")
                  ? op.path
                  : "/" + op.path;
                actions.updateFile(safePath, op.content);
                changedNames.push(safePath.split("/").pop() || safePath);
                changedFiles.push({
                  path: safePath.replace(/^\//, ""),
                  content: op.content,
                });
              }
            });

            if (changedNames.length > 0) {
              const fileLabel =
                changedNames.length === 1
                  ? changedNames[0]
                  : `${changedNames.length} files`;
              const description =
                changedNames.length > 1
                  ? changedNames.join(", ")
                  : operations[0]?.path || "";
              toast.success(`✅ Updated: ${fileLabel}`, {
                description,
                duration: 5000,
              });

              // ── Auto Git Commit & Push ──────────────────────────────
              if (gitConfigured && changedFiles.length > 0) {
                const commitMsg = `feat(ai): update ${changedNames.join(", ")}`;
                try {
                  const checkpoint = await commitAndPush(
                    changedFiles,
                    commitMsg,
                  );
                  if (checkpoint) {
                    setHasUncommittedChanges(false);
                    toast.success(`🔀 Git: committed & pushed`, {
                      description: `${changedFiles.length} ${changedFiles.length === 1 ? "file" : "files"} → ${checkpoint.sha.slice(0, 7)}`,
                      duration: 4000,
                    });
                  }
                } catch (gitErr: any) {
                  console.error("[AutoCommit] Failed:", gitErr);
                  setHasUncommittedChanges(true);
                  toast.warning("Changes applied but git push failed", {
                    description: gitErr.message || "Will retry on next change",
                    duration: 5000,
                  });
                }
              } else {
                setHasUncommittedChanges(true);
              }
            }
          } else {
            // No file operations found — warn the user
            toast.warning(
              "AI response didn't include file changes. Try asking again in Agent mode.",
              {
                duration: 4000,
              },
            );
          }
        }

        // Refresh chat list to keep tabs in sync
        const updatedList = storageRef.current.listChats();
        setChatList(updatedList);

        // Auto-rename chat after first user message (if title is still default)
        const currentChat = storageRef.current.getChat(activeChatId);
        if (
          currentChat &&
          currentChat.messages.length <= 2 &&
          (currentChat.title.startsWith("Chat ") ||
            currentChat.title === "New Chat")
        ) {
          // Summarize the prompt to create a short title (async, fire and forget)
          fetch("/api/builder/ai/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system:
                "Generate a very short title (3-6 words) summarizing this chat. Return ONLY the title, no quotes, no punctuation, no explanation.",
              messages: [{ role: "user", content }],
              provider: selectedModel.provider,
              model: selectedModel.model,
            }),
          })
            .then((r) => r.text())
            .then((title) => {
              const cleanTitle = title
                .trim()
                .replace(/^["']|["']$/g, "")
                .slice(0, 40);
              if (cleanTitle && storageRef.current) {
                storageRef.current.renameChat(activeChatId, cleanTitle);
                setChatList(storageRef.current.listChats());
              }
            })
            .catch(() => {});
        }

        // Handle mode-specific post-processing
        if (chatMode === "plan") {
          // Parse the plan into a task file
          const plan = parsePlanToTaskPlan(fullText, content.slice(0, 50));
          if (plan.tasks.length > 0) {
            storageRef.current.saveTaskList(plan);
            setActiveTaskPlan(plan);
            toast.success("Task plan created! View it below.", {
              description: `${flattenTasks(plan.tasks).length} tasks identified`,
            });
          }
        }
      } catch (error: any) {
        if (error.name === "AbortError") {
          setIsStreaming(false);
          setStreamingContent("");
          return;
        }
        console.error("Failed to send message:", error);
        toast.error(`Error: ${error.message || "Failed to send message"}`);
        setIsStreaming(false);
        setStreamingContent("");
      }
    },
    [
      activeChatId,
      threadId,
      selectedModel,
      isStreaming,
      state.files,
      localMessages,
      currentThread,
      chatMode,
      gitConfigured,
      commitAndPush,
      addMessage,
      parseAIResponse,
      parsePlanToTaskPlan,
      actions,
    ],
  );

  // ─── Inline Suggestion Handlers ───────────────────────────────────────
  const handleAcceptSuggestion = useCallback(
    (suggestion: CodeSuggestion) => {
      actions.updateFile(suggestion.filePath, suggestion.suggestedCode);
      setCodeSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      toast.success(
        `Applied changes to ${suggestion.filePath.split("/").pop()}`,
      );
    },
    [actions],
  );

  const handleRejectSuggestion = useCallback((suggestion: CodeSuggestion) => {
    setCodeSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
  }, []);

  // ─── Loading State ────────────────────────────────────────────────────
  if (isLoading || !currentThread || !filesReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading project..." : "Preparing files..."}
          </p>
          {!isLoading && !filesReady && (
            <p className="text-xs text-muted-foreground/60 mt-1">
              Syncing {Object.keys(files).length} files
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-screen bg-background overflow-hidden">
      {/* Header */}
      <BuilderHeader
        projectName={currentThread?.title || "Untitled Project"}
        onDownloadZip={handleExportZip}
        onDeploy={handleDeploy}
        onShowQR={() => setShowQR(true)}
        onToggleMobilePreview={toggleMobilePreview}
        mobilePreview={mobilePreview}
        deploying={showDeploymentProgress}
        isExporting={isExporting}
        fileCount={
          Object.keys(state.files).filter((f) => !f.startsWith("/.flare-sh/"))
            .length
        }
        isSynced={!isSaving && !hasPendingSaves}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showConsole={showConsole}
        onToggleConsole={toggleConsole}
        showTerminal={showTerminal}
        onToggleTerminal={toggleTerminal}
        showReport={showReport}
        onToggleReport={toggleReport}
        showSSH={showSSH}
        onToggleSSH={toggleSSH}
        bottomPanel={bottomPanel}
        serverStatus={serverStatus}
        onServerStart={startServer}
        onServerStop={stopServer}
        onServerRestart={restartServer}
      />

      {/* Main Layout — Resizable Panels */}
      <PanelGroup direction="horizontal" className="flex-1 min-h-0">
        {/* Left Panel — Chat Sidebar */}
        <Panel defaultSize={25} minSize={15} maxSize={45}>
          <div className="flex flex-col h-full bg-muted/20">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-3 py-1.5 border-b bg-background/50 shrink-0 h-9">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">Builder AI</span>
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowChatHistory(true)}
                  title="Chat History"
                >
                  <Database className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowCheckpoints(!showCheckpoints)}
                  title="Checkpoints"
                >
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>

            {/* Chat Tabs */}
            <ChatTabsBar
              chats={chatList}
              activeChatId={activeChatId}
              onSelectChat={handleSelectChat}
              onNewChat={handleNewChat}
              onDeleteChat={handleDeleteChat}
            />

            {/* Chat Interface */}
            <ChatInterface
              messages={transformedMessages}
              onSendMessage={handleSendMessage}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
              onStopStreaming={handleStopStreaming}
              onReviewChanges={() => setShowCheckpoints(!showCheckpoints)}
              hasUncommittedChanges={hasUncommittedChanges || isCommitting}
              modelName={
                selectedModel.model === "gpt-4.1-mini"
                  ? "GPT-4.1 Mini"
                  : selectedModel.model
              }
              onModelChange={(modelId?: string) => {
                if (modelId) {
                  const [provider, model] = modelId.includes("/")
                    ? modelId.split("/")
                    : ["custom", modelId];
                  setSelectedModel({ provider, model });
                } else {
                  const nextModel =
                    selectedModel.model === "gpt-4.1-mini"
                      ? "gpt-4o"
                      : "gpt-4.1-mini";
                  setSelectedModel({ ...selectedModel, model: nextModel });
                }
              }}
              files={state.files}
              condensed
              chatModeDropdown={
                <ChatModeDropdown mode={chatMode} onModeChange={setChatMode} />
              }
            />

            {/* Checkpoint History */}
            {showCheckpoints && (
              <div className="border-t border-border/40 max-h-[40%] overflow-hidden flex flex-col animate-in slide-in-from-bottom-2 duration-300">
                <CheckpointHistory
                  checkpoints={checkpoints}
                  onRollback={async (id) => {
                    const success = await rollbackCheckpoint(id);
                    if (success) {
                      toast.success("Rolled back successfully");
                      setHasUncommittedChanges(false);
                    }
                  }}
                  isRollingBack={isCommitting}
                  repoOwner={repoConfig?.owner}
                  repoName={repoConfig?.repo}
                />
              </div>
            )}
          </div>
        </Panel>

        <ResizeHandle direction="horizontal" />

        {/* Right Panel — Editor/Preview (with vertical resizable bottom panel) */}
        <Panel defaultSize={75} minSize={40}>
          <PanelGroup direction="vertical">
            {/* Top — Main workspace */}
            <Panel defaultSize={activeTaskPlan ? 60 : 100} minSize={30}>
              <main className="h-full w-full relative overflow-hidden">
                {filesReady ? (
                  <div
                    className={
                      mobilePreview
                        ? "absolute inset-0 flex items-center justify-center overflow-hidden"
                        : "absolute inset-0 overflow-hidden"
                    }
                  >
                    {mobilePreview && (
                      <div className="w-[375px] h-full border-x overflow-hidden">
                        <SandpackWrapper
                          files={state.files}
                          template={currentThread.template}
                          viewMode={viewMode}
                          showConsole={showConsole}
                          showTerminal={showTerminal}
                          showReport={showReport}
                          showSSH={showSSH}
                          bottomPanel={bottomPanel}
                          bottomPanelMaximized={bottomPanelMaximized}
                          onToggleBottomPanelMaximized={
                            toggleBottomPanelMaximized
                          }
                        />
                      </div>
                    )}
                    {!mobilePreview && (
                      <SandpackWrapper
                        files={state.files}
                        template={currentThread.template}
                        viewMode={viewMode}
                        showConsole={showConsole}
                        showTerminal={showTerminal}
                        showReport={showReport}
                        showSSH={showSSH}
                        bottomPanel={bottomPanel}
                        bottomPanelMaximized={bottomPanelMaximized}
                        onToggleBottomPanelMaximized={
                          toggleBottomPanelMaximized
                        }
                        repoOwner={repoConfig?.owner}
                        repoName={repoConfig?.repo}
                        branch={repoConfig?.branch || "main"}
                        onCommitAndPush={handleManualCommit}
                      />
                    )}
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Loading preview...
                      </p>
                    </div>
                  </div>
                )}

                {/* Inline code suggestions overlay */}
                {codeSuggestions.length > 0 && (
                  <div className="absolute top-2 right-2 w-[400px] z-20 max-h-[50%] overflow-y-auto">
                    <InlineSuggestionsPanel
                      suggestions={codeSuggestions}
                      onAccept={handleAcceptSuggestion}
                      onReject={handleRejectSuggestion}
                      onAcceptAll={() => {
                        codeSuggestions.forEach((s) =>
                          actions.updateFile(s.filePath, s.suggestedCode),
                        );
                        setCodeSuggestions([]);
                        toast.success("All suggestions applied!");
                      }}
                      onRejectAll={() => setCodeSuggestions([])}
                    />
                  </div>
                )}
              </main>
            </Panel>

            {/* Task Plan Panel — shows when a plan is active */}
            {activeTaskPlan && (
              <>
                <ResizeHandle direction="vertical" />
                <Panel defaultSize={40} minSize={15} maxSize={60}>
                  <TaskPlanViewer
                    plan={activeTaskPlan}
                    onStartTask={handleStartTask}
                    onStartAll={handleStartAllTasks}
                    isExecuting={isExecutingTask}
                    executingTaskId={executingTaskId}
                  />
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>
      </PanelGroup>

      {/* Modals */}
      {showQR && (
        <QRCodeModal url={previewUrl} onClose={() => setShowQR(false)} />
      )}
      {showDeploymentProgress && (
        <DeploymentProgress
          open={true}
          status={deploymentStatus}
          onClose={() => setShowDeploymentProgress(false)}
          deploymentUrl={deploymentUrl}
          error={deploymentError}
        />
      )}
      {showChatHistory && (
        <ChatHistoryModal
          chats={chatList}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
          onNewChat={handleNewChat}
          onClose={() => setShowChatHistory(false)}
        />
      )}
      <VercelConnectModal
        open={showVercelConnect}
        onOpenChange={setShowVercelConnect}
        onConnected={() => handleDeploy()}
      />
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function flattenTasks(tasks: TaskItem[]): TaskItem[] {
  const result: TaskItem[] = [];
  for (const t of tasks) {
    result.push(t);
    if (t.subtasks) result.push(...flattenTasks(t.subtasks));
  }
  return result;
}

function markTaskCompleted(plan: TaskPlan, taskId: string) {
  function mark(items: TaskItem[]) {
    for (const item of items) {
      if (item.id === taskId) {
        item.status = "completed";
        return true;
      }
      if (item.subtasks && mark(item.subtasks)) return true;
    }
    return false;
  }
  mark(plan.tasks);
}

// ─── Main Export ────────────────────────────────────────────────────────────
export function BuilderThreadPage({ threadId }: BuilderThreadPageProps) {
  return (
    <ProjectProvider>
      <BuilderThreadPageContent threadId={threadId} />
    </ProjectProvider>
  );
}
