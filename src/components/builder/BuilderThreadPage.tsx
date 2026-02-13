"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useBuilderStore } from "@/stores/builder-store";
import { useBuilderUIStore } from "@/stores/builder-ui-store";
import { SandpackWrapper } from "./SandpackWrapper";
import { HttpChainWrapper } from "./HttpChainWrapper";
import { ChatInterface } from "./chat-interface";
import { CheckpointHistory } from "./checkpoint-history";
import { ProjectProvider, useProject } from "@/lib/builder/project-context";
import { useProjectSync } from "@/lib/builder/use-project-sync";
import { useGitAutoCommit } from "@/lib/builder/git-auto-commit";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";

import { X, Copy, Check, History, Plus, MessageSquare } from "lucide-react";
import { BuilderHeader } from "./BuilderHeader";
import { exportService } from "@/lib/builder/export-service";
import {
  deploymentService,
  type DeploymentStatus,
} from "@/lib/builder/deployment-service";
import { DeploymentProgress } from "./deployment-progress";
import { errorHandler } from "@/lib/builder/error-handlers";
import type { TemplateType, DeploymentConfig } from "app-types/builder";

function QRCodeModal({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
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

interface BuilderThreadPageProps {
  threadId: string;
}

// Inner component that uses ProjectContext
function BuilderThreadPageContent({ threadId }: BuilderThreadPageProps) {
  const router = useRouter();

  // Use selective store subscriptions
  const currentThread = useBuilderStore((s) => s.currentThread);
  const messages = useBuilderStore((s) => s.messages);
  const files = useBuilderStore((s) => s.files);
  const loadThread = useBuilderStore((s) => s.loadThread);
  const addMessage = useBuilderStore((s) => s.addMessage);
  const setMessages = useBuilderStore((s) => s.setMessages);

  const { state, actions } = useProject();

  // Auto-save integration
  const { isSaving, hasPendingSaves } = useProjectSync({
    autoSaveEnabled: true,
    debounceMs: 1000,
  });

  // UI store selectors
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
  const [builderMode, setBuilderMode] = useState<"default" | "httpchain">(
    "default",
  );
  const [isExporting, setIsExporting] = useState(false);
  const [deploymentStatus, setDeploymentStatus] =
    useState<DeploymentStatus | null>(null);
  const [deploymentUrl, setDeploymentUrl] = useState<string | undefined>();
  const [deploymentError, setDeploymentError] = useState<string | undefined>();
  const [showDeploymentProgress, setShowDeploymentProgress] = useState(false);
  const toggleMobilePreview = useBuilderUIStore((s) => s.toggleMobilePreview);

  const [selectedModel, setSelectedModel] = useState<{
    provider: string;
    model: string;
  }>({
    provider: "openai",
    model: "gpt-4.1-mini",
  });

  // Git auto-commit integration
  // Stores the linked repo info (owner/repo/branch) — no tokens on the client
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

  // Load repo config from localStorage (saved when project was set up)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`flare_repo_config_${threadId}`);
      if (stored) {
        setRepoConfig(JSON.parse(stored));
      }
    } catch {
      // Config not available
    }
  }, [threadId]);

  // --- Streaming state ---
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const handleBuilderModeChange = useCallback(
    (mode: "default" | "httpchain") => setBuilderMode(mode),
    [],
  );

  const currentTemplate = currentThread?.template;
  useEffect(() => {
    setBuilderMode(currentTemplate === "httpchain" ? "httpchain" : "default");
  }, [currentTemplate]);

  useEffect(() => {
    if (!isLoading && Object.keys(state.files).length > 0) {
      setFilesReady(true);
    } else if (!isLoading && Object.keys(files).length === 0) {
      setFilesReady(true);
    }
  }, [isLoading, state.files, files]);

  useEffect(() => {
    if (typeof window !== "undefined") setPreviewUrl(window.location.href);
  }, []);

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
      setDeploymentError(errorMessage);
      toast.error(errorMessage);
    }
  }, [currentThread, state.files]);

  const handleShowQR = useCallback(() => setShowQR(true), []);

  // Transform store messages to ChatMessage format
  const transformedMessages = useMemo(
    () =>
      messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        mentions: (m.mentions as any[]) || [],
        timestamp: new Date(m.createdAt).getTime(),
      })),
    [messages],
  );

  /**
   * Smart code parser: extracts file operations from AI responses.
   * Supports formats:
   *   ```filepath:/path/to/file.ext     (direct filepath prefix)
   *   ```language filepath:/path/to/file.ext  (language + filepath)
   *   ```language /path/to/file.ext     (language + absolute path)
   *   ```/path/to/file.ext              (just the path)
   *   ```language src/file.ext          (language + relative path)
   *   ```filepath:src/file.ext          (relative filepath prefix)
   */
  const parseAIResponse = useCallback(
    (response: string) => {
      const operations: Array<{
        type: "create" | "update" | "delete";
        path: string;
        content: string;
      }> = [];

      // Match code blocks with various filepath patterns (absolute or relative)
      const codeBlockRegex =
        /```(?:[\w.*+-]*\s+)?(?:filepath:)?([^\n`]+\.[a-zA-Z0-9]+)\n([\s\S]*?)```/g;
      let match;

      while ((match = codeBlockRegex.exec(response)) !== null) {
        let path = match[1].trim();
        const content = match[2].trimEnd();

        // Clean trailing whitespace and language suffixes
        path = path.replace(/\s+$/, "");

        // Must look like a file path
        if (!path.includes(".")) continue;
        if (!path.startsWith("/")) path = "/" + path;

        const type = state.files[path] ? "update" : "create";
        operations.push({ type, path, content });
      }

      return operations;
    },
    [state.files],
  );

  const handleStopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setStreamingContent("");
  }, []);

  const handleResetChat = useCallback(async () => {
    if (!threadId) return;

    // Optional: Ask for confirmation
    if (!confirm("Are you sure you want to clear the chat history?")) return;

    try {
      // Clear local state immediately
      setMessages([]);

      // Clear server state
      const response = await fetch(
        `/api/builder/threads/${threadId}/messages`,
        { method: "DELETE" },
      );

      if (!response.ok) throw new Error("Failed to clear messages");

      toast.success("Chat history cleared");
    } catch (error) {
      console.error("Failed to reset chat:", error);
      toast.error("Failed to clear chat history");
    }
  }, [threadId, setMessages]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!threadId || isStreaming) return;

      try {
        // Add user message
        await addMessage(threadId, "user", content, []);

        setIsStreaming(true);
        setStreamingContent("");

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // Build prompt with template-specific context
        const templateGuidelines: Record<string, string> = {
          react: `This is a React (Vite) project.
- Use functional components with hooks.
- Entry file is /App.jsx or /App.tsx.
- Use JSX syntax. Import React only if needed (React 18+ auto-imports).
- Use CSS modules, inline styles, or a /styles.css file for styling.`,
          "vite-react": `This is a Vite + React project.
- Use functional components with hooks.
- Entry file is /src/App.tsx, mounted in /src/main.tsx.
- Use TypeScript (.tsx files).
- Use CSS modules or Tailwind CSS for styling.`,
          nextjs: `This is a Next.js App Router project.
- ALWAYS use the App Router pattern (files under /app/ directory).
- NEVER use Pages Router patterns (no /pages/ directory, no getServerSideProps, no getStaticProps).
- Use "use client" directive for client components with hooks/state/effects.
- Server Components are the default — only add "use client" when needed.
- Main page is /app/page.tsx, layout is /app/layout.tsx.
- Use TypeScript (.tsx files).`,
          vanilla: `This is a vanilla JavaScript project.
- Entry file is /index.js.
- Use /index.html for markup.
- No frameworks — plain JS/HTML/CSS only.`,
          static: `This is a static HTML project.
- Entry file is /index.html.
- Use plain HTML, CSS, and JavaScript.
- Include styles in /style.css and scripts in /script.js.`,
          httpchain: `This is an HTTP Chain (API workflow) project built with Vite + React.
- Entry file is /src/App.tsx.
- Use TypeScript and React components.`,
        };

        const templateGuide =
          templateGuidelines[currentThread?.template || "react"] ||
          templateGuidelines.react;

        const systemPrompt = `You are an expert code generator for a web-based IDE.

PROJECT TEMPLATE: ${currentThread?.template || "react"}
${templateGuide}

RULES:
1. Wrap each file in a code block with the filepath using this format:
   \`\`\`language filepath:/path/to/file.ext
2. Always include complete, working code — no placeholders or "// rest of code here".
3. Follow modern best practices and use TypeScript where applicable.
4. Ensure code is production-ready and well-commented.
5. When modifying existing code, output the COMPLETE file content.

Current project files:
${Object.keys(state.files).join(", ") || "No files yet"}`;

        // Build conversation history for context (last 10 messages)
        const recentMessages = transformedMessages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Call builder AI endpoint with separated system/user prompts + history
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

        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Stream the response
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

        // Save the complete AI response
        await addMessage(threadId, "assistant", fullText, []);

        // Parse & apply file operations → triggers Sandpack hot reload via FileChangeListener
        const fileOperations = parseAIResponse(fullText);

        if (fileOperations.length > 0) {
          const changedPaths: string[] = [];
          for (const op of fileOperations) {
            if (op.type === "create" || op.type === "update") {
              console.log(
                `[AI] ${op.type === "create" ? "Creating" : "Updating"} file:`,
                op.path,
              );
              actions.updateFile(op.path, op.content);
              changedPaths.push(op.path);
            } else if (op.type === "delete") {
              console.log("[AI] Deleting file:", op.path);
              actions.deleteFile(op.path);
              changedPaths.push(op.path);
            }
          }
          toast.success(
            `${fileOperations.length} file${fileOperations.length > 1 ? "s" : ""} updated!`,
          );

          // Auto-commit to GitHub if configured
          if (gitConfigured && commitAndPush) {
            try {
              // Build files array for commit
              const filesToCommit: Array<{ path: string; content: string }> =
                [];
              for (const op of fileOperations) {
                if (op.type === "create" || op.type === "update") {
                  const path = op.path.startsWith("/")
                    ? op.path.slice(1)
                    : op.path;
                  filesToCommit.push({ path, content: op.content });
                }
              }

              const commitMessage = `AI: ${content.slice(0, 60)}${content.length > 60 ? "..." : ""}`;
              const result = await commitAndPush(filesToCommit, commitMessage);

              if (result) {
                toast.success(`Committed: ${result.sha.slice(0, 7)}`, {
                  description: "Changes pushed to GitHub",
                });
              }
            } catch (commitError) {
              console.error("Auto-commit failed:", commitError);
              setHasUncommittedChanges(true);
            }
          } else {
            setHasUncommittedChanges(true);
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
        await addMessage(threadId, "assistant", `Error: ${error.message}`, []);
        setIsStreaming(false);
        setStreamingContent("");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      threadId,
      selectedModel,
      isStreaming,
      state.files,
      gitConfigured,
      commitAndPush,
    ],
  );

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
      {/* Single unified header — no secondary bars */}
      <BuilderHeader
        projectName={currentThread?.title || "Untitled Project"}
        onDownloadZip={handleExportZip}
        onDeploy={handleDeploy}
        onShowQR={handleShowQR}
        onToggleMobilePreview={toggleMobilePreview}
        mobilePreview={mobilePreview}
        deploying={showDeploymentProgress}
        isExporting={isExporting}
        fileCount={Object.keys(state.files).length}
        isSynced={!isSaving && !hasPendingSaves}
        builderMode={builderMode}
        onBuilderModeChange={handleBuilderModeChange}
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

      <div className="flex flex-1 w-full overflow-hidden min-h-0">
        {/* Left Sidebar — Chat + Checkpoint History */}
        <div className="w-56 md:w-64 lg:w-80 border-r flex flex-col shrink-0 bg-muted/20">
          {/* Chat Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-background/50 shrink-0 h-10">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Chat</span>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  // TODO: Implement history list
                  toast.info("Chat history coming soon");
                }}
                title="History"
              >
                <History className="h-4 w-4 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleResetChat}
                title="New Chat"
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </div>
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
                // Toggle fallback
                const nextModel =
                  selectedModel.model === "gpt-4.1-mini"
                    ? "gpt-4o"
                    : "gpt-4.1-mini";
                setSelectedModel({ ...selectedModel, model: nextModel });
              }
            }}
            files={state.files}
            condensed
          />

          {/* Checkpoint History Panel (collapsible) */}
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

        {/* Main Area — Sandpack Workspace */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0">
          <main className="flex-1 overflow-hidden min-h-0 w-full relative">
            {filesReady ? (
              <div
                className={
                  mobilePreview
                    ? "absolute inset-0 flex items-center justify-center overflow-hidden"
                    : "absolute inset-0 overflow-hidden"
                }
              >
                {builderMode === "httpchain" ? (
                  <div className="w-full h-full relative">
                    <HttpChainWrapper />
                  </div>
                ) : (
                  <>
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
                      />
                    )}
                  </>
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
          </main>
        </div>
      </div>

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
    </div>
  );
}

// Main component with ProjectProvider wrapper
export function BuilderThreadPage({ threadId }: BuilderThreadPageProps) {
  return (
    <ProjectProvider>
      <BuilderThreadPageContent threadId={threadId} />
    </ProjectProvider>
  );
}
